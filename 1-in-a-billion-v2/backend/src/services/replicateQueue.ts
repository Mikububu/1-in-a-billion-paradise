/**
 * REPLICATE QUEUE — BullMQ queue for global audio chunk processing
 *
 * Instead of each audio-worker calling Replicate directly, chunks are
 * enqueued here and processed by a dedicated rate-limiter-worker that
 * enforces the 600 RPM account limit across ALL workers.
 *
 * Audio-worker flow:
 *   1. enqueueChunks(chunks) → returns job IDs
 *   2. waitForAllChunks(jobIds) → resolves with audio buffers in order
 */

import { Queue, QueueEvents, Job } from 'bullmq';
import pLimit from 'p-limit';
import { createRedisConnection } from './redisClient';
import { supabase } from './supabaseClient';

const QUEUE_NAME_FAST = 'replicate-chunks'; // chatterbox-turbo
const QUEUE_NAME_SLOW = 'replicate-multilingual-chunks'; // chatterbox-multilingual

// Lazy-init to avoid connecting to Redis at import time
let _queueFast: Queue | null = null;
let _queueFastEvents: QueueEvents | null = null;
let _queueSlow: Queue | null = null;
let _queueSlowEvents: QueueEvents | null = null;

function getQueue(replicateModel: string): Queue {
  const isMultilingual = replicateModel.includes('multilingual');

  if (isMultilingual) {
    if (!_queueSlow) {
      _queueSlow = new Queue(QUEUE_NAME_SLOW, {
        connection: createRedisConnection(),
        defaultJobOptions: {
          attempts: 6,
          backoff: { type: 'exponential', delay: 10000 }, // Slower backoff for multilingual
          removeOnComplete: { age: 3600 },   // Keep longer since it's slow
          removeOnFail: { age: 3600 },
        },
      });
    }
    return _queueSlow;
  } else {
    if (!_queueFast) {
      _queueFast = new Queue(QUEUE_NAME_FAST, {
        connection: createRedisConnection(),
        defaultJobOptions: {
          attempts: 6,
          backoff: { type: 'exponential', delay: 3000 },
          removeOnComplete: { age: 300 },   // Keep completed jobs 5 min
          removeOnFail: { age: 600 },      // Keep failed jobs for 10 min
        },
      });
    }
    return _queueFast;
  }
}

function getQueueEvents(replicateModel: string): QueueEvents {
  const isMultilingual = replicateModel.includes('multilingual');

  if (isMultilingual) {
    if (!_queueSlowEvents) {
      _queueSlowEvents = new QueueEvents(QUEUE_NAME_SLOW, {
        connection: createRedisConnection(),
      });
    }
    return _queueSlowEvents;
  } else {
    if (!_queueFastEvents) {
      _queueFastEvents = new QueueEvents(QUEUE_NAME_FAST, {
        connection: createRedisConnection(),
      });
    }
    return _queueFastEvents;
  }
}

/* ── Types ──────────────────────────────────────────────────────────── */

export interface ChunkJobData {
  /** Parent task ID from Supabase (for logging/grouping) */
  taskId: string;
  /** Chunk index within the reading (for ordering) */
  chunkIndex: number;
  /** Total chunks in this reading (for logging) */
  totalChunks: number;
  /** The text to synthesize */
  chunkText: string;

  /** Replicate model identifier */
  replicateModel: string;
  /** Full Replicate input params (model-specific) */
  replicateInput: Record<string, any>;

  /** Timeout per chunk in ms */
  chunkTimeoutMs: number;
}

export interface ChunkJobResult {
  /** Supabase storage path where the audio chunk was uploaded */
  storagePath: string;
  /** Size in bytes */
  audioBytes: number;
  /** Chunk index (echoed back for verification) */
  chunkIndex: number;
}

/* ── Enqueue ────────────────────────────────────────────────────────── */

/**
 * Enqueue a single chunk for Replicate processing.
 * Returns the BullMQ job ID.
 */
export async function enqueueChunk(data: ChunkJobData): Promise<string> {
  const queue = getQueue(data.replicateModel);
  const job = await queue.add(`chunk-${data.taskId}-${data.chunkIndex}`, data, {
    // Priority: earlier chunks get processed first (lower = higher priority)
    priority: data.chunkIndex,
  });
  return job.id!;
}

/**
 * Enqueue all chunks for a reading in one batch.
 * Returns array of job IDs in chunk order.
 */
export async function enqueueAllChunks(
  taskId: string,
  chunks: string[],
  replicateModel: string,
  replicateInput: Omit<Record<string, any>, 'text'>,
  textField: 'text',
  chunkTimeoutMs: number,
): Promise<string[]> {
  const jobIds: string[] = [];
  for (let i = 0; i < chunks.length; i++) {
    const input = { ...replicateInput, [textField]: chunks[i] };
    const jobId = await enqueueChunk({
      taskId,
      chunkIndex: i,
      totalChunks: chunks.length,
      chunkText: chunks[i]!,
      replicateModel,
      replicateInput: input,
      chunkTimeoutMs,
    });
    jobIds.push(jobId);
  }
  console.log(`[ReplicateQueue] Enqueued ${chunks.length} chunks for task ${taskId}`);
  return jobIds;
}

/* ── Wait for results ───────────────────────────────────────────────── */

/**
 * Wait for all chunk jobs to complete and return audio buffers in order.
 * Throws if any chunk fails after all retries.
 */
export async function waitForAllChunks(
  jobIds: string[],
  replicateModel: string,
  timeoutMs: number = 2_700_000, // 45 minutes by default to handle slow lane
): Promise<Buffer[]> {
  const queueEvents = getQueueEvents(replicateModel);
  const queue = getQueue(replicateModel);

  const startTime = Date.now();

  // ─────────────────────────────────────────────────────────────────────
  // PHASE 1: Wait for ALL Replicate jobs to finish (parallel — cheap,
  //          only stores completion metadata, no audio buffers yet)
  // ─────────────────────────────────────────────────────────────────────
  const chunkResults: ChunkJobResult[] = new Array(jobIds.length);

  await Promise.all(
    jobIds.map(async (jobId, arrayIndex) => {
      const job = await Job.fromId<ChunkJobData, ChunkJobResult>(queue, jobId);
      if (!job) {
        throw new Error(`Chunk job ${jobId} not found in queue`);
      }

      try {
        const result = await Promise.race([
          job.waitUntilFinished(queueEvents, timeoutMs),
          new Promise<never>((_, reject) =>
            setTimeout(() => reject(new Error(`Chunk job ${jobId} timed out after ${timeoutMs}ms`)), timeoutMs)
          ),
        ]) as ChunkJobResult;

        chunkResults[arrayIndex] = result;
      } catch (error: any) {
        const failedJob = await queue.getJob(jobId);
        const failReason = failedJob?.failedReason || error.message;
        if (supabase) {
          const taskId = failedJob?.data?.taskId;
          if (taskId) {
            supabase.storage.from('audio').remove([`temp-chunks/${taskId}/${arrayIndex}.wav`]).catch(() => { });
          }
        }
        throw new Error(
          `Chunk job ${jobId} (index ${arrayIndex}) failed: ${failReason}`
        );
      }
    }),
  );

  // ─────────────────────────────────────────────────────────────────────
  // PHASE 2: Download audio buffers batch-sequentially to cap peak memory.
  //          Each chunk is ~0.5-2MB WAV; we limit to 5 concurrent downloads
  //          Memory overhead per batch: ~10MB (extremely safe on 1GB RAM)
  // ─────────────────────────────────────────────────────────────────────
  if (!supabase) throw new Error('Supabase not configured — cannot download audio chunks');

  const audioBuffers: Buffer[] = new Array(jobIds.length);
  const downloadLimit = pLimit(5); // 5 concurrent downloads max

  const downloadTasks = chunkResults.map((result, i) => {
    return downloadLimit(async () => {
      let audioBuffer: Buffer = Buffer.alloc(0);

      for (let dlAttempt = 1; dlAttempt <= 3; dlAttempt++) {
        const { data: blob, error: dlErr } = await supabase!.storage
          .from('audio')
          .download(result.storagePath);
        if (dlErr || !blob) {
          console.warn(
            `[ReplicateQueue] Download attempt ${dlAttempt}/3 failed for ${result.storagePath}: ${dlErr?.message || 'no data'}`
          );
          if (dlAttempt < 3) {
            await new Promise((r) => setTimeout(r, 1000 * dlAttempt));
            continue;
          }
          throw new Error(`Failed to download chunk audio from ${result.storagePath} after 3 attempts: ${dlErr?.message || 'no data'}`);
        }
        audioBuffer = Buffer.from(await blob.arrayBuffer());
        if (audioBuffer.length < 100) {
          console.warn(`[ReplicateQueue] Downloaded buffer suspiciously small (${audioBuffer.length} bytes) for ${result.storagePath}`);
          if (dlAttempt < 3) {
            await new Promise((r) => setTimeout(r, 1000 * dlAttempt));
            continue;
          }
          throw new Error(`Downloaded audio buffer too small (${audioBuffer.length} bytes) for ${result.storagePath}`);
        }
        break;
      }

      audioBuffers[i] = audioBuffer;

      // Clean up temp file immediately after download
      await supabase!.storage.from('audio').remove([result.storagePath]).catch((e: any) =>
        console.warn(`[ReplicateQueue] Cleanup warning for ${result.storagePath}: ${e.message}`)
      );

      const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
      console.log(
        `[ReplicateQueue] Chunk ${result.chunkIndex + 1}/${jobIds.length} downloaded ` +
        `(${audioBuffer.length} bytes) [${elapsed}s elapsed]`
      );
    });
  });

  await Promise.all(downloadTasks);

  console.log(
    `[ReplicateQueue] All ${jobIds.length} chunks downloaded in ${((Date.now() - startTime) / 1000).toFixed(1)}s`
  );
  return audioBuffers;
}

/* ── Cleanup ────────────────────────────────────────────────────────── */

export async function closeQueue(): Promise<void> {
  if (_queueFastEvents) { await _queueFastEvents.close(); _queueFastEvents = null; }
  if (_queueSlowEvents) { await _queueSlowEvents.close(); _queueSlowEvents = null; }
  if (_queueFast) { await _queueFast.close(); _queueFast = null; }
  if (_queueSlow) { await _queueSlow.close(); _queueSlow = null; }
}

export { QUEUE_NAME_FAST, QUEUE_NAME_SLOW };
