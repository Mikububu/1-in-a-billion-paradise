/**
 * JOB QUEUE SYSTEM - PERSISTENT STORAGE
 *
 * Handles long-running reading generation jobs in the background.
 * Jobs are persisted to JSON files so they survive backend restarts.
 */
export interface JobProgress {
    percent: number;
    phase: 'queued' | 'calculating' | 'text' | 'pdf' | 'audio' | 'finalizing' | 'complete' | 'error';
    currentSystem?: string;
    systemsCompleted: number;
    totalSystems: number;
    audioChunksCompleted?: number;
    audioChunksTotal?: number;
    message: string;
    currentStep?: string;
    callsComplete?: number;
    callsTotal?: number;
    chaptersComplete?: number;
    chaptersTotal?: number;
}
export interface Job {
    id: string;
    type: 'extended' | 'synastry' | 'bundle_verdict' | 'nuclear_v2';
    status: 'queued' | 'processing' | 'complete' | 'error';
    progress: JobProgress;
    createdAt: Date;
    updatedAt: Date;
    completedAt?: Date;
    attempts?: number;
    params: any;
    results?: {
        readings: Array<{
            system: string;
            text: string;
            audioBase64?: string;
            audioPath?: string;
            audioUrl?: string;
            audioDuration?: number;
        }>;
        chapters?: Array<{
            name: string;
            text: string;
            audioBase64?: string;
            duration?: number;
        }>;
        documents?: Array<{
            id: string;
            title: string;
            system?: string;
            docType?: string;
            text: string;
            wordCount: number;
            audioBase64?: string;
            audioPath?: string;
            audioUrl?: string;
            audioDuration?: number;
        }>;
        individualReadings?: Record<string, string>;
        overlayReadings?: Record<string, string>;
        verdict?: 'GO' | 'CONDITIONAL' | 'NO_GO' | string;
        fullText?: string;
        audioBase64?: string;
        audioDuration?: number;
        totalAudioMinutes?: number;
        pdfPaths?: string[];
    };
    error?: string;
}
type JobProcessor = (job: Job, updateProgress: (progress: Partial<JobProgress>) => void) => Promise<void>;
export declare const jobQueue: {
    /**
     * Create a new job and return its ID
     */
    createJob(type: Job["type"], params: any): string;
    /**
     * Get job by ID
     */
    getJob(id: string): Job | undefined;
    /**
     * Update job progress
     */
    updateProgress(id: string, progress: Partial<JobProgress>): void;
    /**
     * Mark job as complete
     */
    completeJob(id: string, results: Job["results"]): void;
    /**
     * Mark job as failed
     */
    failJob(id: string, error: string): void;
    /**
     * Register a job processor
     */
    registerProcessor(type: string, processor: JobProcessor): void;
    /**
     * Process a job (called internally)
     */
    processJob(id: string): Promise<void>;
    /**
     * Get all jobs (for debugging)
     */
    getAllJobs(): Job[];
    /**
     * Clean up old completed jobs (call periodically)
     */
    cleanupOldJobs(maxAgeHours?: number): number;
    /**
     * Reload jobs from disk (useful after crash recovery)
     */
    reloadFromDisk(): void;
};
export {};
//# sourceMappingURL=jobQueue.d.ts.map