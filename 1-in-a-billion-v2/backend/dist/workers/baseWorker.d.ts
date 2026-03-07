/**
 * BASE WORKER - Stateless Task Processor
 *
 * Generic worker that:
 * - Claims tasks from Supabase queue
 * - Processes them with retries
 * - Uploads artifacts to Storage
 * - Updates task status atomically
 * - Heartbeats to prevent stale detection
 */
import { JobTask, TaskType } from '../services/supabaseClient';
import './workerCrashGuards';
export interface TaskResult {
    success: boolean;
    output?: any;
    artifacts?: Array<{
        type: 'audio_mp3' | 'audio_m4a' | 'pdf' | 'json' | 'text';
        buffer: Buffer;
        contentType: string;
        metadata?: any;
    }>;
    error?: string;
}
export declare abstract class BaseWorker {
    protected workerId: string;
    protected taskTypes: TaskType[];
    protected maxConcurrentTasks: number;
    protected pollingIntervalMs: number;
    protected maxPollingIntervalMs: number;
    protected running: boolean;
    protected activeHeartbeats: Map<string, NodeJS.Timeout>;
    constructor(options: {
        workerId?: string;
        taskTypes: TaskType[];
        maxConcurrentTasks?: number;
        pollingIntervalMs?: number;
        maxPollingIntervalMs?: number;
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
     * Claim tasks from queue
     */
    private claimTasks;
    /**
     * Process task with error handling + retries
     */
    private processSafeTask;
    /**
     * Ensure jobs.status/progress reflects current task state.
     * Some deployments may be missing DB triggers that update job status on task changes.
     */
    private syncJobStatus;
    /**
     * Abstract method: Implement task processing logic in subclass
     */
    protected abstract processTask(task: JobTask): Promise<TaskResult>;
    /**
     * Start heartbeat for task
     */
    private startHeartbeat;
    /**
     * Stop heartbeat for task
     */
    private stopHeartbeat;
    /**
     * Generate user-friendly filename matching frontend format
     *
     * Formats (matching frontend fileNames.ts):
     * - PDF: PersonName_SystemName_v1.0.pdf
     * - Audio: PersonName_SystemName_audio.mp3
     * - Synastry PDF: Person1_Person2_Synastry_v1.0.pdf
     * - Overlay Audio: Person1_Person2_System_audio.mp3
     */
    private generateFriendlyFileName;
    /**
     * Upload artifact to Storage and create DB record
     */
    private uploadTaskArtifact;
    /**
     * Helper: Sleep
     */
    protected sleep(ms: number): Promise<void>;
}
//# sourceMappingURL=baseWorker.d.ts.map