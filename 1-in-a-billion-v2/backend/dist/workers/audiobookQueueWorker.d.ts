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
export declare class AudiobookQueueWorker {
    private workerId;
    private runpodApiKey;
    private runpodEndpointId;
    private voiceSampleUrl;
    private running;
    private pollingIntervalMs;
    constructor(options?: {
        workerId?: string;
        pollingIntervalMs?: number;
    });
    /**
     * Start worker loop (blocking)
     */
    start(): Promise<void>;
    /**
     * Stop worker gracefully
     */
    stop(): void;
    /**
     * Process a single chapter
     */
    private processChapter;
    /**
     * Helper: Sleep
     */
    private sleep;
}
//# sourceMappingURL=audiobookQueueWorker.d.ts.map