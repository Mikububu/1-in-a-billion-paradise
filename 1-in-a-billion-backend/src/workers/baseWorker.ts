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
      await this.syncJobStatus(task.job_id);

    } catch (error: any) {
      console.error(`❌ Task failed: ${task.id} - ${error.message}`);

      // Mark as failed (will retry if attempts < max)
      const failErrorMessage = error?.message || 'Unknown error';
      try {
        const { error: failRpcError } = await supabase!.rpc('fail_task', {
          p_task_id: task.id,
          p_worker_id: this.workerId,
          p_error: failErrorMessage,
        });

        // Some environments may not have fail_task() deployed (PostgREST schema cache PGRST202),
        // which would otherwise leave tasks stuck in "processing" forever.
        if (failRpcError) {
          throw failRpcError;
        }
      } catch (rpcErr: any) {
        console.warn(`⚠️ fail_task RPC failed; falling back to direct update: ${rpcErr?.message || String(rpcErr)}`);

        // Fallback: emulate fail_task behavior directly.
        const { data: currentTask, error: readErr } = await supabase!
          .from('job_tasks')
          .select('attempts, max_attempts')
          .eq('id', task.id)
          .single();

        if (readErr || !currentTask) {
          console.error('❌ Failed to read job_tasks for fallback fail:', readErr?.message || 'unknown');
        } else {
          const attempts = Number((currentTask as any).attempts || 0);
          const maxAttempts = Number((currentTask as any).max_attempts || 3);
          const nextAttempts = attempts + 1;
          const nextStatus = nextAttempts >= maxAttempts ? 'failed' : 'pending';

          const { error: updateErr } = await supabase!
            .from('job_tasks')
            .update({
              status: nextStatus,
              attempts: nextAttempts,
              error: failErrorMessage,
              worker_id: null,
              claimed_at: null,
              started_at: null,
              last_heartbeat: null,
              updated_at: new Date().toISOString(),
            })
            .eq('id', task.id);

          if (updateErr) {
            console.error('❌ Fallback fail update failed:', updateErr?.message || 'unknown');
          }
        }
      }

      await this.syncJobStatus(task.job_id);
    } finally {
      // Stop heartbeat
      this.stopHeartbeat(task.id);
    }
  }

  /**
   * Ensure jobs.status/progress reflects current task state.
   * Some deployments may be missing DB triggers that update job status on task changes.
   */
  private async syncJobStatus(jobId: string): Promise<void> {
    if (!supabase) return;

    try {
      const { data: tasks, error: tasksErr } = await supabase
        .from('job_tasks')
        .select('status,error')
        .eq('job_id', jobId);

      if (tasksErr || !tasks) return;

      const rows = tasks as Array<{ status: string; error: string | null }>;
      const total = rows.length;
      const complete = rows.filter((t) => t.status === 'complete').length;
      const failed = rows.filter((t) => t.status === 'failed').length;
      const done = complete + failed;

      const percent = total > 0 ? Math.round((complete / total) * 100) : 0;

      // Preserve existing progress fields where possible
      const { data: jobRow } = await supabase
        .from('jobs')
        .select('progress')
        .eq('id', jobId)
        .single();

      const prevProgress = (jobRow as any)?.progress || {};

      if (failed > 0 && done === total) {
        const firstError = rows.find((t) => t.status === 'failed')?.error || 'Some tasks failed';
        await supabase
          .from('jobs')
          .update({
            status: 'error',
            error: firstError,
            progress: {
              ...prevProgress,
              phase: 'error',
              message: 'Some tasks failed',
              percent,
              tasksComplete: complete,
              tasksTotal: total,
            },
            completed_at: new Date().toISOString(),
          })
          .eq('id', jobId);
      } else if (total > 0 && complete === total) {
        await supabase
          .from('jobs')
          .update({
            status: 'complete',
            progress: {
              ...prevProgress,
              phase: 'complete',
              message: 'Generation complete!',
              percent: 100,
              tasksComplete: complete,
              tasksTotal: total,
            },
            completed_at: new Date().toISOString(),
          })
          .eq('id', jobId);
      } else if (total > 0) {
        await supabase
          .from('jobs')
          .update({
            status: 'processing',
            progress: {
              ...prevProgress,
              phase: 'processing',
              message: `Processing... (${complete}/${total} tasks complete)`,
              percent,
              tasksComplete: complete,
              tasksTotal: total,
            },
          })
          .eq('id', jobId);
      }
    } catch {
      // Best-effort; don't fail tasks for sync errors.
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
   * Generate user-friendly filename matching frontend format
   * 
   * Formats (matching frontend fileNames.ts):
   * - PDF: PersonName_SystemName_v1.0.pdf
   * - Audio: PersonName_SystemName_audio.mp3
   * - Synastry PDF: Person1_Person2_Synastry_v1.0.pdf
   * - Overlay Audio: Person1_Person2_System_audio.mp3
   */
  private generateFriendlyFileName(
    params: any,
    task: JobTask,
    artifactType: string,
    extension: string
  ): string {
    // Clean function matching frontend cleanForFilename()
    const cleanForFilename = (str: string): string => {
      if (!str || typeof str !== 'string') return 'Unknown';
      return str
        .trim()
        .replace(/[^a-zA-Z0-9\s]/g, '') // Remove special chars
        .replace(/\s+/g, '_')           // Spaces to underscores
        .replace(/_+/g, '_')            // Collapse multiple underscores
        .replace(/^_|_$/g, '');         // Trim leading/trailing underscores
    };
    
    // Extract person names from params
    const person1Name = cleanForFilename(params?.person1?.name || params?.person1Name || 'Person1');
    const person2Name = params?.person2?.name ? cleanForFilename(params.person2.name) : null;
    
    // Extract system and doc info from task input
    // FALLBACK: Parse from title if not set (e.g., "kabbalah - Person 2" → system="kabbalah", docType="person2")
    let systemRaw = task.input?.system;
    let docType = task.input?.docType;
    const docNum = task.input?.docNum;
    const title = task.input?.title as string | undefined;
    
    // If system/docType not set, try to extract from title (format: "system - DocType")
    if ((!systemRaw || !docType) && title) {
      const titleMatch = title.match(/^(\w+)\s*-\s*(.+)$/i);
      if (titleMatch) {
        if (!systemRaw) {
          systemRaw = titleMatch[1].toLowerCase(); // e.g., "kabbalah", "human_design"
        }
        if (!docType) {
          const docTypePart = titleMatch[2].toLowerCase().trim();
          if (docTypePart.includes('overlay')) docType = 'overlay';
          else if (docTypePart.includes('person 2') || docTypePart.includes('person2')) docType = 'person2';
          else if (docTypePart.includes('person 1') || docTypePart.includes('person1')) docType = 'person1';
          else if (docTypePart.includes('verdict')) docType = 'verdict';
          else docType = 'individual';
        }
      }
    }
    
    // Final fallbacks
    systemRaw = systemRaw || params?.systems?.[0] || 'western';
    docType = docType || 'individual';
    const system = cleanForFilename(systemRaw.charAt(0).toUpperCase() + systemRaw.slice(1)); // Capitalize first letter
    
    // Build filename based on artifact type and context
    let fileName: string;
    const PDF_VERSION = 'v1.0'; // Match frontend FEATURES.PDF_VERSION
    
    if (artifactType === 'audio_mp3' || artifactType === 'audio_m4a') {
      // Audio format: PersonName_SystemName_audio.mp3
      // For overlay/synastry: Person1_Person2_System_audio.mp3
      if (person2Name && (docType === 'overlay' || docType === 'synastry' || docType === 'person2')) {
        fileName = `${person1Name}_${person2Name}_${system}_audio`;
      } else {
        fileName = `${person1Name}_${system}_audio`;
      }
    } else if (artifactType === 'pdf') {
      // PDF format: PersonName_SystemName_v1.0.pdf
      // For synastry: Person1_Person2_Synastry_v1.0.pdf
      // For overlay: Person1_Person2_System_v1.0.pdf
      if (person2Name && (docType === 'overlay' || docType === 'synastry')) {
        if (docType === 'synastry') {
          fileName = `${person1Name}_${person2Name}_Synastry_${PDF_VERSION}`;
        } else {
          fileName = `${person1Name}_${person2Name}_${system}_${PDF_VERSION}`;
        }
      } else if (title && title !== 'Untitled' && title !== 'Reading') {
        // Use title if available (for special documents)
        const cleanTitle = cleanForFilename(title);
        fileName = `${cleanTitle}_${person1Name}_${PDF_VERSION}`;
      } else {
        // Standard format: PersonName_SystemName_v1.0.pdf
        fileName = `${person1Name}_${system}_${PDF_VERSION}`;
      }
    } else {
      // Text/JSON files: PersonName_SystemName_text.txt
      if (person2Name && (docType === 'overlay' || docType === 'synastry')) {
        fileName = `${person1Name}_${person2Name}_${system}_${artifactType}`;
      } else {
        fileName = `${person1Name}_${system}_${artifactType}`;
      }
    }
    
    return `${fileName}.${extension}`;
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

    // Get job to determine user_id and params for friendly naming
    const { data: job, error: jobError } = await supabase
      .from('jobs')
      .select('user_id, params')
      .eq('id', task.job_id)
      .single();

    if (jobError || !job) {
      throw new Error('Failed to get job for artifact upload');
    }

    // Generate storage path.
    // IMPORTANT:
    // - Queue task inputs (e.g. pdf/audio/song) reference text artifacts by a deterministic path
    //   (`.../text/<sourceTaskId>.txt`). If we store text files with "friendly" names, downstream
    //   workers cannot download them and jobs will stall.
    // - So: keep text artifacts deterministic by task.id, and keep friendly naming for user-facing
    //   artifacts (pdf/audio/song) where internal linking does not depend on filename.
    // NOTE: artifact.type is not always in the form "foo_bar" (e.g. "text").
    const extension =
      artifact.type === 'audio_mp3' ? 'mp3' :
        artifact.type === 'audio_m4a' ? 'm4a' :
          artifact.type === 'pdf' ? 'pdf' :
            artifact.type === 'json' ? 'json' :
              artifact.type === 'text' ? 'txt' :
                'bin';

    // Storage path:
    // - text: user_id/job_id/text/<taskId>.txt  (deterministic; used by downstream tasks)
    // - other: user_id/job_id/<artifact_type>/<friendly_filename>
    const storagePath =
      artifact.type === 'text'
        ? `${job.user_id}/${task.job_id}/text/${task.id}.${extension}`
        : `${job.user_id}/${task.job_id}/${artifact.type}/${this.generateFriendlyFileName(job.params, task, artifact.type, extension)}`;

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


