/**
 * VEDIC MATCHMAKING WORKER
 * Vectorized Batch Processing
 *
 * Responsibilities:
 * 1. Claim queued jobs (one_to_many, many_to_many)
 * 2. Load numeric vectors from DB
 * 3. Execute O(1) vectorized matching
 * 4. Bulk insert results
 * 5. Update progress and status
 */
declare function runWorker(): Promise<void>;
declare function processNextJob(): Promise<void>;
export { runWorker, processNextJob };
//# sourceMappingURL=vedicMatchWorker.d.ts.map