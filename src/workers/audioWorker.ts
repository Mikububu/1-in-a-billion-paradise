/**
 * AUDIO WORKER - TTS Generation with Text Chunking
 *
 * Processes audio_generation tasks:
 * - Reads text from Storage artifact (full reading ~8000 chars)
 * - Chunks text into 300-char segments (Chatterbox has input limits)
 * - Processes chunks SEQUENTIALLY via RunPod (respects concurrency limits)
 * - Concatenates WAV chunks into single audio
 * - Converts to MP3 (with M4A fallback)
 * - Uploads artifact to Supabase Storage
 * 
 * IMPORTANT: Chunks are processed sequentially, not in parallel, to avoid
 * overwhelming RunPod serverless endpoints which have hard concurrency limits.
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
import { logRunPodCost } from '../services/costTracking';
import { getVoiceById, isTurboPresetVoice } from '../config/voices';

const INTRO_SILENCE_SEC = 0.5; // Silence before intro starts
const POST_INTRO_SILENCE_SEC = 3.0; // Pause after intro ends (breath before reading)
const INTRO_SYSTEM_NAMES: Record<string, string> = {
  western: 'Western Astrology',
  vedic: 'Vedic Astrology',
  human_design: 'Human Design',
  gene_keys: 'Gene Keys',
  kabbalah: 'Kabbalah',
};

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
// Text Chunking (300 chars max to avoid Chatterbox truncation)
// ─────────────────────────────────────────────────────────────────────────────

function splitIntoChunks(text: string, maxChunkLength: number = 300): string[] {
  // Match sentences ending with punctuation, OR any remaining text at the end
  const sentenceRegex = /[^.!?]*[.!?]+|[^.!?]+$/g;
  const sentences = text.match(sentenceRegex) || [text];
  const chunks: string[] = [];
  let currentChunk = '';

  for (const sentence of sentences) {
    const trimmedSentence = sentence.trim();
    if (!trimmedSentence) continue;

    // If adding this sentence exceeds limit, save current chunk and start new one
    if (currentChunk && (currentChunk.length + 1 + trimmedSentence.length > maxChunkLength)) {
      chunks.push(currentChunk.trim());
      currentChunk = '';
    }

    // If single sentence exceeds limit, split at word boundaries
    if (trimmedSentence.length > maxChunkLength) {
      if (currentChunk) {
        chunks.push(currentChunk.trim());
        currentChunk = '';
      }
      const words = trimmedSentence.split(/\s+/);
      let wordChunk = '';
      for (const word of words) {
        if (wordChunk && (wordChunk.length + 1 + word.length > maxChunkLength)) {
          chunks.push(wordChunk.trim());
          wordChunk = '';
        }
        wordChunk = wordChunk ? `${wordChunk} ${word}` : word;
      }
      if (wordChunk) {
        currentChunk = wordChunk;
      }
    } else {
      currentChunk = currentChunk ? `${currentChunk} ${trimmedSentence}` : trimmedSentence;
    }
  }

  if (currentChunk.trim()) {
    chunks.push(currentChunk.trim());
  }

  return chunks.filter(c => c.length > 0);
}

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

function concatenateWavBuffers(buffers: Buffer[]): Buffer {
  if (buffers.length === 0) return Buffer.alloc(0);
  if (buffers.length === 1) return convertFloatWavToPcm(buffers[0]!);

  const audioDataChunks: Buffer[] = [];
  let sampleRate = 24000;
  let numChannels = 1;

  for (const buf of buffers) {
    const converted = convertFloatWavToPcm(buf);
    const header = parseWavHeader(converted);
    if (header) {
      sampleRate = header.sampleRate;
      numChannels = header.numChannels;
      audioDataChunks.push(converted.slice(header.dataOffset, header.dataOffset + header.dataSize));
    }
  }

  const totalDataSize = audioDataChunks.reduce((sum, chunk) => sum + chunk.length, 0);

  // Create WAV header
  const wavHeader = Buffer.alloc(44);
  wavHeader.write('RIFF', 0);
  wavHeader.writeUInt32LE(36 + totalDataSize, 4);
  wavHeader.write('WAVE', 8);
  wavHeader.write('fmt ', 12);
  wavHeader.writeUInt32LE(16, 16);
  wavHeader.writeUInt16LE(1, 20); // PCM
  wavHeader.writeUInt16LE(numChannels, 22);
  wavHeader.writeUInt32LE(sampleRate, 24);
  wavHeader.writeUInt32LE(sampleRate * numChannels * 2, 28);
  wavHeader.writeUInt16LE(numChannels * 2, 32);
  wavHeader.writeUInt16LE(16, 34);
  wavHeader.write('data', 36);
  wavHeader.writeUInt32LE(totalDataSize, 40);

  console.log(`WAV concatenation: ${buffers.length} chunks -> ${totalDataSize} bytes audio data`);
  return Buffer.concat([wavHeader, ...audioDataChunks]);
}

function buildSilenceWav(durationSec: number, sampleRate = 24000, numChannels = 1): Buffer {
  const totalSamples = Math.max(1, Math.round(durationSec * sampleRate));
  const pcmData = Buffer.alloc(totalSamples * numChannels * 2); // 16-bit PCM
  const wavHeader = Buffer.alloc(44);
  wavHeader.write('RIFF', 0);
  wavHeader.writeUInt32LE(36 + pcmData.length, 4);
  wavHeader.write('WAVE', 8);
  wavHeader.write('fmt ', 12);
  wavHeader.writeUInt32LE(16, 16);
  wavHeader.writeUInt16LE(1, 20);
  wavHeader.writeUInt16LE(numChannels, 22);
  wavHeader.writeUInt32LE(sampleRate, 24);
  wavHeader.writeUInt32LE(sampleRate * numChannels * 2, 28);
  wavHeader.writeUInt16LE(numChannels * 2, 32);
  wavHeader.writeUInt16LE(16, 34);
  wavHeader.write('data', 36);
  wavHeader.writeUInt32LE(pcmData.length, 40);
  return Buffer.concat([wavHeader, pcmData]);
}

function formatOrdinalDate(d: Date): string {
  const day = d.getDate();
  const month = d.toLocaleString('en-US', { month: 'long' });
  const year = d.getFullYear();
  const suffix =
    day % 10 === 1 && day % 100 !== 11 ? 'st' :
    day % 10 === 2 && day % 100 !== 12 ? 'nd' :
    day % 10 === 3 && day % 100 !== 13 ? 'rd' : 'th';
  return `${month} ${day}${suffix}, ${year}`;
}

export function buildIntroText(params: {
  person1Name: string;
  person2Name?: string | null;
  systems: string[];
  isSynastry: boolean;
  timestamp: Date;
}): string {
  const systems = params.systems.map((s) => INTRO_SYSTEM_NAMES[s] || s).join(', ');
  const ts = formatOrdinalDate(params.timestamp);
  if (params.isSynastry && params.person2Name) {
    return `This is an introduction to a personalized synastry reading for ${params.person1Name} and ${params.person2Name}, created through the lens of ${systems}. The reading was generated on ${ts} by the One in a Billion app and is powered by forbidden-yoga.com.`;
  }
  return `This is an introduction to a personalized soul reading for ${params.person1Name}, created through the lens of ${systems}. The reading was generated on ${ts} by the One in a Billion app and is powered by forbidden-yoga.com.`;
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

async function convertWavToM4a(wav: Buffer): Promise<Buffer> {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'iab-audio-'));
  const inPath = path.join(dir, 'in.wav');
  const outPath = path.join(dir, 'out.m4a');
  try {
    await fs.writeFile(inPath, wav);
    // Volume normalization (loudnorm) + AAC 96k — M4A primary, no MP3 fallback
    await runFfmpeg([
      '-i', inPath,
      '-vn',
      '-af', 'loudnorm=I=-16:TP=-1.5:LRA=11',
      '-c:a', 'aac',
      '-b:a', '96k',
      outPath
    ]);
    const m4a = await fs.readFile(outPath);
    console.log(`WAV->M4A (normalized): ${Math.round(wav.length / 1024)}KB -> ${Math.round(m4a.length / 1024)}KB`);
    return m4a;
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
      maxConcurrentTasks: 1, // One task per worker to avoid GPU memory contention
    });

    console.log(`🤖 AudioWorker SEQUENTIAL v1.0 initialized at ${new Date().toISOString()}`);

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

      // Chunk size (Turbo supports 500 chars, Original supports 300)
      // Using 450 as safe default to avoid end-of-audio issues
      const chunkSize = parseInt(process.env.CHATTERBOX_CHUNK_SIZE || '450', 10);

      // ─────────────────────────────────────────────────────────────────────
      // CHUNK TEXT (Turbo supports 500 chars, Original supports 300)
      // ─────────────────────────────────────────────────────────────────────
      const chunks = splitIntoChunks(text, chunkSize);
      console.log(`📦 [AudioWorker] Chunking ${text.length} chars -> ${chunks.length} chunks (max ${chunkSize} chars)`);

      // ─────────────────────────────────────────────────────────────────────
      // ALL VOICES NOW USE REPLICATE CHATTERBOX TURBO
      // - Turbo presets: Use `voice` parameter (Aaron, Abigail, etc.)
      // - Custom voices: Use `reference_audio` parameter (David, Elisabeth, etc.)
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
      const replicateToken = await apiKeys.replicate().catch(() => null) || env.REPLICATE_API_TOKEN;
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
      const temperature = voiceSettings.temperature ?? 0.7;
      const top_p = voiceSettings.top_p ?? 0.95;
      
      console.log(`🎤 [AudioWorker] Voice settings:`, { temperature, top_p, isTurboPreset });

      // Replicate chunk generator (works for both preset + custom voices)
      const generateChunkReplicate = async (chunk: string, index: number): Promise<Buffer> => {
        const maxRetries = 5; // Increased for rate limit retries
        for (let attempt = 1; attempt <= maxRetries; attempt++) {
          try {
            console.log(`  [Replicate] Chunk ${index + 1}/${chunks.length} (${chunk.length} chars) attempt ${attempt}`);
            
            // Build input with voice-specific settings
            const input: any = {
              text: chunk,
              temperature,
              top_p,
            };
            
            // TURBO PRESET: Use voice parameter
            if (isTurboPreset) {
              input.voice = voice?.turboVoiceId || 'alloy';
            }
            // CUSTOM VOICE: Use reference_audio parameter for voice cloning
            else {
              input.reference_audio = voice?.sampleAudioUrl || task.input.audioUrl || this.voiceSampleUrl;
              console.log(`  [Replicate] Custom voice cloning with reference_audio: ${input.reference_audio.substring(0, 80)}...`);
            }
            
            console.log(`  🎯 [Replicate] Calling API with model: resemble-ai/chatterbox-turbo`);
            console.log(`  📝 [Replicate] Input:`, JSON.stringify({
              ...input,
              text: `${input.text.substring(0, 50)}...`,
              reference_audio: input.reference_audio ? `${input.reference_audio.substring(0, 40)}...` : undefined
            }));
            
            const startTime = Date.now();
            
            // Add 5-minute timeout to prevent hanging forever
            const timeoutPromise = new Promise((_, reject) => 
              setTimeout(() => reject(new Error('Replicate API timeout after 5 minutes')), 300000)
            );
            
            const output = await Promise.race([
              replicate.run('resemble-ai/chatterbox-turbo', { input }),
              timeoutPromise
            ]);
            
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
              const is429 = error.message?.includes('429') || error.message?.includes('throttled') || error.message?.includes('rate limit');
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

      // Intro: spoken preface with brief silence before and after (narration only)
      let introBuffers: Buffer[] = [];
      try {
        if (supabase) {
          const { data: jobRow } = await supabase
            .from('jobs')
            .select('params, created_at, type')
            .eq('id', task.job_id)
            .single();
          const params: any = (jobRow as any)?.params || {};
          const person1Name = params?.person1?.name || 'Person 1';
          const person2Name = params?.person2?.name || null;
          const rawSystems: string[] = Array.isArray(params?.systems) && params.systems.length
            ? params.systems
            : ['western', 'vedic', 'human_design', 'gene_keys', 'kabbalah'];
          const docType = (task.input as any)?.docType || null;
          const isSynastry =
            (!!person2Name && (docType === 'overlay' || docType === 'verdict')) ||
            (jobRow as any)?.type === 'synastry';
          const isPerson2Doc = docType === 'person2' && !!person2Name;
          // For person2 docs, it's a solo reading about person2, NOT synastry
          const finalIsSynastry = isPerson2Doc ? false : isSynastry;
          const finalPerson2Name = isPerson2Doc ? null : (isSynastry ? person2Name : null);
          const introText = buildIntroText({
            person1Name: isPerson2Doc ? person2Name! : person1Name,
            person2Name: finalPerson2Name,
            systems: rawSystems,
            isSynastry: finalIsSynastry,
            timestamp: new Date(),
          });
          const introChunks = splitIntoChunks(introText, chunkSize);
          for (let i = 0; i < introChunks.length; i++) {
            const buf = await generateChunkReplicate(introChunks[i]!, i);
            introBuffers.push(buf);
          }
        }
      } catch (e) {
        console.warn('⚠️ [AudioWorker] Intro prep failed, continuing without intro:', (e as any)?.message || e);
        introBuffers = [];
      }

        // Generate all chunks with Replicate
        const startTime = Date.now();
        // Default to SEQUENTIAL mode for rate limit safety
        const useParallelMode = process.env.AUDIO_PARALLEL_MODE === 'true';
        const concurrentLimit = parseInt(process.env.AUDIO_CONCURRENT_LIMIT || '2', 10);
        // Inter-chunk delay to respect Replicate rate limits (6 req/min with <$5 credit)
        const chunkDelayMs = parseInt(process.env.REPLICATE_CHUNK_DELAY_MS || '11000', 10);
        
        let audioBuffers: Buffer[] = [];

        if (useParallelMode) {
          console.log(`🚀 [AudioWorker] Starting PARALLEL Replicate generation of ${chunks.length} chunks (limit: ${concurrentLimit})...`);
          console.warn(`⚠️  PARALLEL mode may hit rate limits. Consider AUDIO_PARALLEL_MODE=false for safer generation.`);
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
          for (let i = 0; i < chunks.length; i++) {
            const buffer = await generateChunkReplicate(chunks[i]!, i);
            audioBuffers.push(buffer);
            
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

      // Concatenate and convert to M4A (primary format only, no MP3 fallback)
      const silence = buildSilenceWav(INTRO_SILENCE_SEC);
      const postIntroSilence = buildSilenceWav(POST_INTRO_SILENCE_SEC);
      const wavAudio = introBuffers.length
        ? concatenateWavBuffers([silence, ...introBuffers, postIntroSilence, ...audioBuffers])
        : concatenateWavBuffers(audioBuffers);
      const m4a = await convertWavToM4a(wavAudio);
      const duration = Math.ceil((wavAudio.length - 44) / 48000);

      console.log(`🎵 [AudioWorker] Final: ${Math.round(m4a.length / 1024)}KB M4A, ~${duration}s from ${chunks.length} chunks (Replicate)`);

      return {
        success: true,
        output: {
          size: m4a.length,
          chunks: chunks.length,
          duration,
          provider: 'replicate',
          processingTime: elapsedMs,
        },
        artifacts: [
          {
            type: 'audio_m4a',
            buffer: m4a,
            contentType: 'audio/mp4',
            metadata: {
              textLength: text.length,
              chunks: chunks.length,
              duration,
              format: 'm4a',
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
