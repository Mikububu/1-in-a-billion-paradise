/**
 * ASYNC AUDIO SERVICE
 *
 * Handles long-running audio generation independently of job completion.
 * Jobs complete immediately after text generation, then audio is generated
 * asynchronously in the background via the job queue system.
 *
 * This allows the system to tolerate RunPod cold starts (30+ minutes) without
 * timing out or marking jobs as failed.
 */
export interface AudioDocument {
    id: string;
    title: string;
    text: string;
    jobId: string;
    sequence: number;
    system?: string | null;
    docType?: string | null;
}
/**
 * Trigger asynchronous audio generation for a completed job.
 * Creates audio_generation tasks in the Supabase queue for workers to process.
 *
 * @param jobId - The job ID that owns these audio artifacts
 * @param documents - Array of documents to generate audio for
 */
export declare function triggerAsyncAudioGeneration(jobId: string, documents: AudioDocument[]): Promise<void>;
/**
 * Get audio generation status for a job.
 * Returns the number of completed audio tasks vs total tasks.
 */
export declare function getAudioStatus(jobId: string): Promise<{
    status: 'pending' | 'processing' | 'complete' | 'failed';
    completed: number;
    total: number;
    failed: number;
}>;
//# sourceMappingURL=asyncAudioService.d.ts.map