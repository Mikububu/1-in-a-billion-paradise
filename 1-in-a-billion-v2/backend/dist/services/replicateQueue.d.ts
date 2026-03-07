/**
 * REPLICATE QUEUE - BullMQ queue for global audio chunk processing
 *
 * Instead of each audio-worker calling Replicate directly, chunks are
 * enqueued here and processed by a dedicated rate-limiter-worker that
 * enforces the 600 RPM account limit across ALL workers.
 *
 * Audio-worker flow:
 *   1. enqueueChunks(chunks) → returns job IDs
 *   2. waitForAllChunks(jobIds) → resolves with audio buffers in order
 */
declare const QUEUE_NAME_FAST = "replicate-chunks";
declare const QUEUE_NAME_SLOW = "replicate-multilingual-chunks";
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
/**
 * Enqueue a single chunk for Replicate processing.
 * Returns the BullMQ job ID.
 */
export declare function enqueueChunk(data: ChunkJobData): Promise<string>;
/**
 * Enqueue all chunks for a reading in one batch.
 * Returns array of job IDs in chunk order.
 */
export declare function enqueueAllChunks(taskId: string, chunks: string[], replicateModel: string, replicateInput: Omit<Record<string, any>, 'text'>, textField: 'text', chunkTimeoutMs: number): Promise<string[]>;
/**
 * Wait for all chunk jobs to complete and return audio buffers in order.
 * Throws if any chunk fails after all retries.
 */
export declare function waitForAllChunks(jobIds: string[], replicateModel: string, timeoutMs?: number): Promise<Buffer[]>;
export declare function closeQueue(): Promise<void>;
export { QUEUE_NAME_FAST, QUEUE_NAME_SLOW };
//# sourceMappingURL=replicateQueue.d.ts.map