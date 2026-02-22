/**
 * JOB QUEUE V2 - SUPABASE DISTRIBUTED QUEUE
 * 
 * Horizontally scalable job queue using:
 * - Supabase Postgres for state
 * - Supabase Storage for artifacts (no base64 in DB)
 * - Stateless workers with distributed task claiming
 */

import { supabase, supabaseUser, Job, JobTask, JobArtifact, TaskType, getSignedArtifactUrl } from './supabaseClient';

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

export class JobQueueV2 {
  /**
   * Create a new job with tasks
   */
  async createJob({ userId, type, params, tasks = [] }: CreateJobParams): Promise<string> {
    if (!supabase) {
      throw new Error('Supabase not configured');
    }

    // Create job
    const { data: job, error: jobError } = await supabase
      .from('jobs')
      .insert({
        user_id: userId,
        type,
        params,
        status: 'queued',
        progress: {
          percent: 0,
          phase: 'queued',
          systemsCompleted: 0,
          totalSystems: params.systems?.length || 1,
          message: 'Job queued...',
        },
        attempts: 0,
        max_attempts: 3,
      })
      .select()
      .single();

    if (jobError || !job) {
      throw new Error(`Failed to create job: ${jobError?.message}`);
    }

    console.log(`[PIPELINE] created jobId=${job.id} type=${type} user=${userId}`);

    // Create tasks if provided
    if (tasks.length > 0) {
      const taskInserts = tasks.map(task => ({
        job_id: job.id,
        task_type: task.taskType,
        sequence: task.sequence,
        input: task.input,
        status: 'pending' as const,
        attempts: 0,
        max_attempts: 3,
        heartbeat_timeout_seconds: 600, // 10 minutes
      }));

      const { error: tasksError } = await supabase
        .from('job_tasks')
        .insert(taskInserts);

      if (tasksError) {
        throw new Error(`Failed to create tasks: ${tasksError.message}`);
      }

      console.log(`📋 Created ${tasks.length} tasks for job ${job.id}`);
    }

    return job.id;
  }

  /**
   * Get job with artifacts (for API)
   */
  async getJob(jobId: string, userId?: string): Promise<Job & { artifacts?: JobArtifact[] } | null> {
    if (!supabase) return null;

    const query = supabase
      .from('jobs')
      .select(`
        *,
        artifacts:job_artifacts(*)
      `)
      .eq('id', jobId);

    // Add user filter if provided (RLS will enforce this anyway)
    if (userId) {
      query.eq('user_id', userId);
    }

    const { data: job, error } = await query.single();

    if (error || !job) {
      return null;
    }

    // Generate signed URLs for artifacts (parallel for speed)
    if (job.artifacts && Array.isArray(job.artifacts)) {
      await Promise.all(
        job.artifacts.map(async (artifact: any) => {
          if (!artifact.public_url) {
            artifact.public_url = await getSignedArtifactUrl(artifact.storage_path) || undefined;
          }
        })
      );
    }

    return job as Job & { artifacts?: JobArtifact[] };
  }

  /**
   * Get job tasks (for debugging/monitoring)
   */
  async getJobTasks(jobId: string): Promise<JobTask[]> {
    if (!supabase) return [];

    const { data: tasks, error } = await supabase
      .from('job_tasks')
      .select('*')
      .eq('job_id', jobId)
      .order('sequence', { ascending: true });

    if (error) {
      console.error('Failed to get tasks:', error);
      return [];
    }

    return tasks || [];
  }

  /**
   * Update job progress (called by workers or API)
   */
  async updateProgress(jobId: string, progress: Partial<Job['progress']>): Promise<boolean> {
    if (!supabase) return false;

    const { data, error } = await supabase.rpc('update_job_progress', {
      p_job_id: jobId,
      p_progress: progress,
    });

    if (error) {
      console.error('Failed to update progress:', error);
      return false;
    }

    return data || false;
  }

  /**
   * Mark job as complete (usually done by trigger, but can be manual)
   */
  async completeJob(jobId: string): Promise<boolean> {
    if (!supabase) return false;

    const { error } = await supabase
      .from('jobs')
      .update({
        status: 'complete',
        completed_at: new Date().toISOString(),
        progress: {
          percent: 100,
          phase: 'complete',
          systemsCompleted: 0,
          totalSystems: 0,
          message: 'Generation complete!',
        },
      })
      .eq('id', jobId);

    if (error) {
      console.error('Failed to complete job:', error);
      return false;
    }

    console.log(`[PIPELINE] jobId=${jobId} phase=complete (manual complete)`);

    // Auto-extract essences (fire and forget - don't block completion)
    this.extractEssencesAsync(jobId).catch((err) => {
      console.warn(`⚠️  Essence extraction failed for job ${jobId}:`, err.message);
      // Don't fail the job - essences are optional
    });

    return true;
  }

  /**
   * Extract and save system essences from completed job readings (async)
   */
  private async extractEssencesAsync(jobId: string): Promise<void> {
    if (!supabase) return;

    console.log(`🔍 Extracting essences for job ${jobId}...`);

    // Import dynamically to avoid circular deps
    const { extractAllEssences, generateEssencesFromPlacements } = await import('../services/essenceExtractionService');
    const { swissEngine } = await import('../services/swissEphemeris');

    // Get job to find person IDs
    const { data: job, error: jobError } = await supabase
      .from('jobs')
      .select('params')
      .eq('id', jobId)
      .single();

    if (jobError || !job) return;

    const params: any = job.params || {};
    const person1Id = params.person1?.id || params.person1_id;
    const person2Id = params.person2?.id || params.person2_id;

    if (!person1Id) return;

    // Get text artifacts
    const { data: artifacts } = await supabase
      .from('job_artifacts')
      .select('*')
      .eq('job_id', jobId)
      .eq('artifact_type', 'text');

    if (!artifacts || artifacts.length === 0) return;

    // Organize readings by person and system
    const person1Readings: Record<string, string> = {};
    const person2Readings: Record<string, string> = {};

    for (const artifact of artifacts) {
      const meta: any = artifact.metadata || {};
      const docType = meta.docType;
      const system = meta.system;

      if (!system) continue;

      // Download text
      let text = '';
      if (artifact.storage_path) {
        const { data } = await supabase.storage
          .from('job-artifacts')
          .download(artifact.storage_path);
        if (data) text = await data.text();
      }

      if (!text) continue;

      if (docType === 'person1' || docType === 'individual') {
        person1Readings[system] = text;
      } else if (docType === 'person2') {
        person2Readings[system] = text;
      }
    }

    // Extract and save essences for person1
    if (Object.keys(person1Readings).length > 0) {
      let essences = extractAllEssences(person1Readings);
      
      // DETERMINISTIC FALLBACK: If we have params, generate reliable essences from placements
      if (params.person1) {
        try {
          const placements = await swissEngine.computePlacements({
            birthDate: params.person1.birthDate,
            birthTime: params.person1.birthTime,
            timezone: params.person1.timezone,
            latitude: params.person1.latitude,
            longitude: params.person1.longitude,
            relationshipIntensity: params.relationshipIntensity || 5,
            relationshipMode: 'sensual',
            primaryLanguage: 'en',
          });
          const deterministic = generateEssencesFromPlacements(placements);
          essences = { ...essences, ...deterministic };
          console.log(`   ✓ Person 1 essences supplemented with deterministic data`);
        } catch (err) {
          console.warn(`   ⚠️  Failed to generate deterministic essences for P1:`, err);
        }
      }

      if (Object.keys(essences).length > 0) {
        await supabase.from('people').update({ essences }).eq('id', person1Id);
        console.log(`   ✓ Person 1 essences saved`);
      }
    }

    // Extract and save essences for person2
    if (person2Id && Object.keys(person2Readings).length > 0) {
      let essences = extractAllEssences(person2Readings);

      // DETERMINISTIC FALLBACK: If we have params, generate reliable essences from placements
      if (params.person2) {
        try {
          const placements = await swissEngine.computePlacements({
            birthDate: params.person2.birthDate,
            birthTime: params.person2.birthTime,
            timezone: params.person2.timezone,
            latitude: params.person2.latitude,
            longitude: params.person2.longitude,
            relationshipIntensity: params.relationshipIntensity || 5,
            relationshipMode: 'sensual',
            primaryLanguage: 'en',
          });
          const deterministic = generateEssencesFromPlacements(placements);
          essences = { ...essences, ...deterministic };
          console.log(`   ✓ Person 2 essences supplemented with deterministic data`);
        } catch (err) {
          console.warn(`   ⚠️  Failed to generate deterministic essences for P2:`, err);
        }
      }

      if (Object.keys(essences).length > 0) {
        await supabase.from('people').update({ essences }).eq('id', person2Id);
        console.log(`   ✓ Person 2 essences saved`);
      }
    }
  }

  /**
   * Mark job as failed
   */
  async failJob(jobId: string, errorMessage: string): Promise<boolean> {
    if (!supabase) return false;

    const { error } = await supabase
      .from('jobs')
      .update({
        status: 'error',
        error: errorMessage,
        completed_at: new Date().toISOString(),
      })
      .eq('id', jobId);

    if (error) {
      console.error('Failed to mark job as failed:', error);
      return false;
    }

    console.error(`❌ Job failed: ${jobId} - ${errorMessage}`);
    return true;
  }

  /**
   * Cancel job (soft delete)
   */
  async cancelJob(jobId: string): Promise<boolean> {
    if (!supabase) return false;

    const { error } = await supabase
      .from('jobs')
      .update({
        status: 'cancelled',
        completed_at: new Date().toISOString(),
      })
      .eq('id', jobId);

    if (error) {
      console.error('Failed to cancel job:', error);
      return false;
    }

    console.log(`🛑 Job cancelled: ${jobId}`);
    return true;
  }

  /**
   * Get all jobs for a user (for dashboard)
   */
  async getUserJobs(userId: string, limit = 50): Promise<Job[]> {
    if (!supabase) return [];

    const { data: jobs, error } = await supabase
      .from('jobs')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) {
      console.error('Failed to get user jobs:', error);
      return [];
    }

    return jobs || [];
  }

  /**
   * Get queue stats (for monitoring)
   */
  async getQueueStats(): Promise<{
    pendingTasks: number;
    processingTasks: number;
    completedJobs: number;
    errorJobs: number;
    activeWorkers: number;
  }> {
    if (!supabase) {
      return {
        pendingTasks: 0,
        processingTasks: 0,
        completedJobs: 0,
        errorJobs: 0,
        activeWorkers: 0,
      };
    }

    // Get task counts
    const { data: taskStats } = await supabase
      .from('job_tasks')
      .select('status')
      .in('status', ['pending', 'claimed', 'processing']);

    // Get job counts
    const { data: jobStats } = await supabase
      .from('jobs')
      .select('status')
      .in('status', ['complete', 'error']);

    // Get active workers
    const { data: workers } = await supabase
      .from('job_tasks')
      .select('worker_id')
      .in('status', ['claimed', 'processing'])
      .not('worker_id', 'is', null);

    const uniqueWorkers = new Set((workers || []).map((w: { worker_id: string | null }) => w.worker_id)).size;

    const pendingTasks = taskStats?.filter((t: { status: string }) => t.status === 'pending').length || 0;
    const processingTasks = taskStats?.filter((t: { status: string }) => t.status === 'claimed' || t.status === 'processing').length || 0;
    const completedJobs = jobStats?.filter((j: { status: string }) => j.status === 'complete').length || 0;
    const errorJobs = jobStats?.filter((j: { status: string }) => j.status === 'error').length || 0;

    return {
      pendingTasks,
      processingTasks,
      completedJobs,
      errorJobs,
      activeWorkers: uniqueWorkers,
    };
  }

  /**
   * Cleanup old completed jobs (run periodically)
   */
  async cleanupOldJobs(maxAgeHours = 24): Promise<number> {
    if (!supabase) return 0;

    const cutoff = new Date(Date.now() - maxAgeHours * 60 * 60 * 1000).toISOString();

    const { data, error } = await supabase
      .from('jobs')
      .delete()
      .eq('status', 'complete')
      .lt('completed_at', cutoff)
      .select();

    if (error) {
      console.error('Failed to cleanup old jobs:', error);
      return 0;
    }

    const count = data?.length || 0;
    if (count > 0) {
      console.log(`🧹 Cleaned up ${count} old jobs`);
    }

    return count;
  }
}

// Singleton instance
export const jobQueueV2 = new JobQueueV2();


