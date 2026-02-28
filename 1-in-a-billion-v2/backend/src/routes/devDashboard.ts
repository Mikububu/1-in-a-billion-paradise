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
import axios from 'axios';
import { apiKeys } from '../services/apiKeysHelper';
import type { AppEnv } from '../types/hono';

const router = new Hono<AppEnv>();

function getBearerTokenFromReq(c: any): string | null {
  const auth = c.req.header('Authorization') || c.req.header('authorization');
  if (!auth) return null;
  const m = auth.match(/^Bearer\s+(.+)$/i);
  return m ? m[1] : null;
}

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

/**
 * DEV: List RunPod serverless endpoints (to recover endpoint IDs when UI hides them)
 *
 * GET /api/dev/runpod/endpoints
 * Auth: requires a valid Supabase access token in Authorization: Bearer <token>
 *
 * Returns: { endpoints: [{ id, name, ... }] }
 */
router.get('/runpod/endpoints', async (c) => {
  try {
    const supabase = createSupabaseServiceClient();
    if (!supabase) {
      return c.json({ success: false, error: 'Supabase service client not configured' }, 500);
    }

    const token = getBearerTokenFromReq(c);
    if (!token) {
      return c.json({ success: false, error: 'Missing Authorization bearer token' }, 401);
    }

    const { data: authData, error: authError } = await supabase.auth.getUser(token);
    if (authError || !authData?.user) {
      return c.json({ success: false, error: 'Invalid or expired token' }, 401);
    }

    const runpodKey = await apiKeys.runpod();
    const RUNPOD_API_URL = 'https://api.runpod.ai/v2';

    const headers = {
      Authorization: `Bearer ${runpodKey}`,
      'Content-Type': 'application/json',
    };

    // RunPod has multiple API shapes; try the most likely ones.
    let data: any = null;
    const attempts: Array<{ url: string; label: string }> = [
      { url: `${RUNPOD_API_URL}/serverless`, label: 'v2/serverless' },
      { url: `${RUNPOD_API_URL}/endpoints`, label: 'v2/endpoints' },
    ];

    let lastErr: any = null;
    for (const a of attempts) {
      try {
        const res = await axios.get(a.url, { headers });
        data = res.data;
        lastErr = null;
        break;
      } catch (err: any) {
        lastErr = err;
      }
    }

    if (lastErr && !data) {
      return c.json(
        {
          success: false,
          error: 'Failed to fetch endpoints from RunPod API',
          details: lastErr?.response?.data || lastErr?.message || String(lastErr),
        },
        502
      );
    }

    const raw =
      (Array.isArray(data) ? data : null) ||
      data?.serverless ||
      data?.endpoints ||
      data?.data ||
      [];

    const endpoints = (Array.isArray(raw) ? raw : []).map((e: any) => ({
      id: e?.id || e?.endpointId || e?.endpoint_id || null,
      name: e?.name || e?.endpointName || e?.endpoint_name || null,
      // Keep a small amount of extra context for picking the right one:
      templateId: e?.templateId || e?.template_id || null,
      gpuType: e?.gpuType || e?.gpu_type || null,
      idleTimeout: e?.idleTimeout || e?.idle_timeout || null,
    }));

    return c.json({
      success: true,
      total: endpoints.length,
      endpoints,
    });
  } catch (error: any) {
    console.error('❌ Error listing RunPod endpoints:', error);
    return c.json({ success: false, error: error?.message || 'Unknown error' }, 500);
  }
});

export default router;


