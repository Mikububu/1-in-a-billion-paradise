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
import { createRedisConnection } from './redisClient';
import { supabase } from './supabaseClient';

const QUEUE_NAME = 'replicate-chunks';

// Lazy-init to avoid connecting to Redis at import time
let _queue: Queue | null = null;
let _queueEvents: QueueEvents | null = null;

function getQueue(): Queue {
  if (!_queue) {
    _queue = new Queue(QUEUE_NAME, {
      connection: createRedisConnection(),
      defaultJobOptions: {
        attempts: 6,
        backoff: { type: 'exponential', delay: 3000 },
        removeOnComplete: { age: 300 },   // Keep completed jobs 5 min (audio is in Supabase; must survive slow downloads)
        removeOnFail: { age: 600 },      // Keep failed jobs for 10 min for debugging
      },
    });
  }
  return _queue;
}

function getQueueEvents(): QueueEvents {
  if (!_queueEvents) {
    _queueEvents = new QueueEvents(QUEUE_NAME, {
      connection: createRedisConnection(),
    });
  }
  return _queueEvents;
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
  const queue = getQueue();
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
  timeoutMs: number = 600_000,
): Promise<Buffer[]> {
  const queueEvents = getQueueEvents();
  const queue = getQueue();

  const results: (Buffer | null)[] = new Array(jobIds.length).fill(null);
  let completed = 0;

  const startTime = Date.now();

  // Wait for each job to complete
  const promises = jobIds.map(async (jobId, arrayIndex) => {
    try {
      // Get the job instance, then use job.waitUntilFinished(queueEvents)
      const job = await Job.fromId<ChunkJobData, ChunkJobResult>(queue, jobId);
      if (!job) {
        throw new Error(`Chunk job ${jobId} not found in queue`);
      }

      const result = await Promise.race([
        job.waitUntilFinished(queueEvents, timeoutMs),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error(`Chunk job ${jobId} timed out after ${timeoutMs}ms`)), timeoutMs)
        ),
      ]) as ChunkJobResult;

      // Download audio from Supabase temp storage with retry (not stored in Redis)
      if (!supabase) throw new Error('Supabase not configured — cannot download audio chunks');
      let audioBuffer: Buffer = Buffer.alloc(0);
      for (let dlAttempt = 1; dlAttempt <= 3; dlAttempt++) {
        const { data: blob, error: dlErr } = await supabase.storage
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
      results[arrayIndex] = audioBuffer;
      completed++;

      // Clean up temp file after successful download (await to avoid race)
      await supabase.storage.from('audio').remove([result.storagePath]).catch((e: any) =>
        console.warn(`[ReplicateQueue] Cleanup warning for ${result.storagePath}: ${e.message}`)
      );

      const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
      console.log(
        `[ReplicateQueue] Chunk ${result.chunkIndex + 1}/${jobIds.length} complete ` +
        `(${audioBuffer.length} bytes) [${completed}/${jobIds.length} done, ${elapsed}s elapsed]`
      );
    } catch (error: any) {
      // Check if the job failed (vs timed out)
      const failedJob = await queue.getJob(jobId);
      const failReason = failedJob?.failedReason || error.message;
      // Clean up any temp chunk that was uploaded before failure
      if (supabase) {
        const taskId = failedJob?.data?.taskId;
        if (taskId) {
          supabase.storage.from('audio').remove([`temp-chunks/${taskId}/${arrayIndex}.wav`]).catch(() => {});
        }
      }
      throw new Error(
        `Chunk job ${jobId} (index ${arrayIndex}) failed: ${failReason}`
      );
    }
  });

  await Promise.all(promises);

  // Verify all buffers are present
  const finalBuffers = results.filter((b): b is Buffer => b !== null);
  if (finalBuffers.length !== jobIds.length) {
    throw new Error(
      `Only ${finalBuffers.length}/${jobIds.length} chunks completed successfully`
    );
  }

  console.log(
    `[ReplicateQueue] All ${jobIds.length} chunks complete in ${((Date.now() - startTime) / 1000).toFixed(1)}s`
  );
  return finalBuffers;
}

/* ── Cleanup ────────────────────────────────────────────────────────── */

export async function closeQueue(): Promise<void> {
  if (_queueEvents) {
    await _queueEvents.close();
    _queueEvents = null;
  }
  if (_queue) {
    await _queue.close();
    _queue = null;
  }
}

export { QUEUE_NAME };
