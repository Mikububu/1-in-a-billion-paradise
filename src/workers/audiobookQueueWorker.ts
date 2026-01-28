/**
 * AUDIOBOOK QUEUE WORKER - Persistent GPU Worker
 * 
 * This worker runs continuously on a persistent GPU pod and processes
 * audiobook chapters from the queue. It replaces the serverless /runsync
 * approach which fails at scale.
 * 
 * Architecture:
 * - Pulls chapters from audiobook_chapters queue (FOR UPDATE SKIP LOCKED)
 * - Processes ONE chapter at a time (sequential, not parallel)
 * - Chunks text, generates audio via RunPod, concatenates chunks
 * - Uploads final audio to Supabase Storage
 * - Marks chapter as complete
 * - Loops to get next chapter
 * 
 * This decouples user concurrency from GPU concurrency:
 * - Thousands of users can queue jobs
 * - Only N workers process them (where N = number of GPU pods)
 * 
 * Date: December 27, 2025
 */

import axios from 'axios';
import { spawn } from 'child_process';
import fs from 'fs/promises';
import os from 'os';
import path from 'path';
import { supabase } from '../services/supabaseClient';
import { env } from '../config/env';
import { apiKeys } from '../services/apiKeysHelper';

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

interface AudiobookChapter {
  chapter_id: string;
  job_id: string;
  chapter_index: number;
  text: string;
  title: string | null;
}

// ─────────────────────────────────────────────────────────────────────────────
// Text Chunking (same as audioWorker)
// ─────────────────────────────────────────────────────────────────────────────

function splitIntoChunks(text: string, maxChunkLength: number = 300): string[] {
  const sentenceRegex = /[^.!?]*[.!?]+|[^.!?]+$/g;
  const sentences = text.match(sentenceRegex) || [text];
  const chunks: string[] = [];
  let currentChunk = '';

  for (const sentence of sentences) {
    const trimmedSentence = sentence.trim();
    if (!trimmedSentence) continue;

    if (currentChunk && (currentChunk.length + 1 + trimmedSentence.length > maxChunkLength)) {
      chunks.push(currentChunk.trim());
      currentChunk = '';
    }

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
// WAV Processing (same as audioWorker)
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
    if (chunkSize % 2 === 1) offset++;
  }
  
  if (dataOffset === 0) return null;
  
  return { audioFormat, numChannels, sampleRate, bitsPerSample, dataOffset, dataSize };
}

function convertFloatWavToPcm(buffer: Buffer): Buffer {
  const header = parseWavHeader(buffer);
  if (!header) return buffer;
  
  if (header.audioFormat === 3) {
    const floatData = buffer.slice(header.dataOffset, header.dataOffset + header.dataSize);
    const pcmData = Buffer.alloc(floatData.length / 4 * 2);
    
    for (let i = 0; i < floatData.length / 4; i++) {
      const float = floatData.readFloatLE(i * 4);
      const sample = Math.max(-1, Math.min(1, float));
      const int16 = Math.round(sample * 32767);
      pcmData.writeInt16LE(int16, i * 2);
    }
    
    const wavHeader = Buffer.alloc(44);
    wavHeader.write('RIFF', 0);
    wavHeader.writeUInt32LE(36 + pcmData.length, 4);
    wavHeader.write('WAVE', 8);
    wavHeader.write('fmt ', 12);
    wavHeader.writeUInt32LE(16, 16);
    wavHeader.writeUInt16LE(1, 20);
    wavHeader.writeUInt16LE(header.numChannels, 22);
    wavHeader.writeUInt32LE(header.sampleRate, 24);
    wavHeader.writeUInt32LE(header.sampleRate * header.numChannels * 2, 28);
    wavHeader.writeUInt16LE(header.numChannels * 2, 32);
    wavHeader.writeUInt16LE(16, 34);
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
  
  const wavHeader = Buffer.alloc(44);
  wavHeader.write('RIFF', 0);
  wavHeader.writeUInt32LE(36 + totalDataSize, 4);
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
    await fs.rm(dir, { recursive: true, force: true }).catch(() => {});
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
    await fs.rm(dir, { recursive: true, force: true }).catch(() => {});
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// RunPod TTS Generation
// ─────────────────────────────────────────────────────────────────────────────

async function generateChunkAudio(
  chunk: string,
  index: number,
  totalChunks: number,
  runpodApiKey: string,
  runpodEndpointId: string,
  voiceSampleUrl: string
): Promise<Buffer> {
  console.log(`  Chunk ${index + 1}/${totalChunks} (${chunk.length} chars)`);
  
  const response = await axios.post(
    `https://api.runpod.ai/v2/${runpodEndpointId}/run`,
    {
      input: {
        text: chunk,
        audio_url: voiceSampleUrl,
        exaggeration: 0.3,
        cfg_weight: 0.5,
      },
    },
    {
      headers: {
        Authorization: `Bearer ${runpodApiKey}`,
        'Content-Type': 'application/json',
      },
      timeout: 180000,
    }
  );

  const data = response.data || {};
  
  // RunPod /run returns async job ID
  if (data.id && data.status && data.status !== 'COMPLETED') {
    console.log(`  ⏳ RunPod async job ${data.id}, status: ${data.status}, polling...`);
    
    // Poll for completion
    const maxPollAttempts = 240; // 240 * 5s = 20 minutes max
    for (let pollAttempt = 0; pollAttempt < maxPollAttempts; pollAttempt++) {
      await new Promise(resolve => setTimeout(resolve, 5000)); // Poll every 5 seconds
      
      if (pollAttempt > 0 && pollAttempt % 20 === 0) {
        console.log(`  🔍 Poll attempt ${pollAttempt}/${maxPollAttempts}`);
      }
      
      const statusResp = await axios.get(
        `https://api.runpod.ai/v2/${runpodEndpointId}/status/${data.id}`,
        {
          headers: { Authorization: `Bearer ${runpodApiKey}` },
          timeout: 10000,
        }
      );
      
      const statusData = statusResp.data || {};
      if (statusData.status === 'COMPLETED') {
        console.log(`  ✅ RunPod job ${data.id} completed, fetching result...`);
        
        // Fetch the result (same endpoint, just different status)
        if (statusData.output?.audio_base64) {
          console.log(`  ✅ Chunk ${index + 1} done (async)`);
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
        throw new Error(`RunPod job completed but no audio in result`);
      } else if (statusData.status === 'FAILED') {
        throw new Error(`RunPod job failed: ${statusData.error || 'Unknown error'}`);
      }
    }
    throw new Error(`RunPod job ${data.id} timed out after ${maxPollAttempts * 5}s`);
  }
  
  // Synchronous response (shouldn't happen with /run, but handle it)
  if (data?.output?.audio_base64) {
    console.log(`  ✅ Chunk ${index + 1} done (sync)`);
    return Buffer.from(data.output.audio_base64, 'base64');
  }
  
  throw new Error(`No audio_base64 in RunPod response`);
}

// ─────────────────────────────────────────────────────────────────────────────
// AudiobookQueueWorker Class
// ─────────────────────────────────────────────────────────────────────────────

export class AudiobookQueueWorker {
  private workerId: string;
  private runpodApiKey: string;
  private runpodEndpointId: string;
  private voiceSampleUrl: string;
  private running: boolean = false;
  private pollingIntervalMs: number;

  constructor(options?: {
    workerId?: string;
    pollingIntervalMs?: number;
  }) {
    this.workerId = options?.workerId || `audiobook-worker-${os.hostname()}-${process.pid}`;
    this.pollingIntervalMs = options?.pollingIntervalMs || 5000; // 5 seconds

    // API keys will be fetched from Supabase on first use
    // Fallback to env vars if Supabase unavailable
    this.runpodApiKey = env.RUNPOD_API_KEY;
    this.runpodEndpointId = env.RUNPOD_ENDPOINT_ID;
    this.voiceSampleUrl =
      env.VOICE_SAMPLE_URL ||
      'https://qdfikbgwuauertfmkmzk.supabase.co/storage/v1/object/public/voices/david.wav';

    console.log(`🤖 AudiobookQueueWorker initialized: ${this.workerId}`);
  }

  /**
   * Start worker loop (blocking)
   */
  async start(): Promise<void> {
    if (!supabase) {
      throw new Error('Supabase not configured');
    }

    this.running = true;
    console.log(`▶️ AudiobookQueueWorker started: ${this.workerId}`);

    while (this.running) {
      try {
        // Claim ONE chapter from queue
        const { data: chapters, error } = await supabase.rpc('claim_audiobook_chapter', {
          p_worker_id: this.workerId,
          p_max_chapters: 1,
        });

        if (error) {
          console.error('Failed to claim chapter:', error);
          await this.sleep(10000);
          continue;
        }

        if (!chapters || chapters.length === 0) {
          // No work available, wait before polling again
          await this.sleep(this.pollingIntervalMs);
          continue;
        }

        const chapter = chapters[0] as AudiobookChapter;
        console.log(`📋 Claimed chapter ${chapter.chapter_index} from job ${chapter.job_id}`);

        // Process the chapter
        await this.processChapter(chapter);

      } catch (error: any) {
        console.error('❌ Worker loop error:', error.message);
        await this.sleep(10000); // Cool down on error
      }
    }

    console.log(`⏹ AudiobookQueueWorker stopped: ${this.workerId}`);
  }

  /**
   * Stop worker gracefully
   */
  stop(): void {
    console.log(`⏸ Stopping worker: ${this.workerId}`);
    this.running = false;
  }

  /**
   * Process a single chapter
   */
  private async processChapter(chapter: AudiobookChapter): Promise<void> {
    try {
      console.log(`🎤 Processing chapter ${chapter.chapter_index}: "${chapter.title || 'Untitled'}"`);

      // Get text content - may be stored directly or need to download from storage
      let text: string = chapter.text;
      
      // If text starts with 'ARTIFACT_PATH:', download from storage
      if (text.startsWith('ARTIFACT_PATH:')) {
        const artifactPath = text.substring('ARTIFACT_PATH:'.length);
        console.log(`   Downloading text from storage: ${artifactPath}`);
        
        const { data, error } = await supabase.storage
          .from('job-artifacts')
          .download(artifactPath);
        
        if (error || !data) {
          throw new Error(`Failed to download text artifact: ${error?.message || 'No data'}`);
        }
        
        text = Buffer.from(await data.arrayBuffer()).toString('utf-8');
        console.log(`   Downloaded ${text.length} chars from storage`);
      } else {
        console.log(`   Text length: ${text.length} chars`);
      }

      if (!text || text.length === 0) {
        throw new Error('No text content available for chapter');
      }

      // Chunk text
      const chunks = splitIntoChunks(text, 300);
      console.log(`   Split into ${chunks.length} chunks`);

      // Fetch RunPod keys from Supabase (with env fallback)
      const runpodKey = await apiKeys.runpod().catch(() => this.runpodApiKey);
      const runpodEndpoint = await apiKeys.runpodEndpoint().catch(() => this.runpodEndpointId);
      
      if (!runpodKey || !runpodEndpoint) {
        throw new Error('RunPod API key or endpoint ID not found (check Supabase api_keys table or .env)');
      }

      // Generate audio for each chunk SEQUENTIALLY (not parallel!)
      // This is critical: we process one chunk at a time to avoid overwhelming RunPod
      const audioChunks: Buffer[] = [];
      for (let i = 0; i < chunks.length; i++) {
        const audioChunk = await generateChunkAudio(
          chunks[i]!,
          i,
          chunks.length,
          runpodKey,
          runpodEndpoint,
          this.voiceSampleUrl
        );
        audioChunks.push(audioChunk);
      }

      // Concatenate WAV chunks
      console.log(`   Concatenating ${audioChunks.length} audio chunks...`);
      const concatenatedWav = concatenateWavBuffers(audioChunks);

      // Convert to MP3 (with M4A fallback)
      let finalAudio: Buffer;
      let audioFormat: 'mp3' | 'm4a';
      let storageExtension: string;

      try {
        finalAudio = await convertWavToMp3(concatenatedWav);
        audioFormat = 'mp3';
        storageExtension = 'mp3';
      } catch (mp3Error: any) {
        console.warn(`⚠️ MP3 conversion failed, trying M4A: ${mp3Error.message}`);
        finalAudio = await convertWavToM4a(concatenatedWav);
        audioFormat = 'm4a';
        storageExtension = 'm4a';
      }

      console.log(`   Final audio: ${Math.round(finalAudio.length / 1024)}KB (${audioFormat})`);

      // Get job to determine user_id and storage path
      const { data: job, error: jobError } = await supabase
        .from('audiobook_jobs')
        .select('user_id')
        .eq('id', chapter.job_id)
        .single();

      if (jobError || !job) {
        throw new Error(`Failed to get job: ${jobError?.message}`);
      }

      // Upload to Storage
      const storagePath = `${job.user_id}/${chapter.job_id}/chapters/${chapter.chapter_id}.${storageExtension}`;
      const contentType = audioFormat === 'mp3' ? 'audio/mpeg' : 'audio/mp4';

      const { error: uploadError } = await supabase.storage
        .from('job-artifacts')
        .upload(storagePath, finalAudio, {
          contentType,
          upsert: true,
        });

      if (uploadError) {
        throw new Error(`Storage upload failed: ${uploadError.message}`);
      }

      // Get public URL
      const { data: urlData } = supabase.storage
        .from('job-artifacts')
        .getPublicUrl(storagePath);

      const audioUrl = urlData.publicUrl;

      // Calculate duration (rough estimate: assume ~24000 samples/sec, 16-bit PCM)
      // This is approximate - for exact duration, we'd need to decode the MP3/M4A
      const wavHeader = parseWavHeader(concatenatedWav);
      const durationSeconds = wavHeader
        ? Math.round(wavHeader.dataSize / (wavHeader.sampleRate * wavHeader.numChannels * 2))
        : null;

      // Mark chapter as complete
      const { error: completeError } = await supabase.rpc('complete_audiobook_chapter', {
        p_chapter_id: chapter.chapter_id,
        p_audio_url: audioUrl,
        p_audio_format: audioFormat,
        p_duration_seconds: durationSeconds,
        p_error: null,
      });

      if (completeError) {
        throw new Error(`Failed to complete chapter: ${completeError.message}`);
      }

      console.log(`✅ Chapter ${chapter.chapter_index} complete: ${audioUrl}`);

    } catch (error: any) {
      console.error(`❌ Chapter processing failed: ${error.message}`);

      // Mark chapter as failed
      const { error: failError } = await supabase.rpc('complete_audiobook_chapter', {
        p_chapter_id: chapter.chapter_id,
        p_audio_url: null,
        p_audio_format: null,
        p_duration_seconds: null,
        p_error: error.message || 'Unknown error',
      });

      if (failError) {
        console.error(`Failed to mark chapter as failed: ${failError.message}`);
      }
    }
  }

  /**
   * Helper: Sleep
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Main Entry Point (if run directly)
// ─────────────────────────────────────────────────────────────────────────────

if (require.main === module) {
  async function main() {
    console.log('🚀 Starting Audiobook Queue Worker...');
    
    const worker = new AudiobookQueueWorker({
      pollingIntervalMs: 5000,
    });

    // Handle graceful shutdown
    process.on('SIGINT', () => {
      console.log('\n🛑 Received SIGINT, shutting down gracefully...');
      worker.stop();
      process.exit(0);
    });

    process.on('SIGTERM', () => {
      console.log('\n🛑 Received SIGTERM, shutting down gracefully...');
      worker.stop();
      process.exit(0);
    });

    // Start worker (blocking)
    await worker.start();
  }

  main().catch((error) => {
    console.error('❌ Fatal error:', error);
    process.exit(1);
  });
}

