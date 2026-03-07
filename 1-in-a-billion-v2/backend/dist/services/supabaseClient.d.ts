/**
 * SUPABASE CLIENT - Service Role Access
 *
 * This client uses the SERVICE_ROLE_KEY to bypass RLS.
 * Workers use this to claim tasks from any user's jobs.
 */
export type JobStatus = 'queued' | 'processing' | 'complete' | 'error' | 'cancelled';
export type JobType = 'extended' | 'synastry' | 'bundle_verdict' | 'nuclear_v2' | 'people_scaling';
export type JobPhase = 'queued' | 'calculating' | 'text' | 'pdf' | 'audio' | 'finalizing' | 'complete' | 'error';
export type TaskStatus = 'pending' | 'claimed' | 'processing' | 'complete' | 'failed';
export type TaskType = 'text_generation' | 'pdf_generation' | 'audio_generation' | 'synastry_calc' | 'song_generation' | 'people_scaling';
export type ArtifactType = 'audio_mp3' | 'audio_m4a' | 'pdf' | 'json' | 'text';
export interface Job {
    id: string;
    user_id: string;
    type: JobType;
    status: JobStatus;
    progress: {
        percent: number;
        phase: JobPhase;
        systemsCompleted: number;
        totalSystems: number;
        message: string;
        currentStep?: string;
        docsComplete?: number;
        docsTotal?: number;
    };
    params: any;
    attempts: number;
    max_attempts: number;
    created_at: string;
    updated_at: string;
    completed_at?: string;
    error?: string;
}
export interface JobTask {
    id: string;
    job_id: string;
    task_type: TaskType;
    status: TaskStatus;
    sequence: number;
    input: any;
    output?: any;
    worker_id?: string;
    claimed_at?: string;
    started_at?: string;
    completed_at?: string;
    attempts: number;
    max_attempts: number;
    last_heartbeat?: string;
    heartbeat_timeout_seconds: number;
    created_at: string;
    updated_at: string;
    error?: string;
}
export interface JobArtifact {
    id: string;
    job_id: string;
    task_id?: string;
    artifact_type: ArtifactType;
    storage_path: string;
    bucket_name: string;
    public_url?: string;
    content_type?: string;
    file_size_bytes?: number;
    duration_seconds?: number;
    metadata?: any;
    created_at: string;
}
export interface Database {
    public: {
        Tables: {
            jobs: {
                Row: Job;
                Insert: Omit<Job, 'id' | 'created_at' | 'updated_at'>;
                Update: Partial<Omit<Job, 'id' | 'created_at'>>;
            };
            job_tasks: {
                Row: JobTask;
                Insert: Omit<JobTask, 'id' | 'created_at' | 'updated_at'>;
                Update: Partial<Omit<JobTask, 'id' | 'created_at'>>;
            };
            job_artifacts: {
                Row: JobArtifact;
                Insert: Omit<JobArtifact, 'id' | 'created_at'>;
                Update: Partial<Omit<JobArtifact, 'id' | 'created_at'>>;
            };
        };
        Views: Record<string, never>;
        Enums: Record<string, never>;
        CompositeTypes: Record<string, never>;
        Functions: {
            claim_tasks: {
                Args: {
                    p_worker_id: string;
                    p_max_tasks?: number;
                    p_task_types?: TaskType[];
                };
                Returns: JobTask[];
            };
            heartbeat_task: {
                Args: {
                    p_task_id: string;
                    p_worker_id: string;
                };
                Returns: boolean;
            };
            complete_task: {
                Args: {
                    p_task_id: string;
                    p_worker_id: string;
                    p_output?: any;
                };
                Returns: boolean;
            };
            fail_task: {
                Args: {
                    p_task_id: string;
                    p_worker_id: string;
                    p_error: string;
                };
                Returns: boolean;
            };
            reclaim_stale_tasks: {
                Args: {};
                Returns: number;
            };
            update_job_progress: {
                Args: {
                    p_job_id: string;
                    p_progress: any;
                };
                Returns: boolean;
            };
        };
    };
}
export declare const supabase: any;
export declare function createSupabaseServiceClient(): any;
export declare const supabaseUser: any;
/**
 * Create a user-scoped Supabase client from a Supabase access token.
 * This respects RLS because it uses the anon key + Authorization header.
 */
export declare function createSupabaseUserClientFromAccessToken(accessToken: string): any;
/**
 * Helper: Get signed URL for artifact (1 hour expiry)
 */
export declare function getSignedArtifactUrl(storagePath: string, expiresIn?: number): Promise<string | null>;
/**
 * Helper: Upload artifact to Storage
 */
export declare function uploadArtifact(storagePath: string, buffer: Buffer, contentType: string): Promise<string | null>;
//# sourceMappingURL=supabaseClient.d.ts.map