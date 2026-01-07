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

import os from 'os';
import { supabase, JobTask, TaskType, uploadArtifact } from '../services/supabaseClient';
import { registerTaskContext } from './workerCrashGuards';
import './workerCrashGuards'; // Register global handlers

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

export abstract class BaseWorker {
  protected workerId: string;
  protected taskTypes: TaskType[];
  protected maxConcurrentTasks: number;
  protected pollingIntervalMs: number;
  protected maxPollingIntervalMs: number;
  protected running: boolean = false;
  protected activeHeartbeats: Map<string, NodeJS.Timeout> = new Map();

  constructor(options: {
    workerId?: string;
    taskTypes: TaskType[];
    maxConcurrentTasks?: number;
    pollingIntervalMs?: number;
    maxPollingIntervalMs?: number;
  }) {
    this.workerId = options.workerId || `worker-${os.hostname()}-${process.pid}`;
    this.taskTypes = options.taskTypes;
    this.maxConcurrentTasks = options.maxConcurrentTasks || 5;
    this.pollingIntervalMs = options.pollingIntervalMs || 5000;
    this.maxPollingIntervalMs = options.maxPollingIntervalMs || 30000;

    console.log(`🤖 Worker initialized: ${this.workerId}`);
    console.log(`   Task types: ${this.taskTypes.join(', ')}`);
    console.log(`   Max concurrent: ${this.maxConcurrentTasks}`);
  }

  /**
   * Start worker loop (blocking)
   */
  async start(): Promise<void> {
    if (!supabase) {
      throw new Error('Supabase not configured');
    }

    this.running = true;
    console.log(`▶️ Worker started: ${this.workerId}`);

    let currentBackoff = this.pollingIntervalMs;

    while (this.running) {
      try {
        // Claim tasks
        const tasks = await this.claimTasks();

        if (tasks.length === 0) {
          // Exponential backoff when idle
          currentBackoff = Math.min(currentBackoff * 2, this.maxPollingIntervalMs);
          await this.sleep(currentBackoff);
          continue;
        }

        // Reset backoff on work
        currentBackoff = this.pollingIntervalMs;
        console.log(`📋 Claimed ${tasks.length} task(s)`);

        // Process tasks in parallel (up to maxConcurrentTasks)
        await Promise.all(tasks.map(task => this.processSafeTask(task)));

      } catch (error: any) {
        console.error('❌ Worker loop error:', error.message);
        await this.sleep(10000); // Cool down on error
      }
    }

    console.log(`⏹ Worker stopped: ${this.workerId}`);
  }

  /**
   * Stop worker gracefully
   */
  stop(): void {
    console.log(`⏸ Stopping worker: ${this.workerId}`);
    this.running = false;

    // Stop all heartbeats
    for (const [taskId, interval] of this.activeHeartbeats.entries()) {
      clearInterval(interval);
      console.log(`💔 Stopped heartbeat for task: ${taskId}`);
    }
    this.activeHeartbeats.clear();
  }

  /**
   * Claim tasks from queue
   */
  private async claimTasks(): Promise<JobTask[]> {
    if (!supabase) return [];

    const { data, error } = await supabase.rpc('claim_tasks', {
      p_worker_id: this.workerId,
      p_max_tasks: this.maxConcurrentTasks,
      p_task_types: this.taskTypes,
    });

    if (error) {
      console.error('Failed to claim tasks:', error);
      return [];
    }

    return (data as JobTask[]) || [];
  }

  /**
   * Process task with error handling + retries
   */
  private async processSafeTask(task: JobTask): Promise<void> {
    try {
      // Start heartbeat
      this.startHeartbeat(task.id);

      // Register context for crash handling
      registerTaskContext(task.id, task.job_id);

      // Update status to processing
      await supabase?.from('job_tasks').update({ status: 'processing' }).eq('id', task.id);

      // Process task (implemented by subclass)
      const result = await this.processTask(task);

      if (!result.success) {
        throw new Error(result.error || 'Task failed');
      }

      // Upload artifacts if any
      if (result.artifacts && result.artifacts.length > 0) {
        for (const artifact of result.artifacts) {
          await this.uploadTaskArtifact(task, artifact);
        }
      }

      // Mark complete
      const { error: completeError } = await supabase!.rpc('complete_task', {
        p_task_id: task.id,
        p_worker_id: this.workerId,
        p_output: result.output || {},
      });

      if (completeError) {
        throw new Error(`Failed to complete task: ${completeError.message}`);
      }

      console.log(`✅ Task complete: ${task.id}`);

    } catch (error: any) {
      console.error(`❌ Task failed: ${task.id} - ${error.message}`);

      // Mark as failed (will retry if attempts < max)
      await supabase?.rpc('fail_task', {
        p_task_id: task.id,
        p_worker_id: this.workerId,
        p_error: error.message || 'Unknown error',
      });

    } finally {
      // Stop heartbeat
      this.stopHeartbeat(task.id);
    }
  }

  /**
   * Abstract method: Implement task processing logic in subclass
   */
  protected abstract processTask(task: JobTask): Promise<TaskResult>;

  /**
   * Start heartbeat for task
   */
  private startHeartbeat(taskId: string): void {
    if (this.activeHeartbeats.has(taskId)) return;

    const interval = setInterval(async () => {
      const { data, error } = await supabase?.rpc('heartbeat_task', {
        p_task_id: taskId,
        p_worker_id: this.workerId,
      });

      if (error || !data) {
        console.warn(`⚠️ Heartbeat failed for task ${taskId}:`, error?.message);
      } else {
        console.log(`💓 Heartbeat: ${taskId}`);
      }
    }, 60000); // Every 60 seconds

    this.activeHeartbeats.set(taskId, interval);
  }

  /**
   * Stop heartbeat for task
   */
  private stopHeartbeat(taskId: string): void {
    const interval = this.activeHeartbeats.get(taskId);
    if (interval) {
      clearInterval(interval);
      this.activeHeartbeats.delete(taskId);
    }
  }

  /**
   * Upload artifact to Storage and create DB record
   */
  private async uploadTaskArtifact(
    task: JobTask,
    artifact: {
      type: 'audio_mp3' | 'audio_m4a' | 'pdf' | 'json' | 'text';
      buffer: Buffer;
      contentType: string;
      metadata?: any;
    }
  ): Promise<void> {
    if (!supabase) return;

    // Get job to determine user_id
    const { data: job, error: jobError } = await supabase
      .from('jobs')
      .select('user_id')
      .eq('id', task.job_id)
      .single();

    if (jobError || !job) {
      throw new Error('Failed to get job for artifact upload');
    }

    // Generate storage path
    // NOTE: artifact.type is not always in the form "foo_bar" (e.g. "text").
    const extension =
      artifact.type === 'audio_mp3' ? 'mp3' :
        artifact.type === 'audio_m4a' ? 'm4a' :
          artifact.type === 'pdf' ? 'pdf' :
            artifact.type === 'json' ? 'json' :
              artifact.type === 'text' ? 'txt' :
                'bin';
    const storagePath = `${job.user_id}/${task.job_id}/${artifact.type}/${task.id}.${extension}`;

    // Upload to Storage
    const uploadedPath = await uploadArtifact(storagePath, artifact.buffer, artifact.contentType);
    if (!uploadedPath) {
      throw new Error('Failed to upload artifact to Storage');
    }

    // Create artifact record
    const { error: artifactError } = await supabase.from('job_artifacts').upsert({
      job_id: task.job_id,
      task_id: task.id,
      artifact_type: artifact.type,
      storage_path: storagePath,
      bucket_name: 'job-artifacts',
      content_type: artifact.contentType,
      file_size_bytes: artifact.buffer.length,
      duration_seconds: artifact.metadata?.duration,
      metadata: artifact.metadata || {},
    }, {
      onConflict: 'job_id,task_id,artifact_type',
    });

    if (artifactError) {
      throw new Error(`Failed to create artifact record: ${artifactError.message}`);
    }

    console.log(`📦 Artifact uploaded: ${storagePath}`);
  }

  /**
   * Helper: Sleep
   */
  protected sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}


