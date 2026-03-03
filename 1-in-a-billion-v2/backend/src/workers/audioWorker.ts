/**
 * AUDIO WORKER - TTS Generation with Text Chunking
 *
 * Processes audio_generation tasks:
 * - Reads text from Storage artifact (full reading ~8000 chars)
 * - Chunks text into 450-char segments (Chatterbox has input limits)
 * - Processes chunks SEQUENTIALLY via Replicate (respects rate limits)
 * - Concatenates WAV chunks into single audio
 * - Converts to MP3 (Mac-safe default)
 * - Uploads artifact to Supabase Storage
 * 
 * IMPORTANT: Chunks are processed sequentially, not in parallel, to avoid
 * overwhelming Replicate API rate limits.
 */

import axios from 'axios';
import { spawn } from 'child_process';
import fs from 'fs/promises';
import os from 'os';
import path from 'path';
import Replicate from 'replicate';
import { BaseWorker, TaskResult } from './baseWorker';
import { JobTask, supabase } from '../services/supabaseClient';
import { env } from '../config/env';
import { apiKeys } from '../services/apiKeysHelper';
import { clearApiKeyCache } from '../services/apiKeys';
import { getVoiceById, isTurboPresetVoice } from '../config/voices';
import { getSystemDisplayName } from '../config/systemConfig';
import { cleanupTextForTTS } from '../utils/textCleanup';
import {
  splitIntoChunks,
  concatenateWavBuffers,
  AUDIO_CONFIG,
  dedupeAdjacentSentences,
  dedupeChunkBoundaryOverlap,
  trimSilenceFromWav,
  buildSilenceWav,
} from '../services/audioProcessing';
import { getVoiceConfig, hasVoiceSupport } from '../i18n/voiceRegistry';
import { getChunkConfig } from '../i18n/chunkRules';
import { parseLanguage, type OutputLanguage } from '../config/languages';
import {
  isReplicateRateLimitError,
  runReplicateWithRateLimit,
} from '../services/replicateRateLimiter';

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

type AudioPersonMeta = {
  name?: string;
  birthDate?: string;
  birthTime?: string;
  birthPlace?: string;
  timezone?: string;
};

function formatReadableDate(input?: string): string {
  const raw = String(input || '').trim();
  if (!raw) return '';

  const m = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (m) {
    const y = Number(m[1]);
    const mo = Number(m[2]) - 1;
    const d = Number(m[3]);
    const dt = new Date(Date.UTC(y, mo, d));
    return dt.toLocaleDateString('en-GB', {
      day: '2-digit',
      month: 'long',
      year: 'numeric',
      timeZone: 'UTC',
    });
  }

  const dt = new Date(raw);
  if (!Number.isNaN(dt.getTime())) {
    return dt.toLocaleDateString('en-GB', {
      day: '2-digit',
      month: 'long',
      year: 'numeric',
    });
  }

  return raw;
}

function inferDocType(task: JobTask): 'person1' | 'person2' | 'overlay' | 'verdict' {
  const inputDocType = String(task.input?.docType || '').toLowerCase();
  if (inputDocType === 'person2') return 'person2';
  if (inputDocType === 'overlay') return 'overlay';
  if (inputDocType === 'verdict') return 'verdict';
  if (inputDocType === 'person1' || inputDocType === 'individual') return 'person1';

  const title = String(task.input?.title || '').toLowerCase();
  if (title.includes('verdict')) return 'verdict';
  if (title.includes('&') || title.includes('synastry') || title.includes('overlay')) return 'overlay';
  return 'person1';
}

function buildSpokenIntro(options: {
  system?: string;
  docType: 'person1' | 'person2' | 'overlay' | 'verdict';
  person1?: AudioPersonMeta;
  person2?: AudioPersonMeta;
}): string {
  const system = String(options.system || 'western').toLowerCase();
  const systemName = getSystemDisplayName(system);
  const generatedOn = new Date().toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  });

  const p1 = options.person1 || {};
  const p2 = options.person2 || {};
  const p1Name = String(p1.name || 'Person 1').trim();
  const p2Name = String(p2.name || 'Person 2').trim();
  const p1Date = formatReadableDate(p1.birthDate);
  const p2Date = formatReadableDate(p2.birthDate);
  // Use birthPlace (city name) only. Never fall back to timezone strings
  // like "Europe/Vienna" which are misleading in spoken intros.
  const p1Place = String(p1.birthPlace || '').trim();
  const p2Place = String(p2.birthPlace || '').trim();
  const p1Time = String(p1.birthTime || '').trim();
  const p2Time = String(p2.birthTime || '').trim();

  if (options.docType === 'verdict') {
    return `This is the final verdict reading for ${p1Name} and ${p2Name}, synthesizing all five systems. Generated on ${generatedOn} by 1 in a billion app, powered by forbidden-yoga dot com.`;
  }

  if (options.docType === 'overlay') {
    const p1Line = `${p1Name} was born on ${p1Date || 'an unknown date'}${p1Time ? ` at ${p1Time}` : ''}${p1Place ? ` in ${p1Place}` : ''}.`;
    const p2Line = `${p2Name} was born on ${p2Date || 'an unknown date'}${p2Time ? ` at ${p2Time}` : ''}${p2Place ? ` in ${p2Place}` : ''}.`;
    return `This is a ${systemName} compatibility reading for ${p1Name} and ${p2Name}. ${p1Line} ${p2Line} Generated on ${generatedOn} by 1 in a billion app, powered by forbidden-yoga dot com.`;
  }

  const subject = options.docType === 'person2' ? p2 : p1;
  const subjectName = String(subject.name || (options.docType === 'person2' ? p2Name : p1Name)).trim();
  const birthDate = formatReadableDate(subject.birthDate);
  const birthPlace = String(subject.birthPlace || '').trim();
  const birthTime = String(subject.birthTime || '').trim();

  return `This is a ${systemName} reading for ${subjectName}, born on ${birthDate || 'an unknown date'}${birthTime ? ` at ${birthTime}` : ''}${birthPlace ? ` in ${birthPlace}` : ''}. Generated on ${generatedOn} by 1 in a billion app, powered by forbidden-yoga dot com.`;
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
      maxConcurrentTasks: 3, // Allow pulling all 3 audio tasks for a reading at the same time
    });

    console.log(`🤖 AudioWorker PARALLEL initialized at ${new Date().toISOString()}`);

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
      let cleanedText = cleanupTextForTTS(originalText);
      const dedupResult = dedupeAdjacentSentences(cleanedText);
      cleanedText = dedupResult.text;
      if (dedupResult.removed > 0) {
        console.warn(`⚠️ [AudioWorker] Removed ${dedupResult.removed} adjacent duplicate sentence(s) from source text before TTS.`);
      }

      // Build spoken intro and prepend to narration.
      const resolvedDocType = inferDocType(task);
      const intro = buildSpokenIntro({
        system: task.input?.system,
        docType: resolvedDocType,
        person1: person1Meta,
        person2: person2Meta,
      });
      text = `${intro}\n\n${cleanedText}`.trim();

      // Chunk size — language-aware (Chinese needs shorter chunks, etc.)
      const jobLang: OutputLanguage = (this as any)._jobOutputLanguage || 'en';
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
      // English -> Chatterbox Turbo (existing pipeline, fastest)
      // DE/ES/FR/ZH -> Chatterbox Multilingual (language_id param)
      // ─────────────────────────────────────────────────────────────────────
      const voiceConfig = getVoiceConfig(jobLang);
      if (!hasVoiceSupport(jobLang)) {
        console.warn(`⚠️ [AudioWorker] No TTS voice configured for ${jobLang} — skipping audio generation.`);
        return { success: true, output: { skippedAudio: true, reason: `no_voice_for_${jobLang}` } };
      }
      const useMultilingual = voiceConfig.provider === 'chatterbox-multilingual';
      if (useMultilingual) {
        console.log(`🌍 [AudioWorker] Using Chatterbox Multilingual for ${jobLang} (language_id: ${voiceConfig.languageId})`);
      }

      // ─────────────────────────────────────────────────────────────────────
      // CHATTERBOX TTS GENERATION
      // - Turbo (English): `voice` param or `reference_audio` for cloning
      // - Multilingual (DE/ES/FR/ZH): `language_id` + `reference_audio`
      // ─────────────────────────────────────────────────────────────────────
      console.log('\n' + '═'.repeat(70));
      console.log('🎵 REPLICATE AUDIO GENERATION STARTING');
      console.log('═'.repeat(70));

      const voiceId = task.input.voiceId || task.input.voice || 'david';
      const voice = getVoiceById(voiceId);
      const isTurboPreset = voice?.isTurboPreset || false;


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

      // Replicate chunk generator (works for both preset + custom voices)
      const generateChunkReplicate = async (chunk: string, index: number): Promise<Buffer> => {
        const maxRetries = Math.max(1, parseInt(process.env.REPLICATE_CHUNK_MAX_RETRIES || '6', 10));
        for (let attempt = 1; attempt <= maxRetries; attempt++) {
          try {
            console.log(`  [Replicate] Chunk ${index + 1}/${chunks.length} (${chunk.length} chars) attempt ${attempt}`);

            // Determine which Replicate model to call
            const replicateModel = useMultilingual
              ? 'resemble-ai/chatterbox-multilingual'
              : 'resemble-ai/chatterbox-turbo';

            // Build input — completely separate param sets for each model
            let input: any;

            if (useMultilingual) {
              // MULTILINGUAL MODEL: different API schema from Turbo
              // Params: text_to_synthesize (max 300 chars), language_id, reference_audio,
              //         exaggeration (0.25-2.0), cfg_weight (0.2-1.0, use 0.0 for cross-lang), temperature
              // Does NOT accept: text, top_p, repetition_penalty, voice
              const refAudio = voice?.sampleAudioUrl || task.input.audioUrl || this.voiceSampleUrl;
              input = {
                text_to_synthesize: chunk,
                language_id: voiceConfig.languageId,
                exaggeration: 0.5,
                cfg_weight: 0.0,   // 0.0 = best for cross-language voice transfer
                temperature: temperature,
              };
              if (refAudio) {
                input.reference_audio = refAudio;
                console.log(`  [Replicate] Multilingual voice cloning (${voiceConfig.languageId}) with reference: ${refAudio.substring(0, 80)}...`);
              }
            } else if (isTurboPreset) {
              // TURBO PRESET: Use voice parameter (English only)
              input = {
                text: chunk,
                temperature,
                top_p,
                repetition_penalty,
                voice: voice?.turboVoiceId || 'alloy',
              };
            } else {
              // CUSTOM VOICE (Turbo with cloning): Use reference_audio
              const refAudio = voice?.sampleAudioUrl || task.input.audioUrl || this.voiceSampleUrl;
              input = {
                text: chunk,
                temperature,
                top_p,
                repetition_penalty,
                reference_audio: refAudio,
              };
              console.log(`  [Replicate] Custom voice cloning with reference_audio: ${refAudio?.substring(0, 80)}...`);
            }

            console.log(`  🎯 [Replicate] Calling API with model: ${replicateModel}`);
            const textPreview = (input.text || input.text_to_synthesize || '').substring(0, 50);
            console.log(`  📝 [Replicate] Input:`, JSON.stringify({
              ...input,
              text: input.text ? `${textPreview}...` : undefined,
              text_to_synthesize: input.text_to_synthesize ? `${textPreview}...` : undefined,
              reference_audio: input.reference_audio ? `${input.reference_audio.substring(0, 40)}...` : undefined
            }));

            const startTime = Date.now();

            // Call Replicate API with hard timeout to avoid hung chunks.
            const chunkTimeoutMs = parseInt(process.env.REPLICATE_CHUNK_TIMEOUT_MS || '120000', 10);
            const output = await runReplicateWithRateLimit(
              `audioWorker:chunk:${index + 1}`,
              () =>
                withTimeout(
                  replicate.run(replicateModel as `${string}/${string}`, { input }),
                  chunkTimeoutMs,
                  `Replicate chunk ${index + 1}`
                )
            );

            const elapsed = ((Date.now() - startTime) / 1000).toFixed(2);
            console.log(`  ⏱️  [Replicate] API call completed in ${elapsed}s`);


            console.log(`  📦 [Replicate] Response type: ${typeof output}, isStream: ${output instanceof ReadableStream}, isBuffer: ${Buffer.isBuffer(output)}, isString: ${typeof output === 'string'}`);

            // Output is a ReadableStream or URL - handle both
            let audioBuffer: Buffer;
            if (output instanceof ReadableStream || (output as any).getReader) {
              console.log(`  🌊 [Replicate] Processing as ReadableStream...`);
              // It's a stream
              const reader = (output as ReadableStream).getReader();
              const chunks: Uint8Array[] = [];
              while (true) {
                const { done, value } = await reader.read();
                if (done) break;
                chunks.push(value);
              }
              audioBuffer = Buffer.concat(chunks);
              console.log(`  ✅ [Replicate] Stream processed: ${chunks.length} chunks, ${audioBuffer.length} bytes`);
            } else if (typeof output === 'string') {
              // It's a URL - fetch it
              console.log(`  🔗 [Replicate] Processing as URL: ${(output as string).substring(0, 60)}...`);
              const response = await axios.get(output, { responseType: 'arraybuffer' });
              audioBuffer = Buffer.from(response.data);
              console.log(`  ✅ [Replicate] URL fetched: ${audioBuffer.length} bytes`);
            } else if (Buffer.isBuffer(output)) {
              console.log(`  📦 [Replicate] Direct buffer received: ${output.length} bytes`);
              audioBuffer = output;
            } else {
              // Try to read as stream-like object
              console.log(`  ⚠️  [Replicate] Unknown output type, attempting arrayBuffer conversion...`);
              const data = await (output as any).arrayBuffer?.() || output;
              audioBuffer = Buffer.from(data);
              console.log(`  ✅ [Replicate] Converted to buffer: ${audioBuffer.length} bytes`);
            }

            console.log(`  ✅ [Replicate] Chunk ${index + 1} completed: ${audioBuffer.length} bytes`);
            return audioBuffer;

          } catch (error: any) {
            const is429 = isReplicateRateLimitError(error);
            const isAuthError = error.message?.includes('401') || error.message?.includes('authentication') || error.message?.includes('Unauthorized');
            const isBadRequest = error.message?.includes('400') || error.message?.includes('422') || error.message?.includes('invalid');

            // Parse retry_after from error message if present
            let retryAfter = attempt * 3; // default exponential backoff
            if (is429) {
              const retryMatch = error.message.match(/"retry_after":(\d+)/);
              if (retryMatch) {
                retryAfter = Math.max(parseInt(retryMatch[1]) + 1, retryAfter);
              } else {
                // Replicate rate limit: 6 req/min with <$5 credit = ~10s between requests
                retryAfter = 12;
              }
            }

            console.error(`  ❌ [Replicate] Chunk ${index + 1} attempt ${attempt} failed: ${error.message}`);

            // ABORT IMMEDIATELY on auth or bad request errors (no retry)
            if (isAuthError || isBadRequest) {
              console.error(`\n${'═'.repeat(70)}`);
              console.error(`🚨 CRITICAL REPLICATE ERROR - ABORTING ENTIRE JOB`);
              console.error(`${'═'.repeat(70)}`);
              console.error(`Error Type: ${isAuthError ? 'Authentication' : 'Bad Request'}`);
              console.error(`Message: ${error.message}`);
              console.error(`Chunk: ${index + 1}/${chunks.length}`);
              console.error(`${'═'.repeat(70)}\n`);
              throw new Error(`REPLICATE ABORT: ${error.message}`);
            }

            if (attempt < maxRetries) {
              console.log(`  ⏳ Retrying in ${retryAfter}s...${is429 ? ' (rate limited)' : ''}`);
              await this.sleep(retryAfter * 1000);
            } else {
              console.error(`\n${'═'.repeat(70)}`);
              console.error(`🚨 REPLICATE FAILED AFTER ${maxRetries} ATTEMPTS - ABORTING JOB`);
              console.error(`${'═'.repeat(70)}`);
              console.error(`Chunk: ${index + 1}/${chunks.length}`);
              console.error(`Error: ${error.message}`);
              console.error(`${'═'.repeat(70)}\n`);
              throw new Error(`REPLICATE ABORT: Chunk ${index + 1} failed after ${maxRetries} attempts: ${error.message}`);
            }
          }
        }
        throw new Error(`Chunk ${index + 1} exhausted retries`);
      };

      // Spoken intro is prepended above via buildSpokenIntro.

      // Generate all chunks with Replicate
      const startTime = Date.now();
      // Default to SEQUENTIAL mode for rate limit safety
      const useParallelMode = process.env.AUDIO_PARALLEL_MODE === 'true';
      const concurrentLimit = parseInt(process.env.AUDIO_CONCURRENT_LIMIT || '2', 10);
      // Optional extra spacing (shared limiter already enforces pacing).
      const chunkDelayMs = parseInt(process.env.REPLICATE_CHUNK_DELAY_MS || '0', 10);

      let audioBuffers: Buffer[] = [];

      if (useParallelMode) {
        console.log(`🚀 [AudioWorker] Starting PARALLEL Replicate generation of ${chunks.length} chunks (limit: ${concurrentLimit})...`);
        console.warn(`⚠️  PARALLEL mode enabled; shared Replicate limiter will serialize API calls per process.`);
        const pLimit = (await import('p-limit')).default;
        const limit = pLimit(concurrentLimit);

        const promises = chunks.map((chunk, index) =>
          limit(async () => {
            const buffer = await generateChunkReplicate(chunk, index);
            // Add delay between parallel batches
            if (chunkDelayMs > 0) await this.sleep(chunkDelayMs);
            return { index, buffer };
          })
        );

        const results = await Promise.all(promises);
        results.sort((a, b) => a.index - b.index);
        audioBuffers = results.map(r => r.buffer);
      } else {
        console.log(`🚀 [AudioWorker] Starting SEQUENTIAL Replicate generation of ${chunks.length} chunks (${chunkDelayMs}ms delay)...`);
        const generationStartTime = Date.now();
        for (let i = 0; i < chunks.length; i++) {
          const chunkStartTime = Date.now();
          console.log(`\n${'═'.repeat(70)}`);
          console.log(`🎵 [AudioWorker] Chunk ${i + 1}/${chunks.length} (${chunks[i]!.length} chars)`);
          console.log(`   Preview: ${chunks[i]!.substring(0, 80)}...`);
          console.log(`${'═'.repeat(70)}\n`);

          const buffer = await generateChunkReplicate(chunks[i]!, i);
          audioBuffers.push(buffer);

          const chunkElapsed = ((Date.now() - chunkStartTime) / 1000).toFixed(1);
          const totalElapsed = ((Date.now() - generationStartTime) / 1000 / 60).toFixed(1);
          const avgTimePerChunk = ((Date.now() - generationStartTime) / 1000 / (i + 1)).toFixed(1);
          const estimatedRemaining = ((chunks.length - i - 1) * parseFloat(avgTimePerChunk) / 60).toFixed(1);
          console.log(`✅ [AudioWorker] Chunk ${i + 1}/${chunks.length} done in ${chunkElapsed}s | Total: ${totalElapsed}m | Est. remaining: ${estimatedRemaining}m`);

          // Add delay between chunks (except after last chunk)
          if (i < chunks.length - 1 && chunkDelayMs > 0) {
            console.log(`  ⏱️  Waiting ${chunkDelayMs}ms before next chunk (rate limit pacing)...`);
            await this.sleep(chunkDelayMs);
          }
        }
      }

      const elapsedMs = Date.now() - startTime;
      const elapsed = (elapsedMs / 1000).toFixed(1);

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
        for (let i = 0; i < audioBuffers.length; i++) {
          const before = audioBuffers[i]!.length;
          audioBuffers[i] = await trimSilenceFromWav(audioBuffers[i]!);
          const after = audioBuffers[i]!.length;
          if (before !== after) {
            console.log(`  ✂️  Chunk ${i + 1}: ${Math.round(before / 1024)}KB → ${Math.round(after / 1024)}KB`);
          }
        }
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
      const mp3 = await convertWavToMp3(wavAudio);
      // Calculate duration from WAV header (sample rate, channels, bits per sample)
      const wavHeader = parseWavHeader(wavAudio);
      const bytesPerSecond = wavHeader
        ? wavHeader.sampleRate * wavHeader.numChannels * (wavHeader.bitsPerSample / 8)
        : 48000; // fallback: 24kHz mono 16-bit
      const dataSize = wavHeader ? wavHeader.dataSize : (wavAudio.length - 44);
      const duration = Math.ceil(dataSize / bytesPerSecond);

      console.log(
        `🎵 [AudioWorker] Final: ${Math.round(mp3.length / 1024)}KB MP3, ~${duration}s from ${chunks.length} chunks (Replicate)`
      );

      return {
        success: true,
        output: {
          size: mp3.length,
          chunks: chunks.length,
          duration,
          provider: 'replicate',
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
              provider: 'replicate',
              voice: voiceId,
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
