/**
 * RATE LIMITER WORKER — The ONLY process that talks to Replicate
 *
 * Processes the `replicate-chunks` BullMQ queue at a globally controlled rate.
 * Uses the existing runReplicateWithRateLimit() for per-process pacing,
 * plus BullMQ's built-in limiter for cross-process global rate control.
 *
 * This worker:
 *   1. Pulls chunk jobs from Redis
 *   2. Calls Replicate API (respecting 600 RPM limit)
 *   3. Returns audio buffer as base64 in the job result
 *
 * Runs as a separate Fly.io process group: rate-limiter
 */

import { Worker, Job } from 'bullmq';
import axios from 'axios';
import Replicate from 'replicate';
import { createRedisConnection } from '../services/redisClient';
import {
  QUEUE_NAME,
  type ChunkJobData,
  type ChunkJobResult,
} from '../services/replicateQueue';
import {
  isReplicateRateLimitError,
  runReplicateWithRateLimit,
} from '../services/replicateRateLimiter';
import { supabase } from '../services/supabaseClient';

/* ── Replicate client ──────────────────────────────────────────────── */

function createReplicateClient(): Replicate {
  const token = process.env.REPLICATE_API_TOKEN;
  if (!token) {
    throw new Error('REPLICATE_API_TOKEN is required for rate-limiter-worker');
  }
  return new Replicate({ auth: token });
}

/* ── Timeout helper ─────────────────────────────────────────────────── */

async function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  label: string,
): Promise<T> {
  let timeoutHandle: NodeJS.Timeout | null = null;
  try {
    return await Promise.race([
      promise,
      new Promise<never>((_, reject) => {
        timeoutHandle = setTimeout(
          () => reject(new Error(`${label} timed out after ${timeoutMs}ms`)),
          timeoutMs,
        );
      }),
    ]);
  } finally {
    if (timeoutHandle) clearTimeout(timeoutHandle);
  }
}

/* ── Process a single chunk ────────────────────────────────────────── */

async function processChunk(
  replicate: Replicate,
  job: Job<ChunkJobData>,
): Promise<ChunkJobResult> {
  const { chunkIndex, totalChunks, replicateModel, replicateInput, chunkTimeoutMs, taskId } =
    job.data;

  const textPreview = (replicateInput.text || replicateInput.text_to_synthesize || '').substring(0, 50);
  console.log(
    `[RateLimiterWorker] Processing chunk ${chunkIndex + 1}/${totalChunks} ` +
    `(task ${taskId}) — "${textPreview}..."`,
  );

  const startTime = Date.now();

  // Call Replicate through the rate limiter
  const output = await runReplicateWithRateLimit(
    `rateLimiter:chunk:${chunkIndex + 1}`,
    () =>
      withTimeout(
        replicate.run(replicateModel as `${string}/${string}`, { input: replicateInput }),
        chunkTimeoutMs,
        `Replicate chunk ${chunkIndex + 1}`,
      ),
  );

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(2);

  // Convert output to Buffer (same logic as audioWorker)
  let audioBuffer: Buffer;
  if (output instanceof ReadableStream || (output as any).getReader) {
    const reader = (output as ReadableStream).getReader();
    const parts: Uint8Array[] = [];
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      parts.push(value);
    }
    audioBuffer = Buffer.concat(parts);
  } else if (typeof output === 'string') {
    const response = await axios.get(output, { responseType: 'arraybuffer' });
    audioBuffer = Buffer.from(response.data);
  } else if (Buffer.isBuffer(output)) {
    audioBuffer = output;
  } else {
    const data = await (output as any).arrayBuffer?.() || output;
    audioBuffer = Buffer.from(data);
  }

  // Upload to Supabase temp storage instead of returning base64 through Redis
  // This prevents Redis from filling up with large audio buffers
  if (!supabase) throw new Error('Supabase not configured — cannot upload audio chunks');
  const storagePath = `temp-chunks/${taskId}/${chunkIndex}.wav`;
  const { error: uploadErr } = await supabase.storage
    .from('audio')
    .upload(storagePath, audioBuffer, {
      contentType: 'audio/wav',
      upsert: true,
    });
  if (uploadErr) {
    throw new Error(`Failed to upload chunk audio to ${storagePath}: ${uploadErr.message}`);
  }

  console.log(
    `[RateLimiterWorker] ✅ Chunk ${chunkIndex + 1}/${totalChunks} done — ` +
    `${audioBuffer.length} bytes in ${elapsed}s → ${storagePath}`,
  );

  // Return only the storage path (tiny string) — not the audio data
  return {
    storagePath,
    audioBytes: audioBuffer.length,
    chunkIndex,
  };
}

/* ── Worker setup ──────────────────────────────────────────────────── */

export function startRateLimiterWorker(): Worker<ChunkJobData, ChunkJobResult> {
  const replicate = createReplicateClient();

  const worker = new Worker<ChunkJobData, ChunkJobResult>(
    QUEUE_NAME,
    async (job) => {
      return processChunk(replicate, job);
    },
    {
      connection: createRedisConnection(),
      // Allow multiple in-flight Replicate calls — the rate limiter
      // inside runReplicateWithRateLimit serializes their STARTS,
      // but we want overlapping wait-for-completion.
      concurrency: parseInt(process.env.RATE_LIMITER_CONCURRENCY || '8', 10),
      // BullMQ global rate limit: 10 jobs per second = 600/min
      limiter: {
        max: parseInt(process.env.RATE_LIMITER_MAX_PER_SECOND || '10', 10),
        duration: 1000,
      },
    },
  );

  worker.on('completed', (job) => {
    if (job) {
      console.log(
        `[RateLimiterWorker] Job ${job.id} completed (chunk ${job.data.chunkIndex + 1})`,
      );
    }
  });

  worker.on('failed', (job, error) => {
    if (job) {
      const is429 = isReplicateRateLimitError(error);
      console.error(
        `[RateLimiterWorker] Job ${job.id} failed (chunk ${job.data.chunkIndex + 1}, ` +
        `attempt ${job.attemptsMade}/${job.opts.attempts || 6})` +
        `${is429 ? ' [RATE LIMITED]' : ''}: ${error.message}`,
      );
    }
  });

  worker.on('error', (error) => {
    console.error('[RateLimiterWorker] Worker error:', error.message);
  });

  console.log(`[RateLimiterWorker] Started — processing queue "${QUEUE_NAME}"`);
  console.log(
    `[RateLimiterWorker] Concurrency: ${worker.opts.concurrency}, ` +
    `Rate limit: ${worker.opts.limiter?.max}/${worker.opts.limiter?.duration}ms`,
  );

  return worker;
}
