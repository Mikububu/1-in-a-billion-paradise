/**
 * RATE LIMITER WORKER - The ONLY process that talks to Replicate
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
import { Worker } from 'bullmq';
import { type ChunkJobData, type ChunkJobResult } from '../services/replicateQueue';
export declare function startRateLimiterWorker(): {
    fastWorker: Worker<ChunkJobData, ChunkJobResult, string>;
    slowWorker: Worker<ChunkJobData, ChunkJobResult, string>;
};
//# sourceMappingURL=rateLimiterWorker.d.ts.map