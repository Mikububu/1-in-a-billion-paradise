/**
 * ADMIN ROUTES
 * 
 * Role-based admin system for managing users, jobs, and platform operations.
 * All routes require admin authentication and appropriate permissions.
 */

import { Hono } from 'hono';
import { z } from 'zod';
import { requireAdminAuth, requirePermission, getAdmin, logAdminAction } from '../middleware/adminAuth';
import { createSupabaseServiceClient } from '../services/supabaseClient';
import { SYSTEM_LLM_PROVIDERS, type LLMProviderName, type ReadingSystem } from '../config/llmProviders';
import { llm, llmPaid } from '../services/llm';

const router = new Hono();

// Apply admin auth to all routes
router.use('/*', requireAdminAuth);

// ───────────────────────────────────────────────────────────────────────────
// USER MANAGEMENT
// ───────────────────────────────────────────────────────────────────────────

const userListSchema = z.object({
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(100).default(20),
  search: z.string().optional(),
  role: z.enum(['user', 'admin']).optional(),
  status: z.enum(['active', 'suspended']).optional(),
  sortBy: z.enum(['created_at', 'email', 'last_sign_in_at']).default('created_at'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
});

/**
 * GET /api/admin/users
 * List users with pagination and filters
 */
router.get('/users', requirePermission('users', 'read'), async (c) => {
  const supabase = createSupabaseServiceClient();
  if (!supabase) {
    return c.json({ error: 'Database connection failed' }, 500);
  }

  try {
    const params = userListSchema.parse(Object.fromEntries(Object.entries(c.req.query())));
    const { page, limit, search, status, sortBy, sortOrder } = params;
    const offset = (page - 1) * limit;

    let query = supabase
      .from('users')
      .select('id, email, raw_user_meta_data, created_at, last_sign_in_at', { count: 'exact' })
      .order(sortBy, { ascending: sortOrder === 'asc' })
      .range(offset, offset + limit - 1);

    if (search) {
      query = query.or(`email.ilike.%${search}%,raw_user_meta_data->>full_name.ilike.%${search}%`);
    }

    // Note: status filtering would need a separate users table with status field
    // For now, we'll just return all users

    const { data: users, error, count } = await query;

    if (error) {
      console.error('Error fetching users:', error);
      return c.json({ error: 'Failed to fetch users' }, 500);
    }

    return c.json({
      users: users || [],
      pagination: {
        page,
        limit,
        total: count || 0,
        totalPages: Math.ceil((count || 0) / limit),
      },
    });
  } catch (err: any) {
    if (err instanceof z.ZodError) {
      return c.json({ error: 'Invalid query parameters', details: err.issues }, 400);
    }
    return c.json({ error: 'Internal server error' }, 500);
  }
});

/**
 * GET /api/admin/users/:userId
 * Get user details
 */
router.get('/users/:userId', requirePermission('users', 'read'), async (c) => {
  const supabase = createSupabaseServiceClient();
  if (!supabase) {
    return c.json({ error: 'Database connection failed' }, 500);
  }

  const userId = c.req.param('userId');
  const admin = getAdmin(c)!;

  try {
    // Get user
    const { data: user, error: userError } = await supabase.auth.admin.getUserById(userId);
    if (userError || !user) {
      return c.json({ error: 'User not found' }, 404);
    }

    // Get user notes
    const { data: notes } = await supabase
      .from('user_notes')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    // Get user activity (last 50)
    const { data: activity } = await supabase
      .from('user_activity')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(50);

    // Get subscription history
    const { data: subscriptions } = await supabase
      .from('subscription_history')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    // Get job count
    const { count: jobCount } = await supabase
      .from('jobs')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId);

    return c.json({
      user: {
        id: user.user.id,
        email: user.user.email,
        metadata: user.user.user_metadata,
        created_at: user.user.created_at,
        last_sign_in_at: user.user.last_sign_in_at,
      },
      notes: notes || [],
      activity: activity || [],
      subscriptions: subscriptions || [],
      stats: {
        total_jobs: jobCount || 0,
      },
    });
  } catch (err: any) {
    console.error('Error fetching user:', err);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

/**
 * POST /api/admin/users/:userId/notes
 * Add a note to a user
 */
router.post('/users/:userId/notes', requirePermission('users', 'write'), async (c) => {
  const supabase = createSupabaseServiceClient();
  if (!supabase) {
    return c.json({ error: 'Database connection failed' }, 500);
  }

  const userId = c.req.param('userId');
  const admin = getAdmin(c)!;

  try {
    const body = await c.req.json();
    const { note, is_flagged, flag_reason } = body;

    if (!note || typeof note !== 'string') {
      return c.json({ error: 'Note is required' }, 400);
    }

    const { data, error } = await supabase
      .from('user_notes')
      .insert({
        user_id: userId,
        admin_id: admin.id,
        note,
        is_flagged: is_flagged || false,
        flag_reason: flag_reason || null,
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating note:', error);
      return c.json({ error: 'Failed to create note' }, 500);
    }

    // Log action
    await logAdminAction(
      admin.id,
      'user_note_created',
      'user',
      userId,
      { note_id: data.id },
      c.req.header('x-forwarded-for') || undefined,
      c.req.header('user-agent') || undefined
    );

    return c.json({ note: data });
  } catch (err: any) {
    return c.json({ error: 'Internal server error' }, 500);
  }
});

/**
 * PUT /api/admin/users/:userId
 * Update user (limited fields)
 */
router.put('/users/:userId', requirePermission('users', 'write'), async (c) => {
  const supabase = createSupabaseServiceClient();
  if (!supabase) {
    return c.json({ error: 'Database connection failed' }, 500);
  }

  const userId = c.req.param('userId');
  const admin = getAdmin(c)!;

  try {
    const body = await c.req.json();
    const { email, user_metadata } = body;

    const updates: any = {};
    if (email) updates.email = email;
    if (user_metadata) updates.user_metadata = user_metadata;

    const { data, error } = await supabase.auth.admin.updateUserById(userId, updates);

    if (error) {
      console.error('Error updating user:', error);
      return c.json({ error: 'Failed to update user' }, 500);
    }

    // Log action
    await logAdminAction(
      admin.id,
      'user_updated',
      'user',
      userId,
      { updates },
      c.req.header('x-forwarded-for') || undefined,
      c.req.header('user-agent') || undefined
    );

    return c.json({ user: data.user });
  } catch (err: any) {
    return c.json({ error: 'Internal server error' }, 500);
  }
});

// ───────────────────────────────────────────────────────────────────────────
// JOB MONITORING
// ───────────────────────────────────────────────────────────────────────────

const jobListSchema = z.object({
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(100).default(20),
  status: z.enum(['queued', 'processing', 'complete', 'error', 'cancelled']).optional(),
  type: z.string().optional(),
  userId: z.string().uuid().optional(),
  dateFrom: z.string().optional(),
  dateTo: z.string().optional(),
});

/**
 * GET /api/admin/jobs
 * List jobs with filters
 */
router.get('/jobs', requirePermission('jobs', 'read'), async (c) => {
  const supabase = createSupabaseServiceClient();
  if (!supabase) {
    return c.json({ error: 'Database connection failed' }, 500);
  }

  try {
    const params = jobListSchema.parse(Object.fromEntries(Object.entries(c.req.query())));
    const { page, limit, status, type, userId, dateFrom, dateTo } = params;
    const offset = (page - 1) * limit;

    let query = supabase
      .from('jobs')
      .select('*', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (status) {
      query = query.eq('status', status);
    }
    if (type) {
      query = query.eq('job_type', type);
    }
    if (userId) {
      query = query.eq('user_id', userId);
    }
    if (dateFrom) {
      query = query.gte('created_at', dateFrom);
    }
    if (dateTo) {
      query = query.lte('created_at', dateTo);
    }

    const { data: jobs, error, count } = await query;

    if (error) {
      console.error('Error fetching jobs:', error);
      return c.json({ error: 'Failed to fetch jobs' }, 500);
    }

    return c.json({
      jobs: jobs || [],
      pagination: {
        page,
        limit,
        total: count || 0,
        totalPages: Math.ceil((count || 0) / limit),
      },
    });
  } catch (err: any) {
    if (err instanceof z.ZodError) {
      return c.json({ error: 'Invalid query parameters', details: err.issues }, 400);
    }
    return c.json({ error: 'Internal server error' }, 500);
  }
});

/**
 * GET /api/admin/jobs/:jobId
 * Get job details
 */
router.get('/jobs/:jobId', requirePermission('jobs', 'read'), async (c) => {
  const supabase = createSupabaseServiceClient();
  if (!supabase) {
    return c.json({ error: 'Database connection failed' }, 500);
  }

  const jobId = c.req.param('jobId');

  try {
    const { data: job, error } = await supabase
      .from('jobs')
      .select('*')
      .eq('id', jobId)
      .single();

    if (error || !job) {
      return c.json({ error: 'Job not found' }, 404);
    }

    // Get job alerts
    const { data: alerts } = await supabase
      .from('job_alerts')
      .select('*')
      .eq('job_id', jobId)
      .order('created_at', { ascending: false });

    return c.json({
      job,
      alerts: alerts || [],
    });
  } catch (err: any) {
    console.error('Error fetching job:', err);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

/**
 * POST /api/admin/jobs/:jobId/cancel
 * Cancel a job
 */
router.post('/jobs/:jobId/cancel', requirePermission('jobs', 'write'), async (c) => {
  const supabase = createSupabaseServiceClient();
  if (!supabase) {
    return c.json({ error: 'Database connection failed' }, 500);
  }

  const jobId = c.req.param('jobId');
  const admin = getAdmin(c)!;

  try {
    const { data: job, error: fetchError } = await supabase
      .from('jobs')
      .select('*')
      .eq('id', jobId)
      .single();

    if (fetchError || !job) {
      return c.json({ error: 'Job not found' }, 404);
    }

    if (job.status === 'complete' || job.status === 'cancelled') {
      return c.json({ error: 'Job cannot be cancelled' }, 400);
    }

    const { data: updated, error: updateError } = await supabase
      .from('jobs')
      .update({ status: 'cancelled', updated_at: new Date().toISOString() })
      .eq('id', jobId)
      .select()
      .single();

    if (updateError) {
      console.error('Error cancelling job:', updateError);
      return c.json({ error: 'Failed to cancel job' }, 500);
    }

    // Log action
    await logAdminAction(
      admin.id,
      'job_cancelled',
      'job',
      jobId,
      { previous_status: job.status },
      c.req.header('x-forwarded-for') || undefined,
      c.req.header('user-agent') || undefined
    );

    return c.json({ job: updated });
  } catch (err: any) {
    return c.json({ error: 'Internal server error' }, 500);
  }
});

/**
 * GET /api/admin/jobs/metrics
 * Get job metrics/statistics
 */
router.get('/jobs/metrics', requirePermission('jobs', 'read'), async (c) => {
  const supabase = createSupabaseServiceClient();
  if (!supabase) {
    return c.json({ error: 'Database connection failed' }, 500);
  }

  try {
    const { data: metrics, error } = await supabase
      .from('job_metrics')
      .select('*')
      .order('date', { ascending: false })
      .limit(30); // Last 30 days

    if (error) {
      console.error('Error fetching metrics:', error);
      return c.json({ error: 'Failed to fetch metrics' }, 500);
    }

    // Also get current queue status
    const { count: queuedCount } = await supabase
      .from('jobs')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'queued');

    const { count: processingCount } = await supabase
      .from('jobs')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'processing');

    return c.json({
      metrics: metrics || [],
      current: {
        queued: queuedCount || 0,
        processing: processingCount || 0,
      },
    });
  } catch (err: any) {
    return c.json({ error: 'Internal server error' }, 500);
  }
});

// ───────────────────────────────────────────────────────────────────────────
// DASHBOARD & ANALYTICS
// ───────────────────────────────────────────────────────────────────────────

/**
 * GET /api/admin/dashboard/stats
 * Get dashboard statistics
 */
router.get('/dashboard/stats', requirePermission('analytics', 'read'), async (c) => {
  const supabase = createSupabaseServiceClient();
  if (!supabase) {
    return c.json({ error: 'Database connection failed' }, 500);
  }

  try {
    // Get user counts
    const { count: totalUsers } = await supabase
      .from('users')
      .select('*', { count: 'exact', head: true });

    // Get job counts
    const { count: totalJobs } = await supabase
      .from('jobs')
      .select('*', { count: 'exact', head: true });

    const { count: completedJobs } = await supabase
      .from('jobs')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'complete');

    // Get recent activity
    const { data: recentActivity } = await supabase
      .from('user_activity')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(10);

    return c.json({
      users: {
        total: totalUsers || 0,
      },
      jobs: {
        total: totalJobs || 0,
        completed: completedJobs || 0,
      },
      recent_activity: recentActivity || [],
    });
  } catch (err: any) {
    console.error('Error fetching dashboard stats:', err);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

// ───────────────────────────────────────────────────────────────────────────
// LLM PROVIDER CONFIGURATION
// ───────────────────────────────────────────────────────────────────────────

/**
 * GET /api/admin/llm/config
 * Get current LLM provider configuration per system
 */
router.get('/llm/config', requirePermission('system', 'read'), async (c) => {
  try {
    return c.json({
      providers: SYSTEM_LLM_PROVIDERS,
      available: ['claude', 'deepseek', 'openai'] as LLMProviderName[],
      current_default: llm.getProvider(),
      current_paid: llmPaid.getProvider(),
      note: 'To change providers, update src/config/llmProviders.ts and redeploy. Runtime config coming soon.',
    });
  } catch (err: any) {
    return c.json({ error: 'Internal server error' }, 500);
  }
});

// ───────────────────────────────────────────────────────────────────────────
// SUBSCRIPTION MANAGEMENT
// ───────────────────────────────────────────────────────────────────────────

const subscriptionListSchema = z.object({
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(100).default(20),
  status: z.enum(['active', 'cancelled', 'past_due', 'incomplete']).optional(),
  includedReadingUsed: z.enum(['true', 'false']).optional(),
});

/**
 * GET /api/admin/subscriptions
 * List all subscriptions with filters
 */
router.get('/subscriptions', requirePermission('subscriptions', 'read'), async (c) => {
  const supabase = createSupabaseServiceClient();
  if (!supabase) {
    return c.json({ error: 'Database connection failed' }, 500);
  }

  try {
    const params = subscriptionListSchema.parse(Object.fromEntries(Object.entries(c.req.query())));
    const { page, limit, status, includedReadingUsed } = params;
    const offset = (page - 1) * limit;

    let query = supabase
      .from('user_subscriptions')
      .select('*', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (status) {
      query = query.eq('status', status);
    }
    if (includedReadingUsed === 'true') {
      query = query.eq('included_reading_used', true);
    } else if (includedReadingUsed === 'false') {
      query = query.eq('included_reading_used', false);
    }

    const { data: subscriptions, error, count } = await query;

    if (error) {
      console.error('Error fetching subscriptions:', error);
      return c.json({ error: 'Failed to fetch subscriptions' }, 500);
    }

    return c.json({
      subscriptions: subscriptions || [],
      pagination: {
        page,
        limit,
        total: count || 0,
        totalPages: Math.ceil((count || 0) / limit),
      },
    });
  } catch (err: any) {
    if (err instanceof z.ZodError) {
      return c.json({ error: 'Invalid query parameters', details: err.issues }, 400);
    }
    return c.json({ error: 'Internal server error' }, 500);
  }
});

/**
 * GET /api/admin/subscriptions/:subscriptionId
 * Get subscription details
 */
router.get('/subscriptions/:subscriptionId', requirePermission('subscriptions', 'read'), async (c) => {
  const supabase = createSupabaseServiceClient();
  if (!supabase) {
    return c.json({ error: 'Database connection failed' }, 500);
  }

  const subscriptionId = c.req.param('subscriptionId');

  try {
    const { data: subscription, error } = await supabase
      .from('user_subscriptions')
      .select('*')
      .eq('id', subscriptionId)
      .single();

    if (error || !subscription) {
      return c.json({ error: 'Subscription not found' }, 404);
    }

    // Get the included reading job if used
    let includedReadingJob = null;
    if (subscription.included_reading_job_id) {
      const { data: job } = await supabase
        .from('jobs')
        .select('*')
        .eq('id', subscription.included_reading_job_id)
        .single();
      includedReadingJob = job;
    }

    return c.json({
      subscription,
      includedReadingJob,
    });
  } catch (err: any) {
    console.error('Error fetching subscription:', err);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

/**
 * GET /api/admin/subscriptions/stats
 * Get subscription statistics
 */
router.get('/subscriptions/stats', requirePermission('subscriptions', 'read'), async (c) => {
  const supabase = createSupabaseServiceClient();
  if (!supabase) {
    return c.json({ error: 'Database connection failed' }, 500);
  }

  try {
    // Total active subscriptions
    const { count: activeCount } = await supabase
      .from('user_subscriptions')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'active');

    // Included readings used
    const { count: readingsUsed } = await supabase
      .from('user_subscriptions')
      .select('*', { count: 'exact', head: true })
      .eq('included_reading_used', true);

    // Included readings not used (active subs)
    const { count: readingsAvailable } = await supabase
      .from('user_subscriptions')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'active')
      .eq('included_reading_used', false);

    // By system (for included readings)
    const { data: bySystem } = await supabase
      .from('user_subscriptions')
      .select('included_reading_system')
      .eq('included_reading_used', true)
      .not('included_reading_system', 'is', null);

    const systemCounts: Record<string, number> = {};
    bySystem?.forEach((s: any) => {
      const sys = s.included_reading_system;
      systemCounts[sys] = (systemCounts[sys] || 0) + 1;
    });

    return c.json({
      total_active: activeCount || 0,
      included_readings: {
        used: readingsUsed || 0,
        available: readingsAvailable || 0,
        by_system: systemCounts,
      },
    });
  } catch (err: any) {
    console.error('Error fetching subscription stats:', err);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

/**
 * POST /api/admin/subscriptions/:subscriptionId/reset-reading
 * Reset included reading (allow user to use it again)
 */
router.post('/subscriptions/:subscriptionId/reset-reading', requirePermission('subscriptions', 'manage'), async (c) => {
  const supabase = createSupabaseServiceClient();
  if (!supabase) {
    return c.json({ error: 'Database connection failed' }, 500);
  }

  const subscriptionId = c.req.param('subscriptionId');
  const admin = getAdmin(c)!;

  try {
    const { data: subscription, error: fetchError } = await supabase
      .from('user_subscriptions')
      .select('*')
      .eq('id', subscriptionId)
      .single();

    if (fetchError || !subscription) {
      return c.json({ error: 'Subscription not found' }, 404);
    }

    const { data: updated, error: updateError } = await supabase
      .from('user_subscriptions')
      .update({
        included_reading_used: false,
        included_reading_system: null,
        included_reading_job_id: null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', subscriptionId)
      .select()
      .single();

    if (updateError) {
      console.error('Error resetting reading:', updateError);
      return c.json({ error: 'Failed to reset reading' }, 500);
    }

    // Log action
    await logAdminAction(
      admin.id,
      'subscription_reading_reset',
      'subscription',
      subscriptionId,
      { 
        previous_system: subscription.included_reading_system,
        previous_job_id: subscription.included_reading_job_id,
      },
      c.req.header('x-forwarded-for') || undefined,
      c.req.header('user-agent') || undefined
    );

    return c.json({ subscription: updated });
  } catch (err: any) {
    return c.json({ error: 'Internal server error' }, 500);
  }
});

export default router;

