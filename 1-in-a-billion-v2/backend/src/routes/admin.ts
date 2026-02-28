/**
 * ADMIN ROUTES
 *
 * Role-based admin system for managing users, jobs, and platform operations.
 * All routes require admin authentication and appropriate permissions.
 */

import { Hono } from 'hono';
import { z } from 'zod';
import axios from 'axios';
import { requireAdminAuth, requirePermission, getAdmin, logAdminAction } from '../middleware/adminAuth';
import { createSupabaseServiceClient } from '../services/supabaseClient';
import { SYSTEM_LLM_PROVIDERS, type LLMProviderName, type ReadingSystem } from '../config/llmProviders';
import { llm, llmPaid } from '../services/llm';
import { apiKeys } from '../services/apiKeysHelper';
import { env } from '../config/env';
import { getTodayCosts, getMonthCosts, getCostSummary, LLM_PRICING, REPLICATE_PRICING } from '../services/costTracking';
import type { AppEnv } from '../types/hono';

const router = new Hono<AppEnv>();

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

/**
 * DELETE /api/admin/users/:userId
 * Permanently delete a user and ALL associated data.
 * Requires superadmin permission. This action is irreversible.
 */
router.delete('/users/:userId', requirePermission('users', 'delete'), async (c) => {
  const supabase = createSupabaseServiceClient();
  if (!supabase) {
    return c.json({ error: 'Database connection failed' }, 500);
  }

  const userId = c.req.param('userId');
  const admin = getAdmin(c)!;

  try {
    // Verify user exists before deleting
    const { data: userCheck, error: userCheckError } = await supabase.auth.admin.getUserById(userId);
    if (userCheckError || !userCheck?.user) {
      return c.json({ error: 'User not found' }, 404);
    }
    const userEmail = userCheck.user.email;

    const errors: string[] = [];

    // ── 1. Delete all user data from app tables (order matters for FK constraints) ──

    const tablesToDelete: string[] = [
      // Job-related (delete tasks/artifacts before jobs)
      'job_notification_subscriptions',
      'job_alerts',
      'job_metrics',
      'job_tasks',
      'job_artifacts',
      'vedic_job_artifacts',
      'jobs',
      'audiobook_jobs',
      // Reading-related
      'readings',
      'library_people',
      'library',
      // People/match related
      'vedic_matches',
      'vedic_match_jobs',
      'vedic_people',
      'matches',
      'couple_portraits',
      'people',
      // Content
      'audio',
      'audiobook_chapters',
      'songs',
      'messages',
      'conversations',
      // Subscription / commerce
      'coupon_redemptions',
      'purchases',
      'subscription_history',
      'user_subscriptions',
      'user_commercial_state',
      // Misc user data
      'user_push_tokens',
      'user_activity',
      'user_notes',
      'cost_logs',
    ];

    for (const table of tablesToDelete) {
      const { error } = await supabase.from(table as any).delete().eq('user_id', userId);
      if (error) {
        // Log but continue — some tables may not have user_id or row may not exist
        console.warn(`⚠️  Could not delete from ${table} for user ${userId}: ${error.message}`);
        errors.push(`${table}: ${error.message}`);
      }
    }

    // ── 2. Delete Supabase Storage files for this user ──
    // Try common bucket paths — ignore errors if buckets don't exist or are empty
    const storageBuckets = ['avatars', 'audio', 'pdfs', 'portraits', 'videos'];
    for (const bucket of storageBuckets) {
      try {
        const { data: files } = await supabase.storage.from(bucket).list(userId);
        if (files && files.length > 0) {
          const paths = files.map((f: any) => `${userId}/${f.name}`);
          await supabase.storage.from(bucket).remove(paths);
        }
      } catch {
        // Bucket may not exist or user has no files — fine
      }
    }

    // ── 3. Delete the Supabase Auth user (this removes the auth record) ──
    const { error: authDeleteError } = await supabase.auth.admin.deleteUser(userId);
    if (authDeleteError) {
      console.error(`❌ Failed to delete auth user ${userId}:`, authDeleteError.message);
      return c.json({
        error: 'Failed to delete auth user',
        details: authDeleteError.message,
        data_deletion_errors: errors,
      }, 500);
    }

    // ── 4. Audit log ──
    await logAdminAction(
      admin.id,
      'user_deleted',
      'user',
      userId,
      { email: userEmail, data_deletion_errors: errors },
      c.req.header('x-forwarded-for') || undefined,
      c.req.header('user-agent') || undefined
    );

    console.log(`🗑️  Admin ${admin.id} deleted user ${userId} (${userEmail})`);

    return c.json({
      success: true,
      message: `User ${userEmail} and all associated data permanently deleted.`,
      warnings: errors.length > 0 ? errors : undefined,
    });
  } catch (err: any) {
    console.error('Error deleting user:', err);
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

/**
 * GET /api/admin/dashboard/job-logs
 * Get job execution logs with tasks, costs, and performance metrics
 */
router.get('/dashboard/job-logs', requirePermission('analytics', 'read'), async (c) => {
  const supabase = createSupabaseServiceClient();
  if (!supabase) {
    return c.json({ error: 'Database connection failed' }, 500);
  }

  try {
    const filter = c.req.query('filter') || 'all';
    const limit = parseInt(c.req.query('limit') || '50');

    // Build job query based on filter
    let jobQuery = supabase
      .from('jobs')
      .select('id, type, status, created_at, completed_at, total_cost_usd, cost_breakdown')
      .order('created_at', { ascending: false })
      .limit(limit);

    if (filter === 'success') {
      jobQuery = jobQuery.eq('status', 'complete');
    } else if (filter === 'failed') {
      jobQuery = jobQuery.eq('status', 'failed');
    } else if (filter === 'running') {
      jobQuery = jobQuery.in('status', ['pending', 'processing']);
    }

    const { data: jobs, error: jobsError } = await jobQuery;

    if (jobsError) {
      console.error('Error fetching jobs:', jobsError);
      return c.json({ error: 'Failed to fetch jobs' }, 500);
    }

    // Fetch tasks for each job
    const jobIds = jobs?.map((j: any) => j.id) || [];
    const { data: tasks, error: tasksError } = await supabase
      .from('job_tasks')
      .select('id, job_id, type, status, error_message, cost_data, created_at, completed_at')
      .in('job_id', jobIds);

    if (tasksError) {
      console.error('Error fetching tasks:', tasksError);
      return c.json({ error: 'Failed to fetch tasks' }, 500);
    }

    // Group tasks by job
    const tasksByJob = (tasks || []).reduce((acc: any, task: any) => {
      if (!acc[task.job_id]) acc[task.job_id] = [];
      
      // Calculate execution time
      const executionTime = task.completed_at && task.created_at
        ? new Date(task.completed_at).getTime() - new Date(task.created_at).getTime()
        : 0;

      acc[task.job_id].push({
        task_id: task.id,
        task_type: task.type,
        task_status: task.status,
        execution_time_ms: executionTime,
        error_message: task.error_message,
        cost_data: task.cost_data || {},
        created_at: task.created_at,
        completed_at: task.completed_at,
      });
      return acc;
    }, {} as Record<string, any[]>);

    // Format response
    const jobLogs = (jobs || []).map((job: any) => ({
      job_id: job.id,
      job_type: job.type,
      job_status: job.status,
      job_created_at: job.created_at,
      job_completed_at: job.completed_at,
      total_cost_usd: job.total_cost_usd || 0,
      cost_breakdown: job.cost_breakdown || {},
      tasks: tasksByJob[job.id] || [],
    }));

    return c.json(jobLogs);
  } catch (err: any) {
    console.error('Error fetching job logs:', err);
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

// ───────────────────────────────────────────────────────────────────────────
// API SERVICE STATUS & BALANCES
// ───────────────────────────────────────────────────────────────────────────

interface ServiceStatus {
  name: string;
  status: 'ok' | 'error' | 'unknown';
  balance?: number | string;
  currency?: string;
  details?: any;
  error?: string;
}

/**
 * GET /api/admin/services/status
 * Get status and balances for all API services
 */
router.get('/services/status', requirePermission('system', 'read'), async (c) => {
  const services: ServiceStatus[] = [];

  // 1. RunPod - Check balance via GraphQL API
  try {
    const runpodKey = await apiKeys.runpod();
    const runpodEndpointId = await apiKeys.runpodEndpoint();
    
    // Get balance and spend info
    const balanceRes = await axios.post('https://api.runpod.io/graphql', {
      query: `query { myself { currentSpendPerHr creditBalance serverlessDiscount { discountFactor } } }`
    }, {
      headers: {
        'Authorization': `Bearer ${runpodKey}`,
        'Content-Type': 'application/json',
      },
      timeout: 10000,
    });

    // Get endpoint status
    const endpointRes = await axios.post('https://api.runpod.io/graphql', {
      query: `query { myself { endpoints { id name workersMin workersMax idleTimeout } } }`
    }, {
      headers: {
        'Authorization': `Bearer ${runpodKey}`,
        'Content-Type': 'application/json',
      },
      timeout: 10000,
    });

    const myself = balanceRes.data?.data?.myself;
    const endpoints = endpointRes.data?.data?.myself?.endpoints || [];
    const currentEndpoint = endpoints.find((e: any) => e.id === runpodEndpointId);
    const balance = myself?.creditBalance || 0;

    services.push({
      name: 'RunPod',
      status: balance > 5 ? 'ok' : balance > 0 ? 'unknown' : 'error',
      balance: balance,
      currency: 'USD',
      details: {
        currentSpendPerHr: myself?.currentSpendPerHr || 0,
        endpointId: runpodEndpointId,
        endpointName: currentEndpoint?.name || 'Unknown',
        workersMin: currentEndpoint?.workersMin || 0,
        workersMax: currentEndpoint?.workersMax || 0,
        totalEndpoints: endpoints.length,
        discountFactor: myself?.serverlessDiscount?.discountFactor,
      },
    });
  } catch (err: any) {
    services.push({
      name: 'RunPod',
      status: 'error',
      error: err.message,
    });
  }

  // 2. Fly.io - Check organization billing
  try {
    const flyToken = await apiKeys.flyIo();
    if (flyToken) {
      // Fly.io GraphQL API for billing
      const billingRes = await axios.post('https://api.fly.io/graphql', {
        query: `query { viewer { organizations { nodes { id name billingStatus } } } }`
      }, {
        headers: {
          'Authorization': `Bearer ${flyToken}`,
          'Content-Type': 'application/json',
        },
        timeout: 10000,
      });
      
      const orgs = billingRes.data?.data?.viewer?.organizations?.nodes || [];
      const org = orgs[0];
      
      services.push({
        name: 'Fly.io',
        status: org?.billingStatus === 'current' ? 'ok' : 'unknown',
        balance: 'Check fly.io/dashboard',
        details: {
          keyConfigured: true,
          organization: org?.name || 'Unknown',
          billingStatus: org?.billingStatus || 'unknown',
          note: 'Fly.io uses usage-based billing. Check dashboard for details.',
        },
      });
    } else {
      services.push({
        name: 'Fly.io',
        status: 'unknown',
        balance: 'N/A',
        details: { keyConfigured: false },
      });
    }
  } catch (err: any) {
    services.push({
      name: 'Fly.io',
      status: 'error',
      error: err.message?.substring(0, 100),
    });
  }

  // 3. Anthropic (Claude) - No direct balance API, check if key works
  try {
    const claudeKey = await apiKeys.claude();
    services.push({
      name: 'Anthropic (Claude)',
      status: claudeKey ? 'ok' : 'error',
      balance: 'Check console.anthropic.com',
      details: {
        keyConfigured: !!claudeKey,
        provider: 'claude',
        model: 'claude-sonnet-4-20250514',
        note: 'Anthropic does not provide a balance API. Check your dashboard.',
        dashboardUrl: 'https://console.anthropic.com/settings/billing',
      },
    });
  } catch (err: any) {
    services.push({
      name: 'Anthropic (Claude)',
      status: 'error',
      error: err.message,
    });
  }

  // 4. OpenAI - Try to get usage info
  try {
    const openaiKey = await apiKeys.openai();
    if (openaiKey) {
      // Try to get subscription info (may not work for all accounts)
      try {
        const usageRes = await axios.get('https://api.openai.com/v1/dashboard/billing/subscription', {
          headers: { 'Authorization': `Bearer ${openaiKey}` },
          timeout: 10000,
        });
        const sub = usageRes.data;
        services.push({
          name: 'OpenAI',
          status: 'ok',
          balance: sub?.soft_limit_usd || 'Check platform.openai.com',
          details: {
            keyConfigured: true,
            provider: 'openai',
            model: env.OPENAI_MODEL,
            plan: sub?.plan?.title,
            dashboardUrl: 'https://platform.openai.com/usage',
          },
        });
      } catch {
        // Billing API not available, just show key status
        services.push({
          name: 'OpenAI',
          status: 'ok',
          balance: 'Check platform.openai.com',
          details: {
            keyConfigured: true,
            provider: 'openai',
            model: env.OPENAI_MODEL,
            note: 'Billing API requires org admin permissions.',
            dashboardUrl: 'https://platform.openai.com/usage',
          },
        });
      }
    } else {
      services.push({
        name: 'OpenAI',
        status: 'error',
        balance: 'N/A',
        details: { keyConfigured: false },
      });
    }
  } catch (err: any) {
    services.push({
      name: 'OpenAI',
      status: 'error',
      error: err.message,
    });
  }

  // 5. DeepSeek - Try to get balance
  try {
    const deepseekKey = await apiKeys.deepseek();
    if (deepseekKey) {
      try {
        // DeepSeek has a user balance endpoint
        const balanceRes = await axios.get('https://api.deepseek.com/user/balance', {
          headers: { 'Authorization': `Bearer ${deepseekKey}` },
          timeout: 10000,
        });
        const balance = balanceRes.data?.balance_infos?.[0]?.total_balance || 0;
        services.push({
          name: 'DeepSeek',
          status: balance > 1 ? 'ok' : balance > 0 ? 'unknown' : 'error',
          balance: balance,
          currency: balanceRes.data?.balance_infos?.[0]?.currency || 'CNY',
          details: {
            keyConfigured: true,
            provider: 'deepseek',
            model: 'deepseek-chat',
            dashboardUrl: 'https://platform.deepseek.com/usage',
          },
        });
      } catch {
        services.push({
          name: 'DeepSeek',
          status: 'ok',
          balance: 'Check platform.deepseek.com',
          details: {
            keyConfigured: true,
            provider: 'deepseek',
            note: 'Balance API may require different permissions.',
            dashboardUrl: 'https://platform.deepseek.com/usage',
          },
        });
      }
    } else {
      services.push({
        name: 'DeepSeek',
        status: 'error',
        balance: 'N/A',
        details: { keyConfigured: false },
      });
    }
  } catch (err: any) {
    services.push({
      name: 'DeepSeek',
      status: 'error',
      error: err.message,
    });
  }

  // 6. MiniMax - Check balance
  try {
    const minimaxKey = await apiKeys.minimax();
    if (minimaxKey) {
      try {
        // MiniMax query balance endpoint
        const balanceRes = await axios.get('https://api.minimax.chat/v1/query_balance', {
          headers: { 'Authorization': `Bearer ${minimaxKey}` },
          timeout: 10000,
        });
        const balance = balanceRes.data?.balance || 0;
        services.push({
          name: 'MiniMax',
          status: balance > 10 ? 'ok' : balance > 0 ? 'unknown' : 'error',
          balance: balance,
          currency: 'CNY',
          details: {
            keyConfigured: true,
            purpose: 'Music/Song generation',
            dashboardUrl: 'https://minimax.chat',
          },
        });
      } catch {
        services.push({
          name: 'MiniMax',
          status: 'ok',
          balance: 'Check minimax.chat',
          details: {
            keyConfigured: true,
            purpose: 'Music/Song generation',
            note: 'Balance API endpoint may have changed.',
          },
        });
      }
    } else {
      services.push({
        name: 'MiniMax',
        status: 'error',
        balance: 'N/A',
        details: { keyConfigured: false },
      });
    }
  } catch (err: any) {
    services.push({
      name: 'MiniMax',
      status: 'error',
      error: err.message,
    });
  }

  // 7. Google Places - Check if key works
  try {
    const googleKey = await apiKeys.googlePlaces();
    services.push({
      name: 'Google Places',
      status: googleKey ? 'ok' : 'unknown',
      balance: 'Check console.cloud.google.com',
      details: {
        keyConfigured: !!googleKey,
        purpose: 'City search/autocomplete',
        dashboardUrl: 'https://console.cloud.google.com/apis/dashboard',
      },
    });
  } catch (err: any) {
    services.push({
      name: 'Google Places',
      status: 'error',
      error: err.message,
    });
  }

  // 8. Supabase - Check usage and estimate
  try {
    const supabase = createSupabaseServiceClient();
    if (supabase) {
      // Get total files count from buckets
      const [audioRes, pdfRes, songsRes] = await Promise.all([
        supabase.storage.from('audio').list('', { limit: 1000 }),
        supabase.storage.from('pdf-readings').list('', { limit: 1000 }),
        supabase.storage.from('songs').list('', { limit: 1000 }).catch(() => ({ data: [], error: null })),
      ]);

      const totalFiles = (audioRes.data?.length || 0) + (pdfRes.data?.length || 0) + (songsRes.data?.length || 0);

      services.push({
        name: 'Supabase',
        status: 'ok',
        balance: 'Check supabase.com/dashboard',
        details: {
          storage: {
            audioFiles: audioRes.data?.length || 0,
            pdfFiles: pdfRes.data?.length || 0,
            songFiles: songsRes.data?.length || 0,
            totalFiles,
          },
          note: 'Free tier: 1GB storage, 2GB bandwidth/month',
          dashboardUrl: 'https://supabase.com/dashboard/project/jyjsfjulwnkogqsvivkp/settings/billing/usage',
        },
      });
    }
  } catch (err: any) {
    services.push({
      name: 'Supabase',
      status: 'error',
      error: err.message,
    });
  }

  // 9. Stripe - Check balance
  try {
    const stripeKey = await apiKeys.stripe();
    if (stripeKey) {
      try {
        // Get Stripe balance
        const Stripe = (await import('stripe')).default;
        const stripe = new Stripe(stripeKey);
        const balance = await stripe.balance.retrieve();
        
        // Sum available balance
        const availableUSD = balance.available
          .filter((b: any) => b.currency === 'usd')
          .reduce((sum: number, b: any) => sum + b.amount, 0) / 100;

        services.push({
          name: 'Stripe',
          status: 'ok',
          balance: availableUSD,
          currency: 'USD',
          details: {
            keyConfigured: true,
            purpose: 'Payment processing',
            availableBalance: availableUSD,
            pendingBalance: balance.pending
              .filter((b: any) => b.currency === 'usd')
              .reduce((sum: number, b: any) => sum + b.amount, 0) / 100,
            dashboardUrl: 'https://dashboard.stripe.com/balance',
          },
        });
      } catch (stripeErr: any) {
        services.push({
          name: 'Stripe',
          status: 'ok',
          balance: 'Check dashboard.stripe.com',
          details: {
            keyConfigured: true,
            purpose: 'Payment processing',
            note: stripeErr.message?.substring(0, 50),
          },
        });
      }
    } else {
      services.push({
        name: 'Stripe',
        status: 'unknown',
        balance: 'N/A',
        details: { keyConfigured: false },
      });
    }
  } catch (err: any) {
    services.push({
      name: 'Stripe',
      status: 'error',
      error: err.message,
    });
  }

  return c.json({
    services,
    timestamp: new Date().toISOString(),
    environment: {
      tragicRealismLevel: env.TRAGIC_REALISM_LEVEL,
      paidLlmProvider: env.PAID_LLM_PROVIDER,
      supabaseQueueEnabled: env.SUPABASE_QUEUE_ENABLED,
    },
  });
});

/**
 * GET /api/admin/services/runpod/detailed
 * Get detailed RunPod endpoint and job status
 */
router.get('/services/runpod/detailed', requirePermission('system', 'read'), async (c) => {
  try {
    const runpodKey = await apiKeys.runpod();
    const runpodEndpointId = await apiKeys.runpodEndpoint();

    // Get all endpoints with detailed info
    const res = await axios.post('https://api.runpod.io/graphql', {
      query: `
        query {
          myself {
            creditBalance
            currentSpendPerHr
            endpoints {
              id
              name
              workersMin
              workersMax
              idleTimeout
              gpuIds
              templateId
            }
            serverlessJobs(input: {endpointId: "${runpodEndpointId}", last: 20}) {
              id
              status
              createdAt
              completedAt
              executionTime
            }
          }
        }
      `
    }, {
      headers: {
        'Authorization': `Bearer ${runpodKey}`,
        'Content-Type': 'application/json',
      },
      timeout: 15000,
    });

    const data = res.data?.data?.myself;
    if (!data) {
      return c.json({ error: 'Failed to fetch RunPod data' }, 500);
    }

    const currentEndpoint = data.endpoints?.find((e: any) => e.id === runpodEndpointId);
    const jobs = data.serverlessJobs || [];

    // Calculate job stats
    const completedJobs = jobs.filter((j: any) => j.status === 'COMPLETED');
    const failedJobs = jobs.filter((j: any) => j.status === 'FAILED');
    const avgExecutionTime = completedJobs.length > 0
      ? completedJobs.reduce((sum: number, j: any) => sum + (j.executionTime || 0), 0) / completedJobs.length
      : 0;

    return c.json({
      balance: {
        credits: data.creditBalance,
        currentSpendPerHr: data.currentSpendPerHr,
      },
      endpoint: currentEndpoint || null,
      allEndpoints: data.endpoints || [],
      recentJobs: {
        total: jobs.length,
        completed: completedJobs.length,
        failed: failedJobs.length,
        avgExecutionTimeSec: Math.round(avgExecutionTime),
        jobs: jobs.slice(0, 10), // Last 10 jobs
      },
    });
  } catch (err: any) {
    return c.json({ error: err.message }, 500);
  }
});

// ───────────────────────────────────────────────────────────────────────────
// SYSTEM CONFIGURATION
// ───────────────────────────────────────────────────────────────────────────

/**
 * GET /api/admin/system/config
 * Get all system configuration values
 */
router.get('/system/config', requirePermission('system', 'read'), async (c) => {
  return c.json({
    llm: {
      paidProvider: env.PAID_LLM_PROVIDER,
      systemProviders: SYSTEM_LLM_PROVIDERS,
      defaultInstance: llm.getProvider(),
      paidInstance: llmPaid.getProvider(),
    },
    content: {
      tragicRealismLevel: env.TRAGIC_REALISM_LEVEL,
      tragicRealismDescription: [
        'Off (legacy tone)',
        'Subtle',
        'Clear',
        'Mythic / Destiny-forward',
      ][env.TRAGIC_REALISM_LEVEL] || 'Unknown',
    },
    queue: {
      enabled: env.SUPABASE_QUEUE_ENABLED,
      rolloutPercent: env.SUPABASE_QUEUE_ROLLOUT_PERCENT,
    },
    worker: {
      maxConcurrentTasks: env.WORKER_MAX_CONCURRENT_TASKS,
      pollingIntervalMs: env.WORKER_POLLING_INTERVAL_MS,
      maxPollingIntervalMs: env.WORKER_MAX_POLLING_INTERVAL_MS,
    },
    features: {
      betaKeyEnabled: !!env.BETA_KEY,
      devAutoConfirmEmail: env.DEV_AUTO_CONFIRM_EMAIL,
    },
  });
});

/**
 * GET /api/admin/queue/status
 * Get current job queue status
 */
router.get('/queue/status', requirePermission('jobs', 'read'), async (c) => {
  const supabase = createSupabaseServiceClient();
  if (!supabase) {
    return c.json({ error: 'Database connection failed' }, 500);
  }

  try {
    // Get counts by status
    const statuses = ['pending', 'claimed', 'processing', 'complete', 'error'];
    const counts: Record<string, number> = {};

    for (const status of statuses) {
      const { count } = await supabase
        .from('job_queue_v2')
        .select('*', { count: 'exact', head: true })
        .eq('status', status);
      counts[status] = count || 0;
    }

    // Get counts by task type
    const taskTypes = ['text', 'audio', 'pdf'];
    const taskCounts: Record<string, number> = {};

    for (const type of taskTypes) {
      const { count } = await supabase
        .from('job_queue_v2')
        .select('*', { count: 'exact', head: true })
        .eq('task_type', type)
        .in('status', ['pending', 'claimed', 'processing']);
      taskCounts[type] = count || 0;
    }

    // Get stuck tasks (claimed > 10 minutes ago)
    const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000).toISOString();
    const { count: stuckCount } = await supabase
      .from('job_queue_v2')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'claimed')
      .lt('claimed_at', tenMinutesAgo);

    // Get error rate (last hour)
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    const { count: recentTotal } = await supabase
      .from('job_queue_v2')
      .select('*', { count: 'exact', head: true })
      .gte('created_at', oneHourAgo);

    const { count: recentErrors } = await supabase
      .from('job_queue_v2')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'error')
      .gte('created_at', oneHourAgo);

    const errorRate = recentTotal ? ((recentErrors || 0) / recentTotal * 100).toFixed(1) : '0';

    return c.json({
      byStatus: counts,
      byTaskType: taskCounts,
      health: {
        stuckTasks: stuckCount || 0,
        recentErrorRate: `${errorRate}%`,
        recentTotal: recentTotal || 0,
        recentErrors: recentErrors || 0,
      },
      timestamp: new Date().toISOString(),
    });
  } catch (err: any) {
    return c.json({ error: err.message }, 500);
  }
});

/**
 * GET /api/admin/storage/usage
 * Get Supabase storage usage details
 */
router.get('/storage/usage', requirePermission('system', 'read'), async (c) => {
  const supabase = createSupabaseServiceClient();
  if (!supabase) {
    return c.json({ error: 'Database connection failed' }, 500);
  }

  try {
    const buckets = ['audio', 'pdf-readings', 'songs'];
    const usage: Record<string, any> = {};

    for (const bucket of buckets) {
      try {
        const { data, error } = await supabase.storage
          .from(bucket)
          .list('', { limit: 1000, sortBy: { column: 'created_at', order: 'desc' } });

        if (error) {
          usage[bucket] = { error: error.message };
        } else {
          const files = data || [];
          const totalSize = files.reduce((sum: number, f: any) => sum + (f.metadata?.size || 0), 0);

          usage[bucket] = {
            fileCount: files.length,
            totalSizeMB: (totalSize / (1024 * 1024)).toFixed(2),
            recentFiles: files.slice(0, 5).map((f: any) => ({
              name: f.name,
              size: f.metadata?.size,
              created: f.created_at,
            })),
          };
        }
      } catch (bucketErr: any) {
        usage[bucket] = { error: bucketErr.message };
      }
    }

    return c.json({
      buckets: usage,
      timestamp: new Date().toISOString(),
    });
  } catch (err: any) {
    return c.json({ error: err.message }, 500);
  }
});

// ───────────────────────────────────────────────────────────────────────────
// COST TRACKING
// ───────────────────────────────────────────────────────────────────────────

/**
 * GET /api/admin/costs/today
 * Get today's costs breakdown
 */
router.get('/costs/today', requirePermission('analytics', 'read'), async (c) => {
  try {
    const summary = await getTodayCosts();
    if (!summary) {
      return c.json({ error: 'Failed to fetch costs' }, 500);
    }
    return c.json(summary);
  } catch (err: any) {
    return c.json({ error: err.message }, 500);
  }
});

/**
 * GET /api/admin/costs/month
 * Get this month's costs breakdown
 */
router.get('/costs/month', requirePermission('analytics', 'read'), async (c) => {
  try {
    const summary = await getMonthCosts();
    if (!summary) {
      return c.json({ error: 'Failed to fetch costs' }, 500);
    }
    return c.json(summary);
  } catch (err: any) {
    return c.json({ error: err.message }, 500);
  }
});

/**
 * GET /api/admin/costs/range
 * Get costs for a custom date range
 */
router.get('/costs/range', requirePermission('analytics', 'read'), async (c) => {
  try {
    const startStr = c.req.query('start');
    const endStr = c.req.query('end');

    if (!startStr || !endStr) {
      return c.json({ error: 'start and end query params required (ISO date strings)' }, 400);
    }

    const start = new Date(startStr);
    const end = new Date(endStr);

    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      return c.json({ error: 'Invalid date format' }, 400);
    }

    const summary = await getCostSummary(start, end);
    if (!summary) {
      return c.json({ error: 'Failed to fetch costs' }, 500);
    }
    return c.json(summary);
  } catch (err: any) {
    return c.json({ error: err.message }, 500);
  }
});

/**
 * GET /api/admin/costs/logs
 * Get recent cost log entries
 */
router.get('/costs/logs', requirePermission('analytics', 'read'), async (c) => {
  const supabase = createSupabaseServiceClient();
  if (!supabase) {
    return c.json({ error: 'Database connection failed' }, 500);
  }

  try {
    const limit = parseInt(c.req.query('limit') || '100');
    const provider = c.req.query('provider');
    const jobId = c.req.query('jobId');

    let query = supabase
      .from('cost_logs')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(Math.min(limit, 500));

    if (provider) {
      query = query.eq('provider', provider);
    }
    if (jobId) {
      query = query.eq('job_id', jobId);
    }

    const { data: logs, error } = await query;

    if (error) {
      return c.json({ error: 'Failed to fetch cost logs' }, 500);
    }

    return c.json({
      logs: logs || [],
      count: logs?.length || 0,
    });
  } catch (err: any) {
    return c.json({ error: err.message }, 500);
  }
});

/**
 * GET /api/admin/costs/pricing
 * Get current pricing configuration
 */
router.get('/costs/pricing', requirePermission('analytics', 'read'), async (c) => {
  return c.json({
    llm: LLM_PRICING,
    replicate: REPLICATE_PRICING,
    note: 'Prices in USD. LLM prices are per 1M tokens.',
  });
});

/**
 * GET /api/admin/costs/by-job/:jobId
 * Get detailed costs for a specific job
 */
router.get('/costs/by-job/:jobId', requirePermission('analytics', 'read'), async (c) => {
  const supabase = createSupabaseServiceClient();
  if (!supabase) {
    return c.json({ error: 'Database connection failed' }, 500);
  }

  const jobId = c.req.param('jobId');

  try {
    // Get job info
    const { data: job, error: jobError } = await supabase
      .from('jobs')
      .select('id, type, status, total_cost_usd, cost_breakdown, created_at, completed_at')
      .eq('id', jobId)
      .single();

    if (jobError || !job) {
      return c.json({ error: 'Job not found' }, 404);
    }

    // Get cost logs for this job
    const { data: logs, error: logsError } = await supabase
      .from('cost_logs')
      .select('*')
      .eq('job_id', jobId)
      .order('created_at', { ascending: true });

    if (logsError) {
      return c.json({ error: 'Failed to fetch cost logs' }, 500);
    }

    // Calculate summary
    const byProvider: Record<string, { count: number; cost: number; tokens: number }> = {};
    let totalTokens = 0;
    let totalCost = 0;

    for (const log of logs || []) {
      const provider = log.provider;
      if (!byProvider[provider]) {
        byProvider[provider] = { count: 0, cost: 0, tokens: 0 };
      }
      byProvider[provider].count++;
      byProvider[provider].cost += parseFloat(log.cost_usd) || 0;
      byProvider[provider].tokens += (log.input_tokens || 0) + (log.output_tokens || 0);
      totalTokens += (log.input_tokens || 0) + (log.output_tokens || 0);
      totalCost += parseFloat(log.cost_usd) || 0;
    }

    return c.json({
      job: {
        id: job.id,
        type: job.type,
        status: job.status,
        createdAt: job.created_at,
        completedAt: job.completed_at,
      },
      costs: {
        total: totalCost,
        totalTokens,
        byProvider,
        breakdown: job.cost_breakdown,
      },
      logs: logs || [],
    });
  } catch (err: any) {
    return c.json({ error: err.message }, 500);
  }
});

// ───────────────────────────────────────────────────────────────────────────
// MATCHES & GALLERY MANAGEMENT
// ───────────────────────────────────────────────────────────────────────────

/**
 * GET /api/admin/matches
 * Get all matches
 */
router.get('/matches', async (c) => {
  const supabase = createSupabaseServiceClient();
  if (!supabase) return c.json({ error: 'Database not configured' }, 500);

  try {
    const { data: matches, error } = await supabase
      .from('matches')
      .select(`
        id,
        user1_id,
        user2_id,
        person1_id,
        person2_id,
        compatibility_score,
        match_reason,
        systems_matched,
        status,
        user1_seen_at,
        user2_seen_at,
        created_at,
        updated_at,
        person1:person1_id (display_name),
        person2:person2_id (display_name)
      `)
      .order('created_at', { ascending: false })
      .limit(100);

    if (error) {
      // Table might not exist yet
      if (error.code === '42P01') {
        return c.json({ matches: [], error: 'Matches table not yet created. Apply migration 028.' });
      }
      throw error;
    }

    const formattedMatches = (matches || []).map((m: any) => ({
      id: m.id,
      user1_id: m.user1_id,
      user2_id: m.user2_id,
      person1_name: m.person1?.display_name || 'Unknown',
      person2_name: m.person2?.display_name || 'Unknown',
      compatibility_score: m.compatibility_score,
      match_reason: m.match_reason,
      systems_matched: m.systems_matched || [],
      status: m.status,
      created_at: m.created_at,
    }));

    return c.json({ matches: formattedMatches });
  } catch (err: any) {
    console.error('Admin matches error:', err);
    return c.json({ error: err.message, matches: [] }, 500);
  }
});

/**
 * GET /api/admin/matches/stats
 * Get match and gallery statistics
 */
router.get('/matches/stats', async (c) => {
  const supabase = createSupabaseServiceClient();
  if (!supabase) return c.json({ error: 'Database not configured' }, 500);

  try {
    // Gallery stats - count portraits
    const { count: portraitCount } = await supabase
      .from('library_people')
      .select('*', { count: 'exact', head: true })
      .not('portrait_url', 'is', null);

    const { count: activeUsers } = await supabase
      .from('library_people')
      .select('*', { count: 'exact', head: true })
      .eq('is_self', true)
      .gte('last_active_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString());

    const { count: recentUploads } = await supabase
      .from('library_people')
      .select('*', { count: 'exact', head: true })
      .not('portrait_url', 'is', null)
      .gte('updated_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString());

    // Match stats
    let matchStats = {
      total_matches: 0,
      active_matches: 0,
      pending_matches: 0,
      declined_matches: 0,
      avg_compatibility: 0,
    };

    try {
      const { data: matches } = await supabase
        .from('matches')
        .select('status, compatibility_score');

      if (matches && matches.length > 0) {
        matchStats.total_matches = matches.length;
        matchStats.active_matches = matches.filter((m: any) => m.status === 'active').length;
        matchStats.pending_matches = matches.filter((m: any) => m.status === 'pending').length;
        matchStats.declined_matches = matches.filter((m: any) => m.status === 'declined').length;
        
        const scoresWithValues = matches.filter((m: any) => m.compatibility_score != null);
        if (scoresWithValues.length > 0) {
          matchStats.avg_compatibility = scoresWithValues.reduce((sum: number, m: any) => sum + m.compatibility_score, 0) / scoresWithValues.length;
        }
      }
    } catch {
      // Matches table might not exist
    }

    return c.json({
      galleryStats: {
        total_portraits: portraitCount || 0,
        active_users: activeUsers || 0,
        recent_uploads: recentUploads || 0,
      },
      matchStats,
    });
  } catch (err: any) {
    console.error('Admin matches stats error:', err);
    return c.json({ error: err.message }, 500);
  }
});

/**
 * POST /api/admin/matches/create
 * Manually create a match (for testing)
 */
router.post('/matches/create', async (c) => {
  const supabase = createSupabaseServiceClient();
  if (!supabase) return c.json({ error: 'Database not configured' }, 500);

  try {
    const body = await c.req.json();
    const { user1Id, user2Id, compatibilityScore, matchReason, systemsMatched } = body;

    if (!user1Id || !user2Id) {
      return c.json({ error: 'Missing user IDs' }, 400);
    }

    const { data, error } = await supabase.rpc('create_match', {
      p_user1_id: user1Id,
      p_user2_id: user2Id,
      p_compatibility_score: compatibilityScore || null,
      p_match_reason: matchReason || null,
      p_systems_matched: JSON.stringify(systemsMatched || []),
    });

    if (error) throw error;

    return c.json({ success: true, matchId: data });
  } catch (err: any) {
    return c.json({ error: err.message }, 500);
  }
});

/**
 * GET /api/admin/gallery
 * Get gallery of AI portrait portraits
 */
router.get('/gallery', async (c) => {
  const supabase = createSupabaseServiceClient();
  if (!supabase) return c.json({ error: 'Database not configured' }, 500);

  const limit = parseInt(c.req.query('limit') || '50');
  const offset = parseInt(c.req.query('offset') || '0');

  try {
    const { data, error } = await supabase
      .from('library_people')
      .select(`
        id,
        user_id,
        display_name,
        portrait_url,
        placements,
        gallery_bio,
        last_active_at,
        show_in_gallery,
        created_at
      `)
      .not('portrait_url', 'is', null)
      .eq('is_self', true)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) throw error;

    return c.json({
      gallery: data || [],
      count: data?.length || 0,
    });
  } catch (err: any) {
    return c.json({ error: err.message }, 500);
  }
});

export default router;

