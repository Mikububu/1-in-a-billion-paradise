/**
 * SUPABASE CLIENT - Service Role Access
 * 
 * This client uses the SERVICE_ROLE_KEY to bypass RLS.
 * Workers use this to claim tasks from any user's jobs.
 */

import { createClient } from '@supabase/supabase-js';
import { env } from '../config/env';

// Type definitions for database schema
export type JobStatus = 'queued' | 'processing' | 'complete' | 'error' | 'cancelled';
export type JobType = 'extended' | 'synastry' | 'nuclear' | 'nuclear_v2';
export type JobPhase = 'queued' | 'calculating' | 'text' | 'pdf' | 'audio' | 'finalizing' | 'complete' | 'error';

export type TaskStatus = 'pending' | 'claimed' | 'processing' | 'complete' | 'failed';
export type TaskType = 'text_generation' | 'pdf_generation' | 'audio_generation' | 'synastry_calc' | 'song_generation';

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

// Database schema type
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

// Validate environment variables
if (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) {
  console.warn('⚠️ Supabase credentials missing. Queue V2 disabled.');
}

// Create client (service role for workers)
export const supabase: any = env.SUPABASE_URL && env.SUPABASE_SERVICE_ROLE_KEY
  ? (createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    }) as any)
  : null;


// Convenience: create or return the service-role Supabase client
export function createSupabaseServiceClient() {
  return supabase;
}

// Create client for user-facing API (respects RLS)
export const supabaseUser: any = env.SUPABASE_URL && env.SUPABASE_ANON_KEY
  ? (createClient(env.SUPABASE_URL, env.SUPABASE_ANON_KEY) as any)
  : null;

/**
 * Create a user-scoped Supabase client from a Supabase access token.
 * This respects RLS because it uses the anon key + Authorization header.
 */
export function createSupabaseUserClientFromAccessToken(accessToken: string) {
  if (!env.SUPABASE_URL || !env.SUPABASE_ANON_KEY) return null;
  if (!accessToken) return null;

  return createClient(env.SUPABASE_URL, env.SUPABASE_ANON_KEY, {
    global: {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    },
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  }) as any;
}

/**
 * Helper: Get signed URL for artifact (1 hour expiry)
 */
export async function getSignedArtifactUrl(storagePath: string, expiresIn = 3600): Promise<string | null> {
  if (!supabase) return null;
  
  const { data, error } = await supabase.storage
    .from('job-artifacts')
    .createSignedUrl(storagePath, expiresIn);
  
  if (error) {
    console.error('Failed to create signed URL:', error);
    return null;
  }
  
  return data.signedUrl;
}

/**
 * Helper: Upload artifact to Storage
 */
export async function uploadArtifact(
  storagePath: string,
  buffer: Buffer,
  contentType: string
): Promise<string | null> {
  if (!supabase) return null;
  
  const { data, error } = await supabase.storage
    .from('job-artifacts')
    .upload(storagePath, buffer, {
      contentType,
      upsert: true, // Idempotent
    });
  
  if (error) {
    console.error('Failed to upload artifact:', error);
    return null;
  }
  
  return data.path;
}


