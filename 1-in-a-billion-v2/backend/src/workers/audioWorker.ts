/**
 * AUDIO WORKER - TTS Generation
 *
 * Processes audio_generation tasks:
 * - Reads text from Storage artifact (full reading ~8000 chars)
 * - Routes to active TTS provider (MiniMax by default, Replicate as fallback)
 * - MiniMax: Sends full text in one call, outputs single MP3
 *   - Supports cross-lingual voice cloning via language_boost + native base voices
 * - Replicate/Chatterbox: Chunks text, processes sequentially, concatenates WAV→MP3
 *   - Dormant fallback (activate via active_tts_provider='replicate' in api_keys)
 * - Uploads artifact to Supabase Storage
 */

import axios from 'axios';
import { spawn } from 'child_process';
import fs from 'fs/promises';
import os from 'os';
import path from 'path';
import pLimit from 'p-limit';
import Replicate from 'replicate';
import { BaseWorker, TaskResult } from './baseWorker';
import { JobTask, supabase } from '../services/supabaseClient';
import { env } from '../config/env';
import { apiKeys } from '../services/apiKeysHelper';
import { clearApiKeyCache } from '../services/apiKeys';
import { getMinimaxSequenceForUrl, generateMinimaxAsync } from '../services/minimaxTts';
import { logMinimaxTtsCost, logReplicateCost } from '../services/costTracking';
import { getVoiceById, isTurboPresetVoice } from '../config/voices';
import { getSystemDisplayName } from '../config/systemConfig';
import { cleanupTextForTTS } from '../utils/textCleanup';
import { phoneticizeTextForTTS } from '../services/text/phoneticizer';
import {
  splitIntoChunks,
  concatenateWavBuffers,
  AUDIO_CONFIG,
  dedupeAdjacentSentences,
  dedupeChunkBoundaryOverlap,
  trimSilenceFromWav,
  buildSilenceWav,
} from '../services/audioProcessing';
import { getVoiceConfig } from '../i18n/voiceRegistry';
import { getChunkConfig } from '../i18n/chunkRules';
import { parseLanguage, isValidLanguage, type OutputLanguage } from '../config/languages';
import {
  isReplicateRateLimitError,
  runReplicateWithRateLimit,
} from '../services/replicateRateLimiter';
import {
  enqueueAllChunks,
  waitForAllChunks,
} from '../services/replicateQueue';

async function withTimeout<T>(promise: Promise<T>, timeoutMs: number, label: string): Promise<T> {
  let timeoutHandle: NodeJS.Timeout | null = null;
  try {
    return await Promise.race([
      promise,
      new Promise<never>((_, reject) => {
        timeoutHandle = setTimeout(() => {
          reject(new Error(`${label} timed out after ${timeoutMs}ms`));
        }, timeoutMs);
      }),
    ]);
  } finally {
    if (timeoutHandle) clearTimeout(timeoutHandle);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Audio Format Detection
// ─────────────────────────────────────────────────────────────────────────────

function isWav(buf: Buffer): boolean {
  return buf.length >= 12 && buf.toString('ascii', 0, 4) == 'RIFF' && buf.toString('ascii', 8, 12) == 'WAVE';
}

function isMp3(buf: Buffer): boolean {
  if (buf.length >= 3 && buf.toString('ascii', 0, 3) === 'ID3') return true;
  if (buf.length >= 2 && buf[0] === 0xff && (buf[1] & 0xe0) === 0xe0) return true;
  return false;
}

// ─────────────────────────────────────────────────────────────────────────────
// NOTE: Text chunking and WAV concatenation logic now imported from shared audioProcessing module
// To adjust chunking or crossfade behavior, edit: src/services/audioProcessing.ts
// ─────────────────────────────────────────────────────────────────────────────

// ─────────────────────────────────────────────────────────────────────────────
// WAV Processing (IEEE Float to PCM conversion, concatenation)
// ─────────────────────────────────────────────────────────────────────────────

function parseWavHeader(buffer: Buffer): { audioFormat: number; numChannels: number; sampleRate: number; bitsPerSample: number; dataOffset: number; dataSize: number } | null {
  if (buffer.length < 44) return null;
  if (buffer.toString('ascii', 0, 4) !== 'RIFF') return null;
  if (buffer.toString('ascii', 8, 12) !== 'WAVE') return null;

  let offset = 12;
  let audioFormat = 1, numChannels = 1, sampleRate = 24000, bitsPerSample = 16;
  let dataOffset = 0, dataSize = 0;

  while (offset < buffer.length - 8) {
    const chunkId = buffer.toString('ascii', offset, offset + 4);
    const chunkSize = buffer.readUInt32LE(offset + 4);

    if (chunkId === 'fmt ') {
      audioFormat = buffer.readUInt16LE(offset + 8);
      numChannels = buffer.readUInt16LE(offset + 10);
      sampleRate = buffer.readUInt32LE(offset + 12);
      bitsPerSample = buffer.readUInt16LE(offset + 22);
    } else if (chunkId === 'data') {
      dataOffset = offset + 8;
      dataSize = chunkSize;
      break;
    }
    offset += 8 + chunkSize;
    if (chunkSize % 2 !== 0) offset++;
  }

  return { audioFormat, numChannels, sampleRate, bitsPerSample, dataOffset, dataSize };
}

function convertFloatWavToPcm(buffer: Buffer): Buffer {
  const header = parseWavHeader(buffer);
  if (!header) return buffer;

  // audioFormat 3 = IEEE float
  if (header.audioFormat === 3 && header.bitsPerSample === 32) {
    const audioData = buffer.slice(header.dataOffset, header.dataOffset + header.dataSize);
    const numSamples = audioData.length / 4;
    const pcmData = Buffer.alloc(numSamples * 2);

    for (let i = 0; i < numSamples; i++) {
      const floatSample = audioData.readFloatLE(i * 4);
      const pcmSample = Math.max(-32768, Math.min(32767, Math.round(floatSample * 32767)));
      pcmData.writeInt16LE(pcmSample, i * 2);
    }

    // Build new WAV header for 16-bit PCM
    const wavHeader = Buffer.alloc(44);
    wavHeader.write('RIFF', 0);
    wavHeader.writeUInt32LE(36 + pcmData.length, 4);
    wavHeader.write('WAVE', 8);
    wavHeader.write('fmt ', 12);
    wavHeader.writeUInt32LE(16, 16); // fmt chunk size
    wavHeader.writeUInt16LE(1, 20); // PCM format
    wavHeader.writeUInt16LE(header.numChannels, 22);
    wavHeader.writeUInt32LE(header.sampleRate, 24);
    wavHeader.writeUInt32LE(header.sampleRate * header.numChannels * 2, 28); // byte rate
    wavHeader.writeUInt16LE(header.numChannels * 2, 32); // block align
    wavHeader.writeUInt16LE(16, 34); // bits per sample
    wavHeader.write('data', 36);
    wavHeader.writeUInt32LE(pcmData.length, 40);

    return Buffer.concat([wavHeader, pcmData]);
  }

  return buffer;
}

// NOTE: concatenateWavBuffers and buildSilenceWav are now imported from shared audioProcessing module

import { buildLocalizedSpokenIntro, type AudioPersonMeta } from '../i18n/spokenIntro';

/**
 * Infer doc type from task input for spoken intro routing.
 * Gemini's code referenced this but never defined it.
 */
function inferDocType(task: any): 'person1' | 'person2' | 'overlay' | 'verdict' {
  const explicit = task?.input?.docType;
  if (explicit && ['person1', 'person2', 'overlay', 'verdict'].includes(explicit)) {
    return explicit;
  }
  // Fallback heuristics based on docNum or task type
  const docNum = task?.input?.docNum;
  if (docNum === 'verdict' || docNum === 5) return 'verdict';
  if (docNum === 1) return 'person1';
  if (docNum === 2) return 'person2';
  if (docNum && docNum >= 3) return 'overlay';
  return 'person1'; // safe default
}

// ─────────────────────────────────────────────────────────────────────────────
// FFmpeg Conversion
// ─────────────────────────────────────────────────────────────────────────────

async function runFfmpeg(args: string[]): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    const proc = spawn('ffmpeg', ['-y', ...args], { stdio: ['ignore', 'ignore', 'pipe'] });
    let stderr = '';
    proc.stderr.on('data', (d) => (stderr += d.toString()));
    proc.on('error', (err) => reject(err));
    proc.on('close', (code) => {
      if (code === 0) return resolve();
      reject(new Error(`ffmpeg failed (code=${code}): ${stderr.slice(-500)}`));
    });
  });
}

async function convertWavToMp3(wav: Buffer): Promise<Buffer> {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'iab-audio-'));
  const inPath = path.join(dir, 'in.wav');
  const outPath = path.join(dir, 'out.mp3');
  try {
    await fs.writeFile(inPath, wav);
    await runFfmpeg([
      '-i', inPath,
      '-vn',
      '-af', 'loudnorm=I=-16:TP=-1.5:LRA=11',
      '-c:a', 'libmp3lame',
      '-b:a', '128k',
      '-ar', '44100',
      outPath,
    ]);
    const mp3 = await fs.readFile(outPath);
    console.log(`WAV->MP3 (normalized): ${Math.round(wav.length / 1024)}KB -> ${Math.round(mp3.length / 1024)}KB`);
    return mp3;
  } finally {
    await fs.rm(dir, { recursive: true, force: true }).catch(() => { });
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// AudioWorker Class
// ─────────────────────────────────────────────────────────────────────────────

export class AudioWorker extends BaseWorker {
  private runpodApiKey: string;
  private runpodEndpointId: string;
  private voiceSampleUrl: string;

  constructor() {
    super({
      taskTypes: ['audio_generation'],
      maxConcurrentTasks: 1, // ⚠️ MUST be 1: each task holds ~60-100MB in WAV buffers + ffmpeg subprocesses. Concurrency > 1 causes OOM on 1GB Fly VMs.
    });

    console.log(`🤖 AudioWorker initialized (sequential) at ${new Date().toISOString()}`);

    // API keys will be fetched from Supabase on first use
    // Fallback to env vars if Supabase unavailable
    this.runpodApiKey = env.RUNPOD_API_KEY;
    this.runpodEndpointId = env.RUNPOD_ENDPOINT_ID;
    this.voiceSampleUrl =
      env.VOICE_SAMPLE_URL ||
      'https://qdfikbgwuauertfmkmzk.supabase.co/storage/v1/object/public/voices/david.wav';
  }

  protected async processTask(task: JobTask): Promise<TaskResult> {
    try {
      console.log(`🎤 [AudioWorker] Processing task ${task.id}`);

      let text: string | undefined = task.input.text || task.input.content;

      // ALWAYS download from storage if textArtifactPath exists
      if (task.input?.textArtifactPath) {
        if (!supabase) {
          return { success: false, error: 'Supabase not configured' };
        }

        const storagePath = String(task.input.textArtifactPath);
        console.log(`📥 [AudioWorker] Downloading text: ${storagePath}`);
        const { data, error } = await supabase.storage.from('job-artifacts').download(storagePath);
        if (error || !data) {
          return { success: false, error: `Download failed: ${error?.message}` };
        }

        text = Buffer.from(await data.arrayBuffer()).toString('utf-8');
        console.log(`✅ [AudioWorker] Downloaded ${text.length} chars`);
      }

      if (!text) {
        return { success: false, error: 'No text found' };
      }

      // Load job metadata for deterministic spoken intro.
      let person1Meta: AudioPersonMeta | undefined;
      let person2Meta: AudioPersonMeta | undefined;
      if (supabase) {
        try {
          const { data: jobRow } = await supabase
            .from('jobs')
            .select('params')
            .eq('id', task.job_id)
            .maybeSingle();
          const params = jobRow?.params || {};
          person1Meta = params.person1 || undefined;
          person2Meta = params.person2 || undefined;
          // Read output language from job params for voice/chunk selection
          (this as any)._jobOutputLanguage = parseLanguage(params.outputLanguage);
        } catch (metaErr: any) {
          console.warn(`⚠️ [AudioWorker] Could not load job metadata for spoken intro: ${metaErr?.message || String(metaErr)}`);
        }
      }
      // Clean and de-duplicate text BEFORE chunking.
      const originalText = String(text);
      const jobLangStr = (this as any)._jobOutputLanguage || 'en';
      let cleanedText = cleanupTextForTTS(originalText, jobLangStr);
      cleanedText = await phoneticizeTextForTTS(cleanedText, jobLangStr);
      const dedupResult = dedupeAdjacentSentences(cleanedText);
      cleanedText = dedupResult.text;
      if (dedupResult.removed > 0) {
        console.warn(`⚠️ [AudioWorker] Removed ${dedupResult.removed} adjacent duplicate sentence(s) from source text before TTS.`);
      }

      // Build spoken intro and prepend to narration.
      const resolvedDocType = inferDocType(task);
      const jobLang: OutputLanguage = (this as any)._jobOutputLanguage || 'en';

      const intro = buildLocalizedSpokenIntro({
        system: task.input?.system,
        docType: resolvedDocType,
        person1: person1Meta,
        person2: person2Meta,
        language: jobLang
      });
      // Add deliberate, massive pauses between the intro and body text for pacing (~5 seconds)
      const pauseIndicators: Record<string, string> = {
        en: '... ... ... ... ... ... ... ... ... ...',
        de: '... ... ... ... ... ... ... ... ... ...',
        es: '... ... ... ... ... ... ... ... ... ...',
        fr: '... ... ... ... ... ... ... ... ... ...',
        pt: '... ... ... ... ... ... ... ... ... ...',
        it: '... ... ... ... ... ... ... ... ... ...',
        zh: '........................',
        ko: '... ... ... ... ... ... .......',
        ja: '………………………………'
      };
      const langPrefix = jobLang.substring(0, 2).toLowerCase();
      const pauseStr = pauseIndicators[langPrefix] || '... ... ... ... ... ... ... ... ... ...';

      text = `${intro}\n\n${pauseStr}\n\n${cleanedText}`.trim();

      // Chunk size - language-aware (Chinese needs shorter chunks, etc.)
      const langChunkConfig = getChunkConfig(jobLang);
      const configuredChunkSize = parseInt(process.env.CHATTERBOX_CHUNK_SIZE || String(langChunkConfig.maxChars), 10);
      const chunkSize = Math.max(langChunkConfig.minChars, Math.min(langChunkConfig.maxChars, Number.isFinite(configuredChunkSize) ? configuredChunkSize : langChunkConfig.maxChars));
      if (chunkSize !== configuredChunkSize) {
        console.warn(`⚠️ [AudioWorker] Clamped CHATTERBOX_CHUNK_SIZE ${configuredChunkSize} -> ${chunkSize} for stability.`);
      }

      // ─────────────────────────────────────────────────────────────────────
      // CHUNK TEXT (Turbo supports 500 chars, Original supports 300)
      // ─────────────────────────────────────────────────────────────────────
      let chunks = splitIntoChunks(text, chunkSize);
      const boundaryDedup = dedupeChunkBoundaryOverlap(chunks);
      chunks = boundaryDedup.chunks;
      if (boundaryDedup.removed > 0) {
        console.warn(`⚠️ [AudioWorker] Removed ${boundaryDedup.removed} duplicated boundary sentence(s) across chunks.`);
      }
      console.log(`📦 [AudioWorker] Chunking ${text.length} chars -> ${chunks.length} chunks (max ${chunkSize} chars)`);

      // ─────────────────────────────────────────────────────────────────────
      // VOICE PROVIDER ROUTING
      // MiniMax (default) handles ALL languages with cross-lingual cloning.
      // Replicate/Chatterbox is dormant fallback (activate via api_keys table).
      // ─────────────────────────────────────────────────────────────────────
      if (!isValidLanguage(jobLang)) {
        console.warn(`⚠️ [AudioWorker] Language ${jobLang} not in supported list - skipping audio generation.`);
        return { success: true, output: { skippedAudio: true, reason: `no_voice_for_${jobLang}` } };
      }

      // ─────────────────────────────────────────────────────────────────────
      // VOICE PROVIDER ROUTING & GENERATION
      // ─────────────────────────────────────────────────────────────────────
      const activeProvider = await apiKeys.activeTtsProvider() || 'replicate';
      let mp3: Buffer;
      let duration: number;
      const voiceId = task.input.voiceId || task.input.voice || 'david';
      const voice = getVoiceById(voiceId);
      const isTurboPreset = voice?.isTurboPreset || false;
      const startTime = Date.now();
      let elapsedMs = 0;

      if (activeProvider === 'minimax') {
        console.log('\n' + '═'.repeat(70));
        console.log(`🎵 MINIMAX AUDIO GENERATION STARTING (${jobLang})`);
        console.log('═'.repeat(70));

        // Get default speed configure (1.0 is default, lower speeds sound robotic)
        const MINIMAX_DEFAULT_SPEED = Number(process.env.MINIMAX_DEFAULT_SPEED || 0.95);
        // Get default volume configure (1.0 is default max is 10)
        const MINIMAX_DEFAULT_VOLUME = Number(process.env.MINIMAX_DEFAULT_VOLUME || 2.0);

        // We need a valid system voice ID as a base for MiniMax's T2A v2 cloning.
        // Using a language-native base voice produces much better cross-lingual results
        // than forcing an English base to speak Japanese/German/etc.
        let minimaxVoiceId = (voice as any)?.minimaxVoiceId;

        if (!minimaxVoiceId) {
          const category = (voice as any)?.category || 'neutral';
          const isFemale = category === 'female';
          const langPrefix = jobLang.substring(0, 2).toLowerCase();

          // Language-native base voices for best cross-lingual cloning quality.
          // The clone_prompt timbre overrides these, but a native base avoids accent artifacts.
          const NATIVE_BASE_VOICES: Record<string, { male: string; female: string }> = {
            en: { male: 'English_expressive_narrator', female: 'English_Graceful_Lady' },
            de: { male: 'German_ExpressiveStoryteller', female: 'German_ExpressiveStoryteller' },
            es: { male: 'Spanish_FreestyleRapper', female: 'Spanish_Graceful_Lady' },
            fr: { male: 'French_Narrator', female: 'French_Narrator' },
            zh: { male: 'Chinese (Mandarin)_Reliable_Executive', female: 'Chinese (Mandarin)_Reliable_Executive' },
            ja: { male: 'Japanese_IntellectualSenior', female: 'Japanese_GentleButler' },
            ko: { male: 'Korean_WiseTeacher', female: 'Korean_WiseTeacher' },
            pt: { male: 'Portuguese_Narrator', female: 'Portuguese_Narrator' },
            it: { male: 'Italian_Narrator', female: 'Italian_Narrator' },
            hi: { male: 'Hindi_Narrator', female: 'Hindi_Narrator' },
          };

          const langVoices = NATIVE_BASE_VOICES[langPrefix] || NATIVE_BASE_VOICES['en']!;
          minimaxVoiceId = isFemale ? langVoices.female : langVoices.male;

          console.log(`[MiniMax] Auto-selected base voice: ${minimaxVoiceId} (lang=${langPrefix}, gender=${category})`);
        }

        let clonePromptFileId: string | undefined;
        // Use short clone clip (<8s) for MiniMax clone_prompt, fall back to full sample
        const refAudioUrl = (voice as any)?.cloneAudioUrl || voice?.sampleAudioUrl || task.input.audioUrl || this.voiceSampleUrl;

        if (refAudioUrl) {
          console.log(`[AudioWorker] Uploading MiniMax reference audio from: ${refAudioUrl}`);
          clonePromptFileId = await getMinimaxSequenceForUrl(refAudioUrl, `${voiceId}_reference.wav`).catch(e => {
            console.warn("⚠️ [AudioWorker] Failed to upload reference audio, proceeding without clone prompt", e.message);
            return undefined;
          });
        }

        console.log(`[MiniMax] Using Voice: ${minimaxVoiceId} | Cloning File ID: ${clonePromptFileId || 'None'} | Speed: ${MINIMAX_DEFAULT_SPEED} | Volume: ${MINIMAX_DEFAULT_VOLUME}`);

        try {
          // Wrap MiniMax call with a hard timeout (25 min) as ultimate safety net.
          // The MiniMax polling loop has its own 20-min timeout, but this catches
          // any other hang (upload, download, network stall).
          const MINIMAX_HARD_TIMEOUT_MS = parseInt(process.env.MINIMAX_HARD_TIMEOUT_MS || '1500000', 10);
          const minimaxLang = jobLang.substring(0, 2).toLowerCase();
          mp3 = await withTimeout(
            generateMinimaxAsync(text, minimaxVoiceId, clonePromptFileId, MINIMAX_DEFAULT_SPEED, MINIMAX_DEFAULT_VOLUME, minimaxLang),
            MINIMAX_HARD_TIMEOUT_MS,
            `MiniMax TTS (${text.length} chars, ${jobLang})`
          );
        } catch (error: any) {
          console.error(`❌ [AudioWorker] MiniMax generation failed: ${error.message}`);
          return { success: false, error: `MiniMax generation failed: ${error.message}` };
        }
        // Approximate duration
        duration = Math.ceil(mp3.length / 4000);
        elapsedMs = Date.now() - startTime;
        console.log(`🎵 [AudioWorker] Final: ${Math.round(mp3.length / 1024)}KB MP3, ~${duration}s (MiniMax)`);
      } else {
        // ─────────────────────────────────────────────────────────────────────
        // REPLICATE/CHATTERBOX TTS (dormant fallback — only runs when
        // active_tts_provider is set to 'replicate' in api_keys table)
        // - Turbo (English): `voice` param or `reference_audio` for cloning
        // - Multilingual (DE/ES/FR/ZH): `language_id` + `reference_audio`
        // ─────────────────────────────────────────────────────────────────────
        const voiceConfig = getVoiceConfig(jobLang);
        const useMultilingual = voiceConfig.provider === 'chatterbox-multilingual';

        console.log('\n' + '═'.repeat(70));
        console.log(`🎵 REPLICATE AUDIO GENERATION STARTING${useMultilingual ? ` (Multilingual: ${voiceConfig.languageId})` : ''}`);
        console.log('═'.repeat(70));

        console.log(`🚀 [AudioWorker] Using REPLICATE for ${isTurboPreset ? 'Turbo preset' : 'custom voice'}: ${voice?.displayName || voiceId}`);

        // Get Replicate API token
        console.log(`🔑 [AudioWorker] Fetching Replicate API token...`);
        let replicateToken = await apiKeys.replicate().catch(() => null) || env.REPLICATE_API_TOKEN;
        if (!replicateToken) {
          // Forced refresh: avoid stale negative cache after transient Supabase/API hiccups.
          clearApiKeyCache('replicate');
          replicateToken = await apiKeys.replicate().catch(() => null) || env.REPLICATE_API_TOKEN;
        }
        if (!replicateToken) {
          console.error(`❌ [AudioWorker] REPLICATE TOKEN NOT FOUND!`);
          throw new Error('Replicate API token not found (check Supabase api_keys table or REPLICATE_API_TOKEN env var)');
        }
        console.log(`✅ [AudioWorker] Replicate token found: ${replicateToken.substring(0, 10)}...`);

        const replicate = new Replicate({ auth: replicateToken });
        console.log(`✅ [AudioWorker] Replicate client initialized`);

        // Get voice-specific settings from config (or use defaults)
        // Chatterbox Turbo parameters: temperature, top_p, top_k, repetition_penalty
        const voiceSettings = voice?.turboSettings || {};
        const temperature = voiceSettings.temperature ?? 0.7;  // Default
        const top_p = voiceSettings.top_p ?? 0.95;             // Default
        // CRITICAL: Higher repetition_penalty reduces duplicate sentences (default 1.2, max 2.0)
        // Increased from default to reduce repeated-sentence artifacts
        const repetitionPenaltyRaw = Number(
          process.env.CHATTERBOX_REPETITION_PENALTY ?? (voiceSettings.repetition_penalty ?? 1.7)
        );
        const repetition_penalty = Number.isFinite(repetitionPenaltyRaw)
          ? Math.max(1, Math.min(2, repetitionPenaltyRaw))
          : 1.7;

        console.log(`🎤 [AudioWorker] Voice settings:`, { temperature, top_p, repetition_penalty, isTurboPreset });

        // ─────────────────────────────────────────────────────────────────────
        // REPLICATE CHUNK GENERATION - via global BullMQ queue
        //
        // Instead of calling Replicate directly, we enqueue all chunks into
        // a Redis-backed BullMQ queue. A dedicated rate-limiter-worker
        // processes the queue at the global 600 RPM limit across ALL workers.
        //
        // Fallback: If REDIS_URL is not set, use direct Replicate calls
        // (original behavior) for local dev without Redis.
        // ─────────────────────────────────────────────────────────────────────

        const useGlobalQueue = !!process.env.REDIS_URL;
        const chunkTimeoutMs = parseInt(process.env.REPLICATE_CHUNK_TIMEOUT_MS || '120000', 10);

        // Determine which Replicate model to call
        // Use version-pinned identifier for multilingual to avoid 404 on model endpoint
        const replicateModel = useMultilingual
          ? 'resemble-ai/chatterbox-multilingual:9cfba4c265e685f840612be835424f8c33bdee685d7466ece7684b0d9d4c0b1c'
          : 'resemble-ai/chatterbox-turbo';

        // Build base input params (without per-chunk text field)
        // NOTE: chatterbox-multilingual uses 'text' (not 'text_to_synthesize') and 'language' (not 'language_id')
        let baseInput: Record<string, any>;
        // Both models use 'text' as the input field
        let textField: 'text' = 'text';

        if (useMultilingual) {
          const refAudio = voice?.sampleAudioUrl || task.input.audioUrl || this.voiceSampleUrl;
          baseInput = {
            language: voiceConfig.languageId,
            exaggeration: 0.5,
            cfg_weight: 0.5,
            temperature: temperature,
          };
          if (refAudio) {
            baseInput.reference_audio = refAudio;
            console.log(`  [Replicate] Multilingual voice cloning (${voiceConfig.languageId}) with reference: ${refAudio.substring(0, 80)}...`);
          }
        } else if (isTurboPreset) {
          textField = 'text';
          baseInput = {
            temperature,
            top_p,
            repetition_penalty,
            voice: voice?.turboVoiceId || 'alloy',
          };
        } else {
          textField = 'text';
          const refAudio = voice?.sampleAudioUrl || task.input.audioUrl || this.voiceSampleUrl;
          baseInput = {
            temperature,
            top_p,
            repetition_penalty,
            reference_audio: refAudio,
          };
        }

        let audioBuffers: Buffer[] = [];

        if (useGlobalQueue) {
          // ═══════════════════════════════════════════════════════════════════
          // GLOBAL QUEUE MODE - enqueue to Redis, rate-limiter-worker processes
          // ═══════════════════════════════════════════════════════════════════
          console.log(`🚀 [AudioWorker] Enqueuing ${chunks.length} chunks to global BullMQ queue...`);
          console.log(`   Model: ${replicateModel}, Timeout: ${chunkTimeoutMs}ms`);

          const taskId = task.id || 'unknown';
          const jobIds = await enqueueAllChunks(
            taskId,
            chunks,
            replicateModel,
            baseInput,
            textField,
            chunkTimeoutMs,
          );

          console.log(`📤 [AudioWorker] All ${chunks.length} chunks enqueued - waiting for rate-limiter-worker...`);

          // Wait for all chunks to be processed (up to 45 min for large readings on slow lane)
          const queueTimeoutMs = parseInt(process.env.QUEUE_WAIT_TIMEOUT_MS || '2700000', 10);
          audioBuffers = await waitForAllChunks(jobIds, replicateModel, queueTimeoutMs);

        } else {
          // ═══════════════════════════════════════════════════════════════════
          // LOCAL FALLBACK - direct Replicate calls (no Redis needed)
          // ═══════════════════════════════════════════════════════════════════
          console.log(`🚀 [AudioWorker] No REDIS_URL - using direct Replicate calls (local dev mode)`);
          console.log(`   Generating ${chunks.length} chunks sequentially...`);

          for (let i = 0; i < chunks.length; i++) {
            const maxRetries = Math.max(1, parseInt(process.env.REPLICATE_CHUNK_MAX_RETRIES || '6', 10));
            let buffer: Buffer | null = null;

            for (let attempt = 1; attempt <= maxRetries; attempt++) {
              try {
                console.log(`  [Replicate] Chunk ${i + 1}/${chunks.length} (${chunks[i]!.length} chars) attempt ${attempt}`);
                const input = { ...baseInput, [textField]: chunks[i] };

                const output = await runReplicateWithRateLimit(
                  `audioWorker:chunk:${i + 1}`,
                  () => withTimeout(
                    replicate.run(replicateModel as `${string}/${string}`, { input }),
                    chunkTimeoutMs,
                    `Replicate chunk ${i + 1}`
                  )
                );

                // Convert output to Buffer
                if (output instanceof ReadableStream || (output as any).getReader) {
                  const reader = (output as ReadableStream).getReader();
                  const parts: Uint8Array[] = [];
                  while (true) {
                    const { done, value } = await reader.read();
                    if (done) break;
                    parts.push(value);
                  }
                  buffer = Buffer.concat(parts);
                } else if (typeof output === 'string') {
                  const response = await axios.get(output, { responseType: 'arraybuffer' });
                  buffer = Buffer.from(response.data);
                } else if (Buffer.isBuffer(output)) {
                  buffer = output;
                } else {
                  const data = await (output as any).arrayBuffer?.() || output;
                  buffer = Buffer.from(data);
                }

                console.log(`  ✅ [Replicate] Chunk ${i + 1} completed: ${buffer.length} bytes`);
                break; // Success - exit retry loop
              } catch (error: any) {
                const is429 = isReplicateRateLimitError(error);
                console.error(`  ❌ [Replicate] Chunk ${i + 1} attempt ${attempt} failed: ${error.message}`);
                if (attempt < maxRetries) {
                  const retryAfter = is429 ? 12 : attempt * 3;
                  console.log(`  ⏳ Retrying in ${retryAfter}s...`);
                  await this.sleep(retryAfter * 1000);
                } else {
                  throw new Error(`REPLICATE ABORT: Chunk ${i + 1} failed after ${maxRetries} attempts: ${error.message}`);
                }
              }
            }

            audioBuffers.push(buffer!);
          }
        }

        elapsedMs = Date.now() - startTime;
        const elapsed = (elapsedMs / 1000).toFixed(1);

        const memAfterChunks = process.memoryUsage();
        console.log(`📊 [AudioWorker] Memory after chunks: RSS=${Math.round(memAfterChunks.rss / 1024 / 1024)}MB, Heap=${Math.round(memAfterChunks.heapUsed / 1024 / 1024)}MB`);

        console.log('\n' + '═'.repeat(70));
        console.log('✅ REPLICATE AUDIO GENERATION COMPLETE');
        console.log('═'.repeat(70));
        console.log(`  📊 Summary:`);
        console.log(`     • Total chunks: ${chunks.length}`);
        console.log(`     • Time elapsed: ${elapsed}s`);
        console.log(`     • Voice: ${voice?.displayName || voiceId} (${isTurboPreset ? 'Turbo preset' : 'Custom clone'})`);
        console.log(`     • Text length: ${text.length} chars`);
        console.log(`     • Provider: Replicate Chatterbox Turbo`);
        console.log('═'.repeat(70) + '\n');

        // ─────────────────────────────────────────────────────────────────────
        // SILENCE TRIMMING: Remove leading/trailing dead-air from each chunk
        // Chatterbox Turbo generates variable silence at chunk boundaries.
        // Without trimming, 10-20s gaps appear in the final audio.
        // ─────────────────────────────────────────────────────────────────────
        if (AUDIO_CONFIG.SILENCE_TRIM_ENABLED) {
          console.log(`\n✂️  [AudioWorker] Trimming silence from ${audioBuffers.length} chunks...`);
          const trimStart = Date.now();

          // Parallelize FFmpeg trimming to speed up processing
          // Limit to 3 concurrent trims so we don't blow memory (safe on 1GB VM) 
          const trimLimit = pLimit(3);
          const trimTasks = audioBuffers.map((buffer, i) => {
            return trimLimit(async () => {
              const before = buffer.length;
              audioBuffers[i] = await trimSilenceFromWav(buffer);
              const after = audioBuffers[i]!.length;
              if (before !== after) {
                console.log(`  ✂️  Chunk ${i + 1}: ${Math.round(before / 1024)}KB → ${Math.round(after / 1024)}KB`);
              }
            });
          });

          await Promise.all(trimTasks);

          const trimElapsed = ((Date.now() - trimStart) / 1000).toFixed(1);
          console.log(`✂️  [AudioWorker] Silence trimming done in ${trimElapsed}s`);
        }

        // INSERT INTER-CHUNK GAPS: Add controlled silence between chunks for natural flow
        const gapMs = AUDIO_CONFIG.INTER_CHUNK_GAP_MS;
        if (gapMs > 0 && audioBuffers.length > 1) {
          console.log(`🔇 [AudioWorker] Inserting ${gapMs}ms silence gaps between ${audioBuffers.length} chunks...`);
          const gapWav = buildSilenceWav(gapMs);
          const withGaps: Buffer[] = [];
          for (let i = 0; i < audioBuffers.length; i++) {
            withGaps.push(audioBuffers[i]!);
            if (i < audioBuffers.length - 1) {
              withGaps.push(gapWav);
            }
          }
          audioBuffers = withGaps;
        }

        // Concatenate and convert: MP3 only (QuickTime-safe default).
        const wavAudio = concatenateWavBuffers(audioBuffers);

        // ⚠️ MEMORY: Release chunk buffers immediately after concat - they're
        // no longer needed and can be 20-40MB for a long reading.
        audioBuffers.length = 0;

        mp3 = await convertWavToMp3(wavAudio);
        // Calculate duration from WAV header (sample rate, channels, bits per sample)
        const wavHeader = parseWavHeader(wavAudio);
        const bytesPerSecond = wavHeader
          ? wavHeader.sampleRate * wavHeader.numChannels * (wavHeader.bitsPerSample / 8)
          : 48000; // fallback: 24kHz mono 16-bit
        const dataSize = wavHeader ? wavHeader.dataSize : (wavAudio.length - 44);
        duration = Math.ceil(dataSize / bytesPerSecond);

        const memAfterStitch = process.memoryUsage();
        console.log(`📊 [AudioWorker] Memory after stitch+encode: RSS=${Math.round(memAfterStitch.rss / 1024 / 1024)}MB, Heap=${Math.round(memAfterStitch.heapUsed / 1024 / 1024)}MB`);

        console.log(
          `🎵 [AudioWorker] Final: ${Math.round(mp3.length / 1024)}KB MP3, ~${duration}s from ${chunks.length} chunks (Replicate)`
        );

      } // End Replicate block

      if (activeProvider === 'minimax') {
        // Log Minimax Cost asynchronously based on text length
        logMinimaxTtsCost(task.job_id, task.id, text.length, `AudioWorker: Minimax (${jobLang})`)
          .catch(e => console.error("⚠️ Failed to log Minimax cost", e));
      } else {
        // Log Replicate Cost based on elapsed total time
        logReplicateCost(task.job_id, task.id, elapsedMs, `AudioWorker: Replicate (${voiceId})`)
          .catch(e => console.error("⚠️ Failed to log Replicate cost", e));
      }

      return {
        success: true,
        output: {
          size: mp3.length,
          chunks: chunks.length,
          duration,
          provider: activeProvider,
          processingTime: elapsedMs,
          formats: ['mp3'],
        },
        artifacts: [
          {
            type: 'audio_mp3',
            buffer: mp3,
            contentType: 'audio/mpeg',
            metadata: {
              textLength: text.length,
              chunks: chunks.length,
              duration,
              format: 'mp3',
              provider: activeProvider,
              voice: task.input.voiceId || task.input.voice || 'david',
              voiceType: isTurboPreset ? 'turbo-preset' : 'custom-clone',
              docNum: task.input?.docNum,
              system: task.input?.system,
              docType: task.input?.docType,
            },
          },
        ],
      };

    } catch (error: any) {

      // Check if this is a Replicate abort
      const isReplicateAbort = error.message?.includes('REPLICATE ABORT');

      if (isReplicateAbort) {
        console.error('\n' + '═'.repeat(70));
        console.error('🚨 AUDIO GENERATION ABORTED DUE TO REPLICATE ERROR');
        console.error('═'.repeat(70));
        console.error(`Task ID: ${task.id}`);
        console.error(`Job ID: ${task.job_id}`);
        console.error(`Error: ${error.message}`);
        console.error('This task will be marked as FAILED.');
        console.error('The job will NOT continue with audio generation.');
        console.error('═'.repeat(70) + '\n');
      } else {
        console.error('❌ [AudioWorker] Failed:', error.message);
      }

      return { success: false, error: error.message };
    }
  }
}

if (require.main === module) {
  const worker = new AudioWorker();
  process.on('SIGTERM', () => worker.stop());
  process.on('SIGINT', () => worker.stop());

  worker.start().catch((error) => {
    console.error('Fatal worker error:', error);
    process.exit(1);
  });
}
