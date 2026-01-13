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
import { BaseWorker, TaskResult } from './baseWorker';
import { JobTask, supabase } from '../services/supabaseClient';
import { env } from '../config/env';
import { apiKeys } from '../services/apiKeysHelper';

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
    await runFfmpeg(['-i', inPath, '-vn', '-c:a', 'libmp3lame', '-b:a', '128k', outPath]);
    const mp3 = await fs.readFile(outPath);
    console.log(`WAV->MP3: ${Math.round(wav.length / 1024)}KB -> ${Math.round(mp3.length / 1024)}KB`);
    return mp3;
  } finally {
    await fs.rm(dir, { recursive: true, force: true }).catch(() => { });
  }
}

async function convertWavToM4a(wav: Buffer): Promise<Buffer> {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'iab-audio-'));
  const inPath = path.join(dir, 'in.wav');
  const outPath = path.join(dir, 'out.m4a');
  try {
    await fs.writeFile(inPath, wav);
    await runFfmpeg(['-i', inPath, '-vn', '-c:a', 'aac', '-b:a', '128k', outPath]);
    return await fs.readFile(outPath);
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
      maxConcurrentTasks: 2, // Reduced to avoid overwhelming RunPod
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
        // #region agent log
        fetch('http://127.0.0.1:7242/ingest/c57797a3-6ffd-4efa-8ba1-8119a00b829d',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'audioWorker.ts:287',message:'Downloading text from storage',data:{taskId:task.id,storagePath},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'D'})}).catch(()=>{});
        // #endregion
        const { data, error } = await supabase.storage.from('job-artifacts').download(storagePath);
        if (error || !data) {
          // #region agent log
          fetch('http://127.0.0.1:7242/ingest/c57797a3-6ffd-4efa-8ba1-8119a00b829d',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'audioWorker.ts:290',message:'Storage download failed',data:{taskId:task.id,storagePath,errorMessage:error?.message,errorCode:error?.statusCode,errorDetails:JSON.stringify(error)},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'D'})}).catch(()=>{});
          // #endregion
          return { success: false, error: `Download failed: ${error?.message}` };
        }

        text = Buffer.from(await data.arrayBuffer()).toString('utf-8');
        console.log(`✅ [AudioWorker] Downloaded ${text.length} chars`);
        // #region agent log
        fetch('http://127.0.0.1:7242/ingest/c57797a3-6ffd-4efa-8ba1-8119a00b829d',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'audioWorker.ts:294',message:'Storage download succeeded',data:{taskId:task.id,storagePath,textLength:text.length},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'D'})}).catch(()=>{});
        // #endregion
      }

      if (!text) {
        return { success: false, error: 'No text found' };
      }

      // ─────────────────────────────────────────────────────────────────────
      // CHUNK TEXT (Chatterbox has ~300 char limit before truncation)
      // ─────────────────────────────────────────────────────────────────────
      const chunkSize = parseInt(process.env.CHATTERBOX_CHUNK_SIZE || '300', 10);
      const chunks = splitIntoChunks(text, chunkSize);
      console.log(`📦 [AudioWorker] Chunking ${text.length} chars -> ${chunks.length} chunks (max ${chunkSize} chars)`);

      // ─────────────────────────────────────────────────────────────────────
      // FETCH RUNPOD KEYS FROM SUPABASE (with env fallback)
      // Always try Supabase first - env fallback only if Supabase returns null
      // ─────────────────────────────────────────────────────────────────────
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/c57797a3-6ffd-4efa-8ba1-8119a00b829d',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'audioWorker.ts:312',message:'Fetching RunPod keys',data:{taskId:task.id,jobId:task.job_id},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
      // #endregion
      let runpodKey = await apiKeys.runpod().catch(() => null);
      if (!runpodKey) {
        console.warn('⚠️ [AudioWorker] Supabase api_keys lookup failed, using env fallback');
        runpodKey = this.runpodApiKey;
      }
      let runpodEndpoint = await apiKeys.runpodEndpoint().catch(() => null);
      if (!runpodEndpoint) {
        console.warn('⚠️ [AudioWorker] Supabase api_keys lookup failed for endpoint, using env fallback');
        runpodEndpoint = this.runpodEndpointId;
      }
      
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/c57797a3-6ffd-4efa-8ba1-8119a00b829d',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'audioWorker.ts:325',message:'RunPod keys retrieved',data:{hasKey:!!runpodKey,hasEndpoint:!!runpodEndpoint,endpointId:runpodEndpoint,keySource:runpodKey===this.runpodApiKey?'env':'supabase',endpointSource:runpodEndpoint===this.runpodEndpointId?'env':'supabase',keyLength:runpodKey?.length,endpointLength:runpodEndpoint?.length},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
      // #endregion
      
      if (!runpodKey || !runpodEndpoint) {
        throw new Error('RunPod API key or endpoint ID not found (check Supabase api_keys table or .env)');
      }

      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/c57797a3-6ffd-4efa-8ba1-8119a00b829d',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'audioWorker.ts:330',message:'RunPod configuration validated',data:{endpointId:runpodEndpoint,constructedUrl:`https://api.runpod.ai/v2/${runpodEndpoint}/runsync`},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
      // #endregion

      // ─────────────────────────────────────────────────────────────────────
      // GENERATE AUDIO FOR EACH CHUNK (SEQUENTIAL - respects RunPod limits)
      // ─────────────────────────────────────────────────────────────────────
      const generateChunk = async (chunk: string, index: number): Promise<Buffer> => {
        const maxRetries = 3;
        for (let attempt = 1; attempt <= maxRetries; attempt++) {
          try {
            console.log(`  Chunk ${index + 1}/${chunks.length} (${chunk.length} chars) attempt ${attempt}`);

            const runpodUrl = `https://api.runpod.ai/v2/${runpodEndpoint}/run`;
            // #region agent log
            fetch('http://127.0.0.1:7242/ingest/c57797a3-6ffd-4efa-8ba1-8119a00b829d',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'audioWorker.ts:339',message:'Making RunPod request',data:{chunkIndex:index+1,totalChunks:chunks.length,attempt,url:runpodUrl,endpointId:runpodEndpoint,endpointIdLength:runpodEndpoint?.length,chunkLength:chunk.length,chunkPreview:chunk.substring(0,50)},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'B'})}).catch(()=>{});
            // #endregion
            const response = await axios.post(
              runpodUrl,
              {
                input: {
                  text: chunk,
                  audio_url: task.input.audioUrl || this.voiceSampleUrl,
                  exaggeration: task.input.exaggeration || 0.3,
                  cfg_weight: 0.5,
                },
              },
              {
                headers: {
                  Authorization: `Bearer ${runpodKey}`,
                  'Content-Type': 'application/json',
                },
                timeout: 10000, // Reduced timeout since we're using async /run endpoint
              }
            );
            // #region agent log
            fetch('http://127.0.0.1:7242/ingest/c57797a3-6ffd-4efa-8ba1-8119a00b829d',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'audioWorker.ts:353',message:'RunPod request succeeded',data:{chunkIndex:index+1,status:response.status,hasData:!!response.data,dataKeys:Object.keys(response.data||{}),hasId:!!response.data?.id,hasStatus:!!response.data?.status},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'B'})}).catch(()=>{});
            // #endregion

            const data = response.data || {};

            // Handle async RunPod job (returns {id, status} instead of immediate result)
            if (data.id && data.status && data.status !== 'COMPLETED') {
              console.log(`  ⏳ RunPod async job ${data.id}, status: ${data.status}, polling...`);
              // Poll for completion
              // Increased to 60 minutes to handle RunPod cold starts (was 10 min)
              const maxPollAttempts = 720; // 720 * 5s = 60 minutes max (handles cold starts)
              for (let pollAttempt = 0; pollAttempt < maxPollAttempts; pollAttempt++) {
                await this.sleep(5000); // Poll every 5 seconds (reduce API load)
                try {
                  const statusResp = await axios.get(
                    `https://api.runpod.ai/v2/${runpodEndpoint}/status/${data.id}`,
                    {
                      headers: { Authorization: `Bearer ${runpodKey}` },
                      timeout: 15000,
                    }
                  );
                  const statusData = statusResp.data || {};

                  // Log status every 10 attempts for debugging
                  if (pollAttempt % 10 === 0) {
                    console.log(`  🔍 Poll attempt ${pollAttempt + 1}/${maxPollAttempts}: status=${statusData.status}`);
                  }

                  if (statusData.status === 'COMPLETED') {
                    console.log(`  ✅ RunPod job ${data.id} completed after ${(pollAttempt + 1) * 5}s`);
                    // Result is in the same response
                    if (statusData.output?.audio_base64) {
                      console.log(`  ✅ Chunk ${index + 1} done (async base64)`);
                      return Buffer.from(statusData.output.audio_base64, 'base64');
                    }
                    if (statusData.output?.audio_url) {
                      const audioResp = await axios.get<ArrayBuffer>(statusData.output.audio_url, {
                        responseType: 'arraybuffer',
                        timeout: 60000,
                      });
                      const buf = Buffer.from(audioResp.data);
                      console.log(`  ✅ Chunk ${index + 1} done (async audio_url, ${buf.length} bytes)`);
                      return buf;
                    }
                    throw new Error(`RunPod job completed but no audio in result. Response keys: ${Object.keys(statusData).join(', ')}`);
                  } else if (statusData.status === 'FAILED') {
                    throw new Error(`RunPod job failed: ${statusData.error || JSON.stringify(statusData)}`);
                  }
                  // Continue polling for IN_QUEUE, IN_PROGRESS, etc.
                } catch (pollError: any) {
                  // Don't fail on individual poll errors, just log and retry
                  if (pollAttempt % 10 === 0) {
                    console.log(`  ⚠️ Poll error (attempt ${pollAttempt + 1}): ${pollError.message}`);
                  }
                  if (pollAttempt === maxPollAttempts - 1) {
                    throw new Error(`Polling failed: ${pollError.message}`);
                  }
                }
              }
              throw new Error(`RunPod job ${data.id} timed out after ${maxPollAttempts * 5}s (status remained: ${data.status})`);
            }

            // Handle synchronous response (immediate result)
            if (data?.output?.audio_base64) {
              console.log(`  ✅ Chunk ${index + 1} done`);
              return Buffer.from(data.output.audio_base64, 'base64');
            }

            // Check alternative response structures
            if (data?.audio_base64) {
              console.log(`  ✅ Chunk ${index + 1} done (direct audio_base64)`);
              return Buffer.from(data.audio_base64, 'base64');
            }
            if (data?.output?.audio) {
              console.log(`  ✅ Chunk ${index + 1} done (audio field)`);
              return Buffer.from(data.output.audio, 'base64');
            }

            const audioUrl =
              data?.output?.audio_url ||
              data?.audio_url ||
              data?.output?.url ||
              data?.url;
            if (audioUrl && typeof audioUrl === 'string') {
              try {
                console.log(`  🌐 Fetching audio_url for chunk ${index + 1}`);
                const audioResp = await axios.get<ArrayBuffer>(audioUrl, {
                  responseType: 'arraybuffer',
                  timeout: 60000,
                });
                const buf = Buffer.from(audioResp.data);
                console.log(`  ✅ Chunk ${index + 1} done (downloaded audio_url, ${buf.length} bytes)`);
                return buf;
              } catch (e: any) {
                console.log(`  ⚠️ audio_url fetch failed: ${e.message}`);
              }
            }

            throw new Error(data?.error || `No audio_base64 in response. Response keys: ${Object.keys(data || {}).join(', ')}`);
          } catch (error: any) {
            // #region agent log
            fetch('http://127.0.0.1:7242/ingest/c57797a3-6ffd-4efa-8ba1-8119a00b829d',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'audioWorker.ts:454',message:'RunPod request failed',data:{chunkIndex:index+1,attempt,errorMessage:error.message,statusCode:error.response?.status,statusText:error.response?.statusText,responseData:error.response?.data,requestUrl:error.config?.url,requestMethod:error.config?.method,requestHeaders:error.config?.headers,endpointId:runpodEndpoint,endpointIdLength:runpodEndpoint?.length,fullError:JSON.stringify(error,Object.getOwnPropertyNames(error))},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'C'})}).catch(()=>{});
            // #endregion
            if (attempt < maxRetries) {
              console.log(`  ⚠️ Chunk ${index + 1} retry in ${attempt * 5}s...`);
              await this.sleep(attempt * 5000);
            } else {
              throw new Error(`Chunk ${index + 1} failed: ${error.message}`);
            }
          }
        }
        throw new Error(`Chunk ${index + 1} exhausted retries`);
      };

      const startTime = Date.now();
      console.log(`🚀 [AudioWorker] Starting SEQUENTIAL generation of ${chunks.length} chunks...`);

      const audioBuffers: Buffer[] = [];
      for (let i = 0; i < chunks.length; i++) {
        // Process sequentially to respect RunPod rate limits
        try {
          const buffer = await generateChunk(chunks[i]!, i);
          audioBuffers.push(buffer);
        } catch (err: any) {
          console.error(`❌ [AudioWorker] Chunk ${i + 1} failed permanently: ${err.message}`);
          throw err; // Re-throw to fail the task
        }
      }

      const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
      console.log(`✅ [AudioWorker] All ${chunks.length} chunks done in ${elapsed}s`);

      // ─────────────────────────────────────────────────────────────────────
      // CONCATENATE WAV CHUNKS
      // ─────────────────────────────────────────────────────────────────────
      const wavAudio = concatenateWavBuffers(audioBuffers);

      // ─────────────────────────────────────────────────────────────────────
      // CONVERT TO MP3
      // ─────────────────────────────────────────────────────────────────────
      try {
        const mp3 = await convertWavToMp3(wavAudio);
        const duration = Math.ceil((wavAudio.length - 44) / 48000); // 24kHz * 2 bytes * 1 channel
        console.log(`🎵 [AudioWorker] Final: ${Math.round(mp3.length / 1024)}KB MP3, ~${duration}s from ${chunks.length} chunks`);

        return {
          success: true,
          output: { size: mp3.length, chunks: chunks.length, duration },
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
                // CRITICAL: Include docNum/system/docType so audio can be matched to correct document
                docNum: task.input?.docNum,
                system: task.input?.system,
                docType: task.input?.docType,
              },
            },
          ],
        };
      } catch (e: any) {
        console.warn(`⚠️ MP3 failed, trying M4A: ${e.message}`);
        const m4a = await convertWavToM4a(wavAudio);
        return {
          success: true,
          output: { size: m4a.length, chunks: chunks.length },
          artifacts: [
            {
              type: 'audio_m4a',
              buffer: m4a,
              contentType: 'audio/mp4',
              metadata: { 
                textLength: text.length, 
                chunks: chunks.length, 
                format: 'm4a',
                // CRITICAL: Include docNum/system/docType so audio can be matched to correct document
                docNum: task.input?.docNum,
                system: task.input?.system,
                docType: task.input?.docType,
              },
            },
          ],
        };
      }

    } catch (error: any) {
      console.error('❌ [AudioWorker] Failed:', error.message);
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
