/**
 * JOB QUEUE V2 - SUPABASE DISTRIBUTED QUEUE
 *
 * Horizontally scalable job queue using:
 * - Supabase Postgres for state
 * - Supabase Storage for artifacts (no base64 in DB)
 * - Stateless workers with distributed task claiming
 */
import { Job, JobTask, JobArtifact, TaskType } from './supabaseClient';
export interface CreateJobParams {
    userId: string;
    type: Job['type'];
    params: any;
    tasks?: Array<{
        taskType: TaskType;
        sequence: number;
        input: any;
    }>;
}
export declare class JobQueueV2 {
    /**
     * Create a new job with tasks
     */
    createJob({ userId, type, params, tasks }: CreateJobParams): Promise<string>;
    /**
     * Get job with artifacts (for API)
     */
    getJob(jobId: string, userId?: string): Promise<Job & {
        artifacts?: JobArtifact[];
    } | null>;
    /**
     * Get job tasks (for debugging/monitoring)
     */
    getJobTasks(jobId: string): Promise<JobTask[]>;
    /**
     * Update job progress (called by workers or API)
     */
    updateProgress(jobId: string, progress: Partial<Job['progress']>): Promise<boolean>;
    /**
     * Mark job as complete (usually done by trigger, but can be manual)
     */
    completeJob(jobId: string): Promise<boolean>;
    /**
     * Extract and save system essences from completed job readings (async)
     */
    private extractEssencesAsync;
    /**
     * Mark job as failed
     */
    failJob(jobId: string, errorMessage: string): Promise<boolean>;
    /**
     * Cancel job (soft delete)
     */
    cancelJob(jobId: string): Promise<boolean>;
    /**
     * Get all jobs for a user (for dashboard)
     */
    getUserJobs(userId: string, limit?: number): Promise<Job[]>;
    /**
     * Get queue stats (for monitoring)
     */
    getQueueStats(): Promise<{
        pendingTasks: number;
        processingTasks: number;
        completedJobs: number;
        errorJobs: number;
        activeWorkers: number;
    }>;
    /**
     * Cleanup old completed jobs (run periodically)
     */
    cleanupOldJobs(maxAgeHours?: number): Promise<number>;
}
export declare const jobQueueV2: JobQueueV2;
//# sourceMappingURL=jobQueueV2.d.ts.map