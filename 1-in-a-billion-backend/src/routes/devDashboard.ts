/**
 * DEV DASHBOARD - View all jobs and readings
 * 
 * Endpoint to monitor all background jobs, view status, and listen to audio.
 * Useful for stress testing and checking results.
 * 
 * GET /api/dev/dashboard - List all jobs with status
 * GET /api/dev/jobs/:jobId - Get specific job details
 */

import { Hono } from 'hono';
import { jobQueue } from '../services/jobQueue';
import { createSupabaseServiceClient } from '../services/supabaseClient';
import { getSignedArtifactUrl } from '../services/supabaseClient';

const router = new Hono();

// List all jobs (both legacy queue and Supabase queue)
router.get('/dashboard', async (c) => {
  try {
    // Get legacy queue jobs
    const legacyJobs = jobQueue.getAllJobs().map(job => ({
      id: job.id,
      type: job.type,
      status: job.status,
      progress: job.progress,
      createdAt: job.createdAt,
      updatedAt: job.updatedAt,
      error: job.error,
      queue: 'legacy',
    }));

    // Get Supabase queue jobs (if service client available)
    let supabaseJobs: any[] = [];
    try {
      const supabase = createSupabaseServiceClient();
      if (supabase) {
        const { data, error } = await supabase
          .from('jobs')
          .select('id, type, status, progress, created_at, updated_at, error')
          .order('created_at', { ascending: false })
          .limit(100);

        if (!error && data) {
          supabaseJobs = data.map((job: any) => ({
            id: job.id,
            type: job.type,
            status: job.status,
            progress: job.progress,
            createdAt: job.created_at,
            updatedAt: job.updated_at,
            error: job.error,
            queue: 'supabase',
          }));
        }
      }
    } catch (err: any) {
      console.warn('Could not fetch Supabase jobs:', err.message);
    }

    const allJobs = [...legacyJobs, ...supabaseJobs].sort((a, b) => {
      const aTime = new Date(a.createdAt || 0).getTime();
      const bTime = new Date(b.createdAt || 0).getTime();
      return bTime - aTime; // Newest first
    });

    return c.json({
      success: true,
      total: allJobs.length,
      legacy: legacyJobs.length,
      supabase: supabaseJobs.length,
      jobs: allJobs,
    });
  } catch (error: any) {
    return c.json({ success: false, error: error.message }, 500);
  }
});

// Get specific job details with artifacts
router.get('/jobs/:jobId', async (c) => {
  const jobId = c.req.param('jobId');

  try {
    // Try legacy queue first
    const legacyJob = jobQueue.getJob(jobId);
    if (legacyJob) {
      return c.json({
        success: true,
        job: {
          id: legacyJob.id,
          type: legacyJob.type,
          status: legacyJob.status,
          progress: legacyJob.progress,
          results: legacyJob.results,
          error: legacyJob.error,
          createdAt: legacyJob.createdAt,
          updatedAt: legacyJob.updatedAt,
          queue: 'legacy',
        },
      });
    }

    // Try Supabase queue
    const supabase = createSupabaseServiceClient();
    if (supabase) {
      const { data: job, error } = await supabase
        .from('jobs')
        .select(`
          *,
          artifacts:job_artifacts(*)
        `)
        .eq('id', jobId)
        .single();

      if (error || !job) {
        return c.json({ success: false, error: 'Job not found' }, 404);
      }

      // Attach signed URLs for private Storage artifacts (parallel for speed)
      if (job.artifacts && Array.isArray(job.artifacts)) {
        await Promise.all(
          job.artifacts.map(async (artifact: any) => {
            if (!artifact.public_url && artifact.storage_path) {
              artifact.public_url = (await getSignedArtifactUrl(artifact.storage_path)) || undefined;
            }
          })
        );
      }

      return c.json({
        success: true,
        job: {
          ...job,
          queue: 'supabase',
        },
      });
    }

    return c.json({ success: false, error: 'Job not found' }, 404);
  } catch (error: any) {
    return c.json({ success: false, error: error.message }, 500);
  }
});

// Get job statistics
router.get('/stats', async (c) => {
  try {
    const legacyJobs = jobQueue.getAllJobs();
    const legacyStats = {
      total: legacyJobs.length,
      pending: legacyJobs.filter((j: any) => j.status === 'pending' || j.status === 'queued').length,
      processing: legacyJobs.filter((j: any) => j.status === 'processing').length,
      complete: legacyJobs.filter((j: any) => j.status === 'complete').length,
      error: legacyJobs.filter((j: any) => j.status === 'error').length,
    };

    let supabaseStats = {
      total: 0,
      pending: 0,
      processing: 0,
      complete: 0,
      error: 0,
    };

    try {
      const supabase = createSupabaseServiceClient();
      if (supabase) {
        const { data, error } = await supabase
          .from('jobs')
          .select('status');

        if (!error && data) {
          supabaseStats = {
            total: data.length,
            pending: data.filter((j: any) => j.status === 'pending' || j.status === 'queued').length,
            processing: data.filter((j: any) => j.status === 'processing').length,
            complete: data.filter((j: any) => j.status === 'complete').length,
            error: data.filter((j: any) => j.status === 'error').length,
          };
        }
      }
    } catch (err: any) {
      console.warn('Could not fetch Supabase stats:', err.message);
    }

    return c.json({
      success: true,
      legacy: legacyStats,
      supabase: supabaseStats,
      combined: {
        total: legacyStats.total + supabaseStats.total,
        pending: legacyStats.pending + supabaseStats.pending,
        processing: legacyStats.processing + supabaseStats.processing,
        complete: legacyStats.complete + supabaseStats.complete,
        error: legacyStats.error + supabaseStats.error,
      },
    });
  } catch (error: any) {
    return c.json({ success: false, error: error.message }, 500);
  }
});

export default router;


