/**
 * JOB QUEUE SYSTEM - PERSISTENT STORAGE
 * 
 * Handles long-running reading generation jobs in the background.
 * Jobs are persisted to JSON files so they survive backend restarts.
 */

import { v4 as uuidv4 } from 'uuid';
import fs from 'fs';
import path from 'path';

// Storage directory for job files
const JOBS_DIR = path.resolve(__dirname, '../../jobs-data');

// Recovery behavior (prevents orphaned jobs on restart)
const JOB_RECOVERY_MODE = (process.env.JOB_RECOVERY_MODE || 'retry').toLowerCase();
const JOB_MAX_ATTEMPTS = Number(process.env.JOB_MAX_ATTEMPTS || 3);
// Must be larger than the longest single LLM/TTS step (to avoid false positives)
const JOB_STALL_TIMEOUT_MS = Number(process.env.JOB_STALL_TIMEOUT_MS || 30 * 60 * 1000);
// Maximum concurrent jobs to process in parallel (for stress testing multiple users)
const MAX_CONCURRENT_JOBS = Number(process.env.MAX_CONCURRENT_JOBS || 5);


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
  type: 'extended' | 'synastry' | 'nuclear' | 'nuclear_v2';
  status: 'queued' | 'processing' | 'complete' | 'error';
  progress: JobProgress;
  createdAt: Date;
  updatedAt: Date;
  completedAt?: Date;

  // Retry/recovery tracking
  attempts?: number;
  
  // Input data
  params: any;
  
  // Output data (when complete)
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
    // Nuclear V2: 16 documents structure
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
  
  // Error info
  error?: string;
}

// In-memory job store (synced with disk)
const jobs: Map<string, Job> = new Map();

// Job processing functions (to be set by the routes)
type JobProcessor = (job: Job, updateProgress: (progress: Partial<JobProgress>) => void) => Promise<void>;
const processors: Map<string, JobProcessor> = new Map();

// ═══════════════════════════════════════════════════════════════════════════
// PERSISTENCE FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════

function ensureJobsDir(): void {
  if (!fs.existsSync(JOBS_DIR)) {
    fs.mkdirSync(JOBS_DIR, { recursive: true });
    console.log(`📁 Created jobs directory: ${JOBS_DIR}`);
  }
}

function saveJobToDisk(job: Job): void {
  ensureJobsDir();
  const filePath = path.join(JOBS_DIR, `${job.id}.json`);
  fs.writeFileSync(filePath, JSON.stringify(job, null, 2));
}

function loadJobsFromDisk(): void {
  ensureJobsDir();
  
  const files = fs.readdirSync(JOBS_DIR).filter(f => f.endsWith('.json'));
  
  for (const file of files) {
    try {
      const filePath = path.join(JOBS_DIR, file);
      const data = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
      
      // Convert date strings back to Date objects
      data.createdAt = new Date(data.createdAt);
      data.updatedAt = new Date(data.updatedAt);
      if (data.completedAt) data.completedAt = new Date(data.completedAt);
      
      jobs.set(data.id, data);
    } catch (error) {
      console.error(`Failed to load job file ${file}:`, error);
    }
  }
  
  console.log(`📂 Loaded ${jobs.size} jobs from disk`);
  
  // ═══════════════════════════════════════════════════════════════════════════
  // RECOVERY: handle jobs that were 'processing' when the backend restarted
  // Default is to RE-QUEUE so jobs resume automatically once processors register.
  // Set JOB_RECOVERY_MODE=error to keep the old behavior.
  // ═══════════════════════════════════════════════════════════════════════════
  let recoveredCount = 0;
  let failedCount = 0;

  for (const [id, job] of jobs.entries()) {
    if (job.status !== 'processing') continue;

    const nextAttempts = (job.attempts ?? 0) + 1;

    const forceError = JOB_RECOVERY_MODE === 'error' || nextAttempts > JOB_MAX_ATTEMPTS;
    if (forceError) {
      console.log(`⚠️ Found orphaned job: ${id} (${job.type}) - marking as error`);
      job.status = 'error';
      job.attempts = nextAttempts;
      job.progress = {
        ...job.progress,
        phase: 'error',
        message: 'Job interrupted during processing and could not be recovered automatically. Please retry.',
        currentStep: 'Interrupted on restart',
      };
      job.error = 'Backend restarted while job was processing';
      job.updatedAt = new Date();
      jobs.set(id, job);
      saveJobToDisk(job);
      failedCount++;
      continue;
    }

    console.log(`🛟 Re-queuing orphaned job: ${id} (${job.type}) attempt ${nextAttempts}/${JOB_MAX_ATTEMPTS}`);
    job.status = 'queued';
    job.attempts = nextAttempts;
    job.progress = {
      ...job.progress,
      phase: 'queued',
      message: 'Recovered after restart - resuming automatically...',
      currentStep: 'Recovered after restart',
    };
    job.error = undefined;
    job.updatedAt = new Date();
    jobs.set(id, job);
    saveJobToDisk(job);
    recoveredCount++;
  }

  if (recoveredCount > 0) {
    console.log(`🛟 Re-queued ${recoveredCount} interrupted job(s) for automatic resume`);
  }
  if (failedCount > 0) {
    console.log(`🧹 Marked ${failedCount} interrupted job(s) as error`);
  }
}

function deleteJobFromDisk(id: string): void {
  const filePath = path.join(JOBS_DIR, `${id}.json`);
  if (fs.existsSync(filePath)) {
    fs.unlinkSync(filePath);
  }
}

// Load jobs on startup
loadJobsFromDisk();

// Periodic watchdog: if a job is stuck in 'processing' with no progress updates, re-queue it.
function startStalledJobWatchdog(): void {
  const intervalMs = Math.max(30_000, Math.min(120_000, Math.floor(JOB_STALL_TIMEOUT_MS / 4)));

  setInterval(() => {
    const now = Date.now();
    let requeued = 0;
    let failed = 0;

    for (const [id, job] of jobs.entries()) {
      if (job.status != 'processing') continue;
      const ageMs = now - new Date(job.updatedAt).getTime();
      if (ageMs < JOB_STALL_TIMEOUT_MS) continue;

      const nextAttempts = (job.attempts ?? 0) + 1;
      if (nextAttempts > JOB_MAX_ATTEMPTS) {
        console.log(`🧹 Watchdog: job ${id} exceeded max attempts (${JOB_MAX_ATTEMPTS}) - marking error`);
        job.status = 'error';
        job.attempts = nextAttempts;
        job.progress = {
          ...job.progress,
          phase: 'error',
          message: 'Job stalled and exceeded max retry attempts. Please retry.',
          currentStep: 'Stalled - max attempts exceeded',
        };
        job.error = 'Job stalled (no progress updates)';
        job.updatedAt = new Date();
        jobs.set(id, job);
        saveJobToDisk(job);
        failed++;
        continue;
      }

      console.log(`🛟 Watchdog: re-queuing stalled job ${id} (${job.type}) attempt ${nextAttempts}/${JOB_MAX_ATTEMPTS}`);
      job.status = 'queued';
      job.attempts = nextAttempts;
      job.progress = {
        ...job.progress,
        phase: 'queued',
        message: 'Job stalled - retrying automatically...',
        currentStep: 'Stalled - retry',
      };
      job.updatedAt = new Date();
      jobs.set(id, job);
      saveJobToDisk(job);
      requeued++;
    }

    if (requeued > 0) console.log(`🛟 Watchdog re-queued ${requeued} stalled job(s)`);
    if (failed > 0) console.log(`🧹 Watchdog marked ${failed} job(s) as error`);
  }, intervalMs).unref?.();
}

startStalledJobWatchdog();

// ═══════════════════════════════════════════════════════════════════════════
// JOB QUEUE
// ═══════════════════════════════════════════════════════════════════════════

export const jobQueue = {
  /**
   * Create a new job and return its ID
   */
  createJob(type: Job['type'], params: any): string {
    const id = uuidv4();
    const job: Job = {
      id,
      type,
      status: 'queued',
      progress: {
        percent: 0,
        phase: 'queued',
        systemsCompleted: 0,
        totalSystems: params.systems?.length || 1,
        message: 'Job queued...',
      },
      createdAt: new Date(),
      updatedAt: new Date(),
      params,
    };
    
    jobs.set(id, job);
    saveJobToDisk(job);  // PERSIST
    console.log(`[PIPELINE] created jobId=${id} type=${type} (legacy)`);
    
    // Start processing immediately (async)
    this.processJob(id);
    
    return id;
  },
  
  /**
   * Get job by ID
   */
  getJob(id: string): Job | undefined {
    return jobs.get(id);
  },
  
  /**
   * Update job progress
   */
  updateProgress(id: string, progress: Partial<JobProgress>): void {
    const job = jobs.get(id);
    if (job) {
      job.progress = { ...job.progress, ...progress };
      job.updatedAt = new Date();
      jobs.set(id, job);
      saveJobToDisk(job);  // PERSIST
    }
  },
  
  /**
   * Mark job as complete
   */
  completeJob(id: string, results: Job['results']): void {
    const job = jobs.get(id);
    if (job) {
      job.status = 'complete';
      job.progress = {
        ...job.progress,
        percent: 100,
        phase: 'complete',
        message: 'Generation complete!',
      };
      job.results = results;
      job.completedAt = new Date();
      job.updatedAt = new Date();
      jobs.set(id, job);
      saveJobToDisk(job);  // PERSIST
      console.log(`✅ Job complete: ${id}`);
    }
  },
  
  /**
   * Mark job as failed
   */
  failJob(id: string, error: string): void {
    const job = jobs.get(id);
    if (job) {
      job.status = 'error';
      job.progress = {
        ...job.progress,
        phase: 'error',
        message: `Error: ${error}`,
      };
      job.error = error;
      job.updatedAt = new Date();
      jobs.set(id, job);
      saveJobToDisk(job);  // PERSIST
      console.error(`❌ Job failed: ${id} - ${error}`);
    }
  },
  
  /**
   * Register a job processor
   */
  registerProcessor(type: string, processor: JobProcessor): void {
    processors.set(type, processor);

    // Auto-resume any queued jobs (loaded from disk or recovered after restart)
    const queued = Array.from(jobs.values())
      .filter(j => j.type === type && j.status === 'queued')
      .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());

    if (queued.length > 0) {
      console.log(`🛟 Auto-resuming ${queued.length} queued job(s) for type: ${type} (max ${MAX_CONCURRENT_JOBS} concurrent)`);
      (async () => {
        // Process jobs in parallel batches (simulating multiple users)
        for (let i = 0; i < queued.length; i += MAX_CONCURRENT_JOBS) {
          const batch = queued.slice(i, i + MAX_CONCURRENT_JOBS);
          console.log(`🚀 Processing batch ${Math.floor(i / MAX_CONCURRENT_JOBS) + 1}: ${batch.length} jobs in parallel`);
          await Promise.all(batch.map(j => this.processJob(j.id)));
        }
      })();
    }
  },
  
  /**
   * Process a job (called internally)
   */
  async processJob(id: string): Promise<void> {
    const job = jobs.get(id);
    if (!job) return;
    
    const processor = processors.get(job.type);
    if (!processor) {
      this.failJob(id, `No processor registered for job type: ${job.type}`);
      return;
    }
    
    job.status = 'processing';
    job.updatedAt = new Date();
    jobs.set(id, job);
    saveJobToDisk(job);  // PERSIST
    
    try {
      await processor(job, (progress) => this.updateProgress(id, progress));
    } catch (error: any) {
      this.failJob(id, error.message || 'Unknown error');
    }
  },
  
  /**
   * Get all jobs (for debugging)
   */
  getAllJobs(): Job[] {
    return Array.from(jobs.values());
  },
  
  /**
   * Clean up old completed jobs (call periodically)
   */
  cleanupOldJobs(maxAgeHours: number = 24): number {
    const cutoff = new Date(Date.now() - maxAgeHours * 60 * 60 * 1000);
    let removed = 0;
    
    for (const [id, job] of jobs.entries()) {
      if (job.completedAt && job.completedAt < cutoff) {
        jobs.delete(id);
        deleteJobFromDisk(id);  // DELETE FROM DISK
        removed++;
      }
    }
    
    return removed;
  },
  
  /**
   * Reload jobs from disk (useful after crash recovery)
   */
  reloadFromDisk(): void {
    jobs.clear();
    loadJobsFromDisk();
  },
};
