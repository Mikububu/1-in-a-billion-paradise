"use strict";
/**
 * ADMIN ROUTES
 *
 * Role-based admin system for managing users, jobs, and platform operations.
 * All routes require admin authentication and appropriate permissions.
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const hono_1 = require("hono");
const zod_1 = require("zod");
const axios_1 = __importDefault(require("axios"));
const crypto_1 = require("crypto");
const adminAuth_1 = require("../middleware/adminAuth");
const supabaseClient_1 = require("../services/supabaseClient");
const swissEphemeris_1 = require("../services/swissEphemeris");
const llmProviders_1 = require("../config/llmProviders");
const llm_1 = require("../services/llm");
const apiKeysHelper_1 = require("../services/apiKeysHelper");
const env_1 = require("../config/env");
const costTracking_1 = require("../services/costTracking");
const router = new hono_1.Hono();
// Apply admin auth to all routes
router.use('/*', adminAuth_1.requireAdminAuth);
// ───────────────────────────────────────────────────────────────────────────
// USER MANAGEMENT
// ───────────────────────────────────────────────────────────────────────────
const userListSchema = zod_1.z.object({
    page: zod_1.z.coerce.number().min(1).default(1),
    limit: zod_1.z.coerce.number().min(1).max(100).default(20),
    search: zod_1.z.string().optional(),
    role: zod_1.z.enum(['user', 'admin']).optional(),
    status: zod_1.z.enum(['active', 'suspended']).optional(),
    sortBy: zod_1.z.enum(['created_at', 'email', 'last_sign_in_at']).default('created_at'),
    sortOrder: zod_1.z.enum(['asc', 'desc']).default('desc'),
});
/**
 * GET /api/admin/users
 * List users with pagination and filters
 */
router.get('/users', (0, adminAuth_1.requirePermission)('users', 'read'), async (c) => {
    const supabase = (0, supabaseClient_1.createSupabaseServiceClient)();
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
    }
    catch (err) {
        if (err instanceof zod_1.z.ZodError) {
            return c.json({ error: 'Invalid query parameters', details: err.issues }, 400);
        }
        return c.json({ error: 'Internal server error' }, 500);
    }
});
/**
 * GET /api/admin/users/:userId
 * Get user details
 */
router.get('/users/:userId', (0, adminAuth_1.requirePermission)('users', 'read'), async (c) => {
    const supabase = (0, supabaseClient_1.createSupabaseServiceClient)();
    if (!supabase) {
        return c.json({ error: 'Database connection failed' }, 500);
    }
    const userId = c.req.param('userId');
    const admin = (0, adminAuth_1.getAdmin)(c);
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
    }
    catch (err) {
        console.error('Error fetching user:', err);
        return c.json({ error: 'Internal server error' }, 500);
    }
});
/**
 * POST /api/admin/users/:userId/notes
 * Add a note to a user
 */
router.post('/users/:userId/notes', (0, adminAuth_1.requirePermission)('users', 'write'), async (c) => {
    const supabase = (0, supabaseClient_1.createSupabaseServiceClient)();
    if (!supabase) {
        return c.json({ error: 'Database connection failed' }, 500);
    }
    const userId = c.req.param('userId');
    const admin = (0, adminAuth_1.getAdmin)(c);
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
        await (0, adminAuth_1.logAdminAction)(admin.id, 'user_note_created', 'user', userId, { note_id: data.id }, c.req.header('x-forwarded-for') || undefined, c.req.header('user-agent') || undefined);
        return c.json({ note: data });
    }
    catch (err) {
        return c.json({ error: 'Internal server error' }, 500);
    }
});
/**
 * PUT /api/admin/users/:userId
 * Update user (limited fields)
 */
router.put('/users/:userId', (0, adminAuth_1.requirePermission)('users', 'write'), async (c) => {
    const supabase = (0, supabaseClient_1.createSupabaseServiceClient)();
    if (!supabase) {
        return c.json({ error: 'Database connection failed' }, 500);
    }
    const userId = c.req.param('userId');
    const admin = (0, adminAuth_1.getAdmin)(c);
    try {
        const body = await c.req.json();
        const { email, user_metadata } = body;
        const updates = {};
        if (email)
            updates.email = email;
        if (user_metadata)
            updates.user_metadata = user_metadata;
        const { data, error } = await supabase.auth.admin.updateUserById(userId, updates);
        if (error) {
            console.error('Error updating user:', error);
            return c.json({ error: 'Failed to update user' }, 500);
        }
        // Log action
        await (0, adminAuth_1.logAdminAction)(admin.id, 'user_updated', 'user', userId, { updates }, c.req.header('x-forwarded-for') || undefined, c.req.header('user-agent') || undefined);
        return c.json({ user: data.user });
    }
    catch (err) {
        return c.json({ error: 'Internal server error' }, 500);
    }
});
/**
 * POST /api/admin/users/:userId/set-password
 * Directly set a new password for any user.
 * Useful when you need to assign credentials without sending an email.
 */
router.post('/users/:userId/set-password', (0, adminAuth_1.requirePermission)('users', 'write'), async (c) => {
    const supabase = (0, supabaseClient_1.createSupabaseServiceClient)();
    if (!supabase) {
        return c.json({ error: 'Database connection failed' }, 500);
    }
    const userId = c.req.param('userId');
    const admin = (0, adminAuth_1.getAdmin)(c);
    try {
        const body = await c.req.json();
        const { password } = body;
        if (!password || typeof password !== 'string' || password.length < 6) {
            return c.json({ error: 'Password must be at least 6 characters' }, 400);
        }
        const { data, error } = await supabase.auth.admin.updateUserById(userId, { password });
        if (error) {
            console.error('Error setting password:', error);
            return c.json({ error: `Failed to set password: ${error.message}` }, 500);
        }
        await (0, adminAuth_1.logAdminAction)(admin.id, 'password_set', 'user', userId, { note: 'Admin manually set user password' }, c.req.header('x-forwarded-for') || undefined, c.req.header('user-agent') || undefined);
        return c.json({ success: true, message: 'Password updated successfully' });
    }
    catch (err) {
        return c.json({ error: 'Internal server error' }, 500);
    }
});
/**
 * DELETE /api/admin/users/:userId
 * Permanently delete a user and ALL associated data.
 * Requires superadmin permission. This action is irreversible.
 */
router.delete('/users/:userId', (0, adminAuth_1.requirePermission)('users', 'delete'), async (c) => {
    const supabase = (0, supabaseClient_1.createSupabaseServiceClient)();
    if (!supabase) {
        return c.json({ error: 'Database connection failed' }, 500);
    }
    const userId = c.req.param('userId');
    const admin = (0, adminAuth_1.getAdmin)(c);
    try {
        // Verify user exists before deleting
        const { data: userCheck, error: userCheckError } = await supabase.auth.admin.getUserById(userId);
        if (userCheckError || !userCheck?.user) {
            return c.json({ error: 'User not found' }, 404);
        }
        const userEmail = userCheck.user.email;
        const errors = [];
        // ── 1. Delete all user data from app tables (order matters for FK constraints) ──
        const tablesToDelete = [
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
            const { error } = await supabase.from(table).delete().eq('user_id', userId);
            if (error) {
                // Log but continue - some tables may not have user_id or row may not exist
                console.warn(`⚠️  Could not delete from ${table} for user ${userId}: ${error.message}`);
                errors.push(`${table}: ${error.message}`);
            }
        }
        // ── 2. Delete Supabase Storage files for this user ──
        // Try common bucket paths - ignore errors if buckets don't exist or are empty
        const storageBuckets = ['avatars', 'audio', 'pdfs', 'portraits', 'videos'];
        for (const bucket of storageBuckets) {
            try {
                const { data: files } = await supabase.storage.from(bucket).list(userId);
                if (files && files.length > 0) {
                    const paths = files.map((f) => `${userId}/${f.name}`);
                    await supabase.storage.from(bucket).remove(paths);
                }
            }
            catch {
                // Bucket may not exist or user has no files - fine
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
        await (0, adminAuth_1.logAdminAction)(admin.id, 'user_deleted', 'user', userId, { email: userEmail, data_deletion_errors: errors }, c.req.header('x-forwarded-for') || undefined, c.req.header('user-agent') || undefined);
        console.log(`🗑️  Admin ${admin.id} deleted user ${userId} (${userEmail})`);
        return c.json({
            success: true,
            message: `User ${userEmail} and all associated data permanently deleted.`,
            warnings: errors.length > 0 ? errors : undefined,
        });
    }
    catch (err) {
        console.error('Error deleting user:', err);
        return c.json({ error: 'Internal server error' }, 500);
    }
});
// ───────────────────────────────────────────────────────────────────────────
// JOB MONITORING
// ───────────────────────────────────────────────────────────────────────────
const jobListSchema = zod_1.z.object({
    page: zod_1.z.coerce.number().min(1).default(1),
    limit: zod_1.z.coerce.number().min(1).max(100).default(20),
    status: zod_1.z.enum(['queued', 'processing', 'complete', 'error', 'cancelled']).optional(),
    type: zod_1.z.string().optional(),
    userId: zod_1.z.string().uuid().optional(),
    dateFrom: zod_1.z.string().optional(),
    dateTo: zod_1.z.string().optional(),
});
/**
 * GET /api/admin/jobs
 * List jobs with filters
 */
router.get('/jobs', (0, adminAuth_1.requirePermission)('jobs', 'read'), async (c) => {
    const supabase = (0, supabaseClient_1.createSupabaseServiceClient)();
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
    }
    catch (err) {
        if (err instanceof zod_1.z.ZodError) {
            return c.json({ error: 'Invalid query parameters', details: err.issues }, 400);
        }
        return c.json({ error: 'Internal server error' }, 500);
    }
});
/**
 * GET /api/admin/jobs/:jobId
 * Get job details
 */
router.get('/jobs/:jobId', (0, adminAuth_1.requirePermission)('jobs', 'read'), async (c) => {
    const supabase = (0, supabaseClient_1.createSupabaseServiceClient)();
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
    }
    catch (err) {
        console.error('Error fetching job:', err);
        return c.json({ error: 'Internal server error' }, 500);
    }
});
/**
 * POST /api/admin/jobs/:jobId/cancel
 * Cancel a job
 */
router.post('/jobs/:jobId/cancel', (0, adminAuth_1.requirePermission)('jobs', 'write'), async (c) => {
    const supabase = (0, supabaseClient_1.createSupabaseServiceClient)();
    if (!supabase) {
        return c.json({ error: 'Database connection failed' }, 500);
    }
    const jobId = c.req.param('jobId');
    const admin = (0, adminAuth_1.getAdmin)(c);
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
        await (0, adminAuth_1.logAdminAction)(admin.id, 'job_cancelled', 'job', jobId, { previous_status: job.status }, c.req.header('x-forwarded-for') || undefined, c.req.header('user-agent') || undefined);
        return c.json({ job: updated });
    }
    catch (err) {
        return c.json({ error: 'Internal server error' }, 500);
    }
});
/**
 * GET /api/admin/jobs/metrics
 * Get job metrics/statistics
 */
router.get('/jobs/metrics', (0, adminAuth_1.requirePermission)('jobs', 'read'), async (c) => {
    const supabase = (0, supabaseClient_1.createSupabaseServiceClient)();
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
    }
    catch (err) {
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
router.get('/dashboard/stats', (0, adminAuth_1.requirePermission)('analytics', 'read'), async (c) => {
    const supabase = (0, supabaseClient_1.createSupabaseServiceClient)();
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
    }
    catch (err) {
        console.error('Error fetching dashboard stats:', err);
        return c.json({ error: 'Internal server error' }, 500);
    }
});
/**
 * GET /api/admin/dashboard/job-logs
 * Get job execution logs with tasks, costs, and performance metrics
 */
router.get('/dashboard/job-logs', (0, adminAuth_1.requirePermission)('analytics', 'read'), async (c) => {
    const supabase = (0, supabaseClient_1.createSupabaseServiceClient)();
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
        }
        else if (filter === 'failed') {
            jobQuery = jobQuery.eq('status', 'failed');
        }
        else if (filter === 'running') {
            jobQuery = jobQuery.in('status', ['pending', 'processing']);
        }
        const { data: jobs, error: jobsError } = await jobQuery;
        if (jobsError) {
            console.error('Error fetching jobs:', jobsError);
            return c.json({ error: 'Failed to fetch jobs' }, 500);
        }
        // Fetch tasks for each job
        const jobIds = jobs?.map((j) => j.id) || [];
        const { data: tasks, error: tasksError } = await supabase
            .from('job_tasks')
            .select('id, job_id, type, status, error_message, cost_data, created_at, completed_at')
            .in('job_id', jobIds);
        if (tasksError) {
            console.error('Error fetching tasks:', tasksError);
            return c.json({ error: 'Failed to fetch tasks' }, 500);
        }
        // Group tasks by job
        const tasksByJob = (tasks || []).reduce((acc, task) => {
            if (!acc[task.job_id])
                acc[task.job_id] = [];
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
        }, {});
        // Format response
        const jobLogs = (jobs || []).map((job) => ({
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
    }
    catch (err) {
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
router.get('/llm/config', (0, adminAuth_1.requirePermission)('system', 'read'), async (c) => {
    try {
        return c.json({
            providers: llmProviders_1.SYSTEM_LLM_PROVIDERS,
            available: ['claude', 'deepseek', 'openai'],
            current_default: llm_1.llm.getProvider(),
            current_paid: llm_1.llmPaid.getProvider(),
            note: 'To change providers, update src/config/llmProviders.ts and redeploy. Runtime config coming soon.',
        });
    }
    catch (err) {
        return c.json({ error: 'Internal server error' }, 500);
    }
});
// ───────────────────────────────────────────────────────────────────────────
// SUBSCRIPTION MANAGEMENT
// ───────────────────────────────────────────────────────────────────────────
const subscriptionListSchema = zod_1.z.object({
    page: zod_1.z.coerce.number().min(1).default(1),
    limit: zod_1.z.coerce.number().min(1).max(100).default(20),
    status: zod_1.z.enum(['active', 'cancelled', 'past_due', 'incomplete']).optional(),
    includedReadingUsed: zod_1.z.enum(['true', 'false']).optional(),
});
/**
 * GET /api/admin/subscriptions
 * List all subscriptions with filters
 */
router.get('/subscriptions', (0, adminAuth_1.requirePermission)('subscriptions', 'read'), async (c) => {
    const supabase = (0, supabaseClient_1.createSupabaseServiceClient)();
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
        }
        else if (includedReadingUsed === 'false') {
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
    }
    catch (err) {
        if (err instanceof zod_1.z.ZodError) {
            return c.json({ error: 'Invalid query parameters', details: err.issues }, 400);
        }
        return c.json({ error: 'Internal server error' }, 500);
    }
});
/**
 * GET /api/admin/subscriptions/:subscriptionId
 * Get subscription details
 */
router.get('/subscriptions/:subscriptionId', (0, adminAuth_1.requirePermission)('subscriptions', 'read'), async (c) => {
    const supabase = (0, supabaseClient_1.createSupabaseServiceClient)();
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
    }
    catch (err) {
        console.error('Error fetching subscription:', err);
        return c.json({ error: 'Internal server error' }, 500);
    }
});
/**
 * GET /api/admin/subscriptions/stats
 * Get subscription statistics
 */
router.get('/subscriptions/stats', (0, adminAuth_1.requirePermission)('subscriptions', 'read'), async (c) => {
    const supabase = (0, supabaseClient_1.createSupabaseServiceClient)();
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
        const systemCounts = {};
        bySystem?.forEach((s) => {
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
    }
    catch (err) {
        console.error('Error fetching subscription stats:', err);
        return c.json({ error: 'Internal server error' }, 500);
    }
});
/**
 * POST /api/admin/subscriptions/:subscriptionId/reset-reading
 * Reset included reading (allow user to use it again)
 */
router.post('/subscriptions/:subscriptionId/reset-reading', (0, adminAuth_1.requirePermission)('subscriptions', 'manage'), async (c) => {
    const supabase = (0, supabaseClient_1.createSupabaseServiceClient)();
    if (!supabase) {
        return c.json({ error: 'Database connection failed' }, 500);
    }
    const subscriptionId = c.req.param('subscriptionId');
    const admin = (0, adminAuth_1.getAdmin)(c);
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
        await (0, adminAuth_1.logAdminAction)(admin.id, 'subscription_reading_reset', 'subscription', subscriptionId, {
            previous_system: subscription.included_reading_system,
            previous_job_id: subscription.included_reading_job_id,
        }, c.req.header('x-forwarded-for') || undefined, c.req.header('user-agent') || undefined);
        return c.json({ subscription: updated });
    }
    catch (err) {
        return c.json({ error: 'Internal server error' }, 500);
    }
});
/**
 * GET /api/admin/services/status
 * Get status and balances for all API services
 */
router.get('/services/status', (0, adminAuth_1.requirePermission)('system', 'read'), async (c) => {
    const services = [];
    // 1. RunPod - Check balance via GraphQL API
    try {
        const runpodKey = await apiKeysHelper_1.apiKeys.runpod();
        const runpodEndpointId = await apiKeysHelper_1.apiKeys.runpodEndpoint();
        // Get balance and spend info
        const balanceRes = await axios_1.default.post('https://api.runpod.io/graphql', {
            query: `query { myself { currentSpendPerHr creditBalance serverlessDiscount { discountFactor } } }`
        }, {
            headers: {
                'Authorization': `Bearer ${runpodKey}`,
                'Content-Type': 'application/json',
            },
            timeout: 10000,
        });
        // Get endpoint status
        const endpointRes = await axios_1.default.post('https://api.runpod.io/graphql', {
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
        const currentEndpoint = endpoints.find((e) => e.id === runpodEndpointId);
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
    }
    catch (err) {
        services.push({
            name: 'RunPod',
            status: 'error',
            error: err.message,
        });
    }
    // 2. Fly.io - Check organization billing
    try {
        const flyToken = await apiKeysHelper_1.apiKeys.flyIo();
        if (flyToken) {
            // Fly.io GraphQL API for billing
            const billingRes = await axios_1.default.post('https://api.fly.io/graphql', {
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
        }
        else {
            services.push({
                name: 'Fly.io',
                status: 'unknown',
                balance: 'N/A',
                details: { keyConfigured: false },
            });
        }
    }
    catch (err) {
        services.push({
            name: 'Fly.io',
            status: 'error',
            error: err.message?.substring(0, 100),
        });
    }
    // 3. Anthropic (Claude) - No direct balance API, check if key works
    try {
        const claudeKey = await apiKeysHelper_1.apiKeys.claude();
        services.push({
            name: 'Anthropic (Claude)',
            status: claudeKey ? 'ok' : 'error',
            balance: 'Check console.anthropic.com',
            details: {
                keyConfigured: !!claudeKey,
                provider: 'claude',
                model: 'claude-sonnet-4-6',
                note: 'Anthropic does not provide a balance API. Check your dashboard.',
                dashboardUrl: 'https://console.anthropic.com/settings/billing',
            },
        });
    }
    catch (err) {
        services.push({
            name: 'Anthropic (Claude)',
            status: 'error',
            error: err.message,
        });
    }
    // 4. OpenAI - Try to get usage info
    try {
        const openaiKey = await apiKeysHelper_1.apiKeys.openai();
        if (openaiKey) {
            // Try to get subscription info (may not work for all accounts)
            try {
                const usageRes = await axios_1.default.get('https://api.openai.com/v1/dashboard/billing/subscription', {
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
                        model: env_1.env.OPENAI_MODEL,
                        plan: sub?.plan?.title,
                        dashboardUrl: 'https://platform.openai.com/usage',
                    },
                });
            }
            catch {
                // Billing API not available, just show key status
                services.push({
                    name: 'OpenAI',
                    status: 'ok',
                    balance: 'Check platform.openai.com',
                    details: {
                        keyConfigured: true,
                        provider: 'openai',
                        model: env_1.env.OPENAI_MODEL,
                        note: 'Billing API requires org admin permissions.',
                        dashboardUrl: 'https://platform.openai.com/usage',
                    },
                });
            }
        }
        else {
            services.push({
                name: 'OpenAI',
                status: 'error',
                balance: 'N/A',
                details: { keyConfigured: false },
            });
        }
    }
    catch (err) {
        services.push({
            name: 'OpenAI',
            status: 'error',
            error: err.message,
        });
    }
    // 5. DeepSeek - Try to get balance
    try {
        const deepseekKey = await apiKeysHelper_1.apiKeys.deepseek();
        if (deepseekKey) {
            try {
                // DeepSeek has a user balance endpoint
                const balanceRes = await axios_1.default.get('https://api.deepseek.com/user/balance', {
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
            }
            catch {
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
        }
        else {
            services.push({
                name: 'DeepSeek',
                status: 'error',
                balance: 'N/A',
                details: { keyConfigured: false },
            });
        }
    }
    catch (err) {
        services.push({
            name: 'DeepSeek',
            status: 'error',
            error: err.message,
        });
    }
    // 6. MiniMax - Check balance
    try {
        const minimaxKey = await apiKeysHelper_1.apiKeys.minimax();
        if (minimaxKey) {
            try {
                // MiniMax query balance endpoint
                const balanceRes = await axios_1.default.get('https://api.minimax.chat/v1/query_balance', {
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
            }
            catch {
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
        }
        else {
            services.push({
                name: 'MiniMax',
                status: 'error',
                balance: 'N/A',
                details: { keyConfigured: false },
            });
        }
    }
    catch (err) {
        services.push({
            name: 'MiniMax',
            status: 'error',
            error: err.message,
        });
    }
    // 7. Google Places - Check if key works
    try {
        const googleKey = await apiKeysHelper_1.apiKeys.googlePlaces();
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
    }
    catch (err) {
        services.push({
            name: 'Google Places',
            status: 'error',
            error: err.message,
        });
    }
    // 8. Supabase - Check usage and estimate
    try {
        const supabase = (0, supabaseClient_1.createSupabaseServiceClient)();
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
    }
    catch (err) {
        services.push({
            name: 'Supabase',
            status: 'error',
            error: err.message,
        });
    }
    // 9. Stripe - Check balance
    try {
        const stripeKey = await apiKeysHelper_1.apiKeys.stripe();
        if (stripeKey) {
            try {
                // Get Stripe balance
                const Stripe = (await Promise.resolve().then(() => __importStar(require('stripe')))).default;
                const stripe = new Stripe(stripeKey);
                const balance = await stripe.balance.retrieve();
                // Sum available balance
                const availableUSD = balance.available
                    .filter((b) => b.currency === 'usd')
                    .reduce((sum, b) => sum + b.amount, 0) / 100;
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
                            .filter((b) => b.currency === 'usd')
                            .reduce((sum, b) => sum + b.amount, 0) / 100,
                        dashboardUrl: 'https://dashboard.stripe.com/balance',
                    },
                });
            }
            catch (stripeErr) {
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
        }
        else {
            services.push({
                name: 'Stripe',
                status: 'unknown',
                balance: 'N/A',
                details: { keyConfigured: false },
            });
        }
    }
    catch (err) {
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
            tragicRealismLevel: env_1.env.TRAGIC_REALISM_LEVEL,
            paidLlmProvider: env_1.env.PAID_LLM_PROVIDER,
            supabaseQueueEnabled: env_1.env.SUPABASE_QUEUE_ENABLED,
        },
    });
});
/**
 * GET /api/admin/services/runpod/detailed
 * Get detailed RunPod endpoint and job status
 */
router.get('/services/runpod/detailed', (0, adminAuth_1.requirePermission)('system', 'read'), async (c) => {
    try {
        const runpodKey = await apiKeysHelper_1.apiKeys.runpod();
        const runpodEndpointId = await apiKeysHelper_1.apiKeys.runpodEndpoint();
        // Get all endpoints with detailed info
        const res = await axios_1.default.post('https://api.runpod.io/graphql', {
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
        const currentEndpoint = data.endpoints?.find((e) => e.id === runpodEndpointId);
        const jobs = data.serverlessJobs || [];
        // Calculate job stats
        const completedJobs = jobs.filter((j) => j.status === 'COMPLETED');
        const failedJobs = jobs.filter((j) => j.status === 'FAILED');
        const avgExecutionTime = completedJobs.length > 0
            ? completedJobs.reduce((sum, j) => sum + (j.executionTime || 0), 0) / completedJobs.length
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
    }
    catch (err) {
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
router.get('/system/config', (0, adminAuth_1.requirePermission)('system', 'read'), async (c) => {
    return c.json({
        llm: {
            paidProvider: env_1.env.PAID_LLM_PROVIDER,
            systemProviders: llmProviders_1.SYSTEM_LLM_PROVIDERS,
            defaultInstance: llm_1.llm.getProvider(),
            paidInstance: llm_1.llmPaid.getProvider(),
        },
        content: {
            tragicRealismLevel: env_1.env.TRAGIC_REALISM_LEVEL,
            tragicRealismDescription: [
                'Off (legacy tone)',
                'Subtle',
                'Clear',
                'Mythic / Destiny-forward',
            ][env_1.env.TRAGIC_REALISM_LEVEL] || 'Unknown',
        },
        queue: {
            enabled: env_1.env.SUPABASE_QUEUE_ENABLED,
            rolloutPercent: env_1.env.SUPABASE_QUEUE_ROLLOUT_PERCENT,
        },
        worker: {
            maxConcurrentTasks: env_1.env.WORKER_MAX_CONCURRENT_TASKS,
            pollingIntervalMs: env_1.env.WORKER_POLLING_INTERVAL_MS,
            maxPollingIntervalMs: env_1.env.WORKER_MAX_POLLING_INTERVAL_MS,
        },
        features: {
            betaKeyEnabled: !!env_1.env.BETA_KEY,
            devAutoConfirmEmail: env_1.env.DEV_AUTO_CONFIRM_EMAIL,
        },
    });
});
/**
 * GET /api/admin/queue/status
 * Get current job queue status
 */
router.get('/queue/status', (0, adminAuth_1.requirePermission)('jobs', 'read'), async (c) => {
    const supabase = (0, supabaseClient_1.createSupabaseServiceClient)();
    if (!supabase) {
        return c.json({ error: 'Database connection failed' }, 500);
    }
    try {
        // Get counts by status
        const statuses = ['pending', 'claimed', 'processing', 'complete', 'error'];
        const counts = {};
        for (const status of statuses) {
            const { count } = await supabase
                .from('job_queue_v2')
                .select('*', { count: 'exact', head: true })
                .eq('status', status);
            counts[status] = count || 0;
        }
        // Get counts by task type
        const taskTypes = ['text', 'audio', 'pdf'];
        const taskCounts = {};
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
    }
    catch (err) {
        return c.json({ error: err.message }, 500);
    }
});
/**
 * GET /api/admin/storage/usage
 * Get Supabase storage usage details
 */
router.get('/storage/usage', (0, adminAuth_1.requirePermission)('system', 'read'), async (c) => {
    const supabase = (0, supabaseClient_1.createSupabaseServiceClient)();
    if (!supabase) {
        return c.json({ error: 'Database connection failed' }, 500);
    }
    try {
        const buckets = ['audio', 'pdf-readings', 'songs'];
        const usage = {};
        for (const bucket of buckets) {
            try {
                const { data, error } = await supabase.storage
                    .from(bucket)
                    .list('', { limit: 1000, sortBy: { column: 'created_at', order: 'desc' } });
                if (error) {
                    usage[bucket] = { error: error.message };
                }
                else {
                    const files = data || [];
                    const totalSize = files.reduce((sum, f) => sum + (f.metadata?.size || 0), 0);
                    usage[bucket] = {
                        fileCount: files.length,
                        totalSizeMB: (totalSize / (1024 * 1024)).toFixed(2),
                        recentFiles: files.slice(0, 5).map((f) => ({
                            name: f.name,
                            size: f.metadata?.size,
                            created: f.created_at,
                        })),
                    };
                }
            }
            catch (bucketErr) {
                usage[bucket] = { error: bucketErr.message };
            }
        }
        return c.json({
            buckets: usage,
            timestamp: new Date().toISOString(),
        });
    }
    catch (err) {
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
router.get('/costs/today', (0, adminAuth_1.requirePermission)('analytics', 'read'), async (c) => {
    try {
        const summary = await (0, costTracking_1.getTodayCosts)();
        if (!summary) {
            return c.json({ error: 'Failed to fetch costs' }, 500);
        }
        return c.json(summary);
    }
    catch (err) {
        return c.json({ error: err.message }, 500);
    }
});
/**
 * GET /api/admin/costs/month
 * Get this month's costs breakdown
 */
router.get('/costs/month', (0, adminAuth_1.requirePermission)('analytics', 'read'), async (c) => {
    try {
        const summary = await (0, costTracking_1.getMonthCosts)();
        if (!summary) {
            return c.json({ error: 'Failed to fetch costs' }, 500);
        }
        return c.json(summary);
    }
    catch (err) {
        return c.json({ error: err.message }, 500);
    }
});
/**
 * GET /api/admin/costs/range
 * Get costs for a custom date range
 */
router.get('/costs/range', (0, adminAuth_1.requirePermission)('analytics', 'read'), async (c) => {
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
        const summary = await (0, costTracking_1.getCostSummary)(start, end);
        if (!summary) {
            return c.json({ error: 'Failed to fetch costs' }, 500);
        }
        return c.json(summary);
    }
    catch (err) {
        return c.json({ error: err.message }, 500);
    }
});
/**
 * GET /api/admin/costs/logs
 * Get recent cost log entries
 */
router.get('/costs/logs', (0, adminAuth_1.requirePermission)('analytics', 'read'), async (c) => {
    const supabase = (0, supabaseClient_1.createSupabaseServiceClient)();
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
    }
    catch (err) {
        return c.json({ error: err.message }, 500);
    }
});
/**
 * GET /api/admin/costs/pricing
 * Get current pricing configuration
 */
router.get('/costs/pricing', (0, adminAuth_1.requirePermission)('analytics', 'read'), async (c) => {
    return c.json({
        llm: costTracking_1.LLM_PRICING,
        replicate: costTracking_1.REPLICATE_PRICING,
        note: 'Prices in USD. LLM prices are per 1M tokens.',
    });
});
/**
 * GET /api/admin/costs/by-job/:jobId
 * Get detailed costs for a specific job
 */
router.get('/costs/by-job/:jobId', (0, adminAuth_1.requirePermission)('analytics', 'read'), async (c) => {
    const supabase = (0, supabaseClient_1.createSupabaseServiceClient)();
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
        const byProvider = {};
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
    }
    catch (err) {
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
    const supabase = (0, supabaseClient_1.createSupabaseServiceClient)();
    if (!supabase)
        return c.json({ error: 'Database not configured' }, 500);
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
        const formattedMatches = (matches || []).map((m) => ({
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
    }
    catch (err) {
        console.error('Admin matches error:', err);
        return c.json({ error: err.message, matches: [] }, 500);
    }
});
/**
 * GET /api/admin/matches/stats
 * Get match and gallery statistics
 */
router.get('/matches/stats', async (c) => {
    const supabase = (0, supabaseClient_1.createSupabaseServiceClient)();
    if (!supabase)
        return c.json({ error: 'Database not configured' }, 500);
    try {
        // Gallery stats - count portraits
        const { count: portraitCount } = await supabase
            .from('library_people')
            .select('*', { count: 'exact', head: true })
            .not('portrait_url', 'is', null);
        const { count: activeUsers } = await supabase
            .from('library_people')
            .select('*', { count: 'exact', head: true })
            .eq('is_user', true)
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
                matchStats.active_matches = matches.filter((m) => m.status === 'active').length;
                matchStats.pending_matches = matches.filter((m) => m.status === 'pending').length;
                matchStats.declined_matches = matches.filter((m) => m.status === 'declined').length;
                const scoresWithValues = matches.filter((m) => m.compatibility_score != null);
                if (scoresWithValues.length > 0) {
                    matchStats.avg_compatibility = scoresWithValues.reduce((sum, m) => sum + m.compatibility_score, 0) / scoresWithValues.length;
                }
            }
        }
        catch {
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
    }
    catch (err) {
        console.error('Admin matches stats error:', err);
        return c.json({ error: err.message }, 500);
    }
});
/**
 * POST /api/admin/matches/create
 * Manually create a match (for testing)
 */
router.post('/matches/create', async (c) => {
    const supabase = (0, supabaseClient_1.createSupabaseServiceClient)();
    if (!supabase)
        return c.json({ error: 'Database not configured' }, 500);
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
        if (error)
            throw error;
        return c.json({ success: true, matchId: data });
    }
    catch (err) {
        return c.json({ error: err.message }, 500);
    }
});
/**
 * GET /api/admin/gallery
 * Get gallery of AI portrait portraits
 */
router.get('/gallery', async (c) => {
    const supabase = (0, supabaseClient_1.createSupabaseServiceClient)();
    if (!supabase)
        return c.json({ error: 'Database not configured' }, 500);
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
            .eq('is_user', true)
            .order('created_at', { ascending: false })
            .range(offset, offset + limit - 1);
        if (error)
            throw error;
        return c.json({
            gallery: data || [],
            count: data?.length || 0,
        });
    }
    catch (err) {
        return c.json({ error: err.message }, 500);
    }
});
/**
 * POST /api/admin/users/:userId/people/import
 * Use LLM to parse raw text into people and insert them into library_people
 */
router.post('/users/:userId/people/import', (0, adminAuth_1.requirePermission)('users', 'write'), async (c) => {
    const supabase = (0, supabaseClient_1.createSupabaseServiceClient)();
    if (!supabase)
        return c.json({ error: 'Database connection failed' }, 500);
    const userId = c.req.param('userId');
    const body = await c.req.json();
    const rawText = body.text;
    if (!rawText || typeof rawText !== 'string') {
        return c.json({ error: 'Missing or invalid text input' }, 400);
    }
    try {
        // 1. Build prompt for LLM
        const systemPrompt = `You are a data extraction assistant. The user will provide unstructured text containing details about one or multiple people.
Extract all distinct people into a strictly formatted JSON array.
For each person, provide:
- name: string (first and last name if available)
- gender: "male" | "female" | "other" (infer if obvious, else "other")
- birthDate: YYYY-MM-DD
- birthTime: HH:MM (24-hour format, use "12:00" if unknown)
- birthCity: string (City, Country formatted)
- latitude: number (approximate latitude if city is known)
- longitude: number (approximate longitude if city is known)
- timezone: string (e.g. "Europe/London", "America/New_York", essential for calculations!)

If any information is missing or you cannot determine it reasonably, do your best to approximate coordinates and timezone from the city name. 
Return ONLY a valid JSON array of these objects, without markdown blocks.`;
        const llmResult = await llm_1.llm.generate(rawText, 'admin-import-people', {
            systemPrompt,
            temperature: 0.1,
        });
        let parsedPeople;
        try {
            // Strip markdown code blocks if the LLM included them
            const cleaned = llmResult.replace(/```json/g, '').replace(/```/g, '').trim();
            parsedPeople = JSON.parse(cleaned);
            if (!Array.isArray(parsedPeople))
                throw new Error('Not an array');
        }
        catch (parseErr) {
            console.error('LLM JSON parse error:', llmResult);
            return c.json({ error: 'LLM returned invalid JSON structure', raw: llmResult }, 500);
        }
        // 2. Compute placements and prepare insert
        const insertRows = [];
        const insertedDetails = [];
        for (const person of parsedPeople) {
            const clientPersonId = (0, crypto_1.randomUUID)();
            let placements = null;
            try {
                const chart = await swissEphemeris_1.swissEngine.computePlacements({
                    birthDate: person.birthDate,
                    birthTime: person.birthTime,
                    timezone: person.timezone || 'UTC',
                    latitude: person.latitude || 0,
                    longitude: person.longitude || 0,
                });
                // We save the raw swiss ephemeris output as "placements" json so frontend can normalize it
                placements = chart;
            }
            catch (e) {
                console.error('Placements error for', person.name, e.message);
            }
            const row = {
                user_id: userId,
                client_person_id: clientPersonId,
                name: person.name || 'Unknown',
                gender: person.gender || 'other',
                birth_date: person.birthDate,
                birth_time: person.birthTime,
                birth_city: person.birthCity,
                latitude: person.latitude,
                longitude: person.longitude,
                timezone: person.timezone,
                placements,
                is_user: false,
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
            };
            insertRows.push(row);
            insertedDetails.push({ name: row.name, client_person_id: clientPersonId, hasPlacements: !!placements });
        }
        if (insertRows.length === 0) {
            return c.json({ error: 'No people were extracted from the text.' }, 400);
        }
        // 3. Insert into Supabase
        const { error: insertError } = await supabase
            .from('library_people')
            .insert(insertRows);
        if (insertError) {
            console.error('Supabase insert error:', insertError);
            return c.json({ error: 'Failed to insert people into database', details: insertError }, 500);
        }
        // 4. Log admin action
        const admin = (0, adminAuth_1.getAdmin)(c);
        if (admin) {
            (0, adminAuth_1.logAdminAction)(admin.id, 'import_people', 'user', userId, {
                count: insertRows.length,
                names: insertedDetails.map(d => d.name),
            });
        }
        return c.json({
            success: true,
            count: insertRows.length,
            people: insertedDetails,
        });
    }
    catch (err) {
        console.error('Import people error:', err);
        return c.json({ error: 'Internal server error: ' + err.message }, 500);
    }
});
// ───────────────────────────────────────────────────────────────────────────
// VOICE CLONE REGISTRATION (MiniMax Voice Clone API)
// ───────────────────────────────────────────────────────────────────────────
/**
 * POST /admin/voices/register-clone
 *
 * Registers a custom voice with MiniMax Voice Clone API.
 * Uses the full WAV file (sampleAudioUrl) to create a permanent cloned voice_id.
 *
 * Body: { voiceId: string }  (e.g. "david", "elisabeth")
 *
 * The registered voice_id will be stored in api_keys table for the audioWorker to use.
 */
router.post('/voices/register-clone', (0, adminAuth_1.requirePermission)('system', 'write'), async (c) => {
    try {
        const { voiceId } = await c.req.json();
        if (!voiceId)
            return c.json({ error: 'voiceId is required' }, 400);
        const admin = (0, adminAuth_1.getAdmin)(c);
        const { getCustomVoices } = await Promise.resolve().then(() => __importStar(require('../config/voices')));
        const { uploadForVoiceClone, registerVoiceClone } = await Promise.resolve().then(() => __importStar(require('../services/minimaxTts')));
        const voices = getCustomVoices();
        const voice = voices.find(v => v.id === voiceId);
        if (!voice)
            return c.json({ error: `Voice "${voiceId}" not found or not a custom voice` }, 404);
        if (!voice.sampleAudioUrl)
            return c.json({ error: `Voice "${voiceId}" has no sampleAudioUrl` }, 400);
        console.log(`[Admin] Registering voice clone for: ${voice.displayName} (${voiceId})`);
        // Step 1: Download full WAV and upload with purpose='voice_clone'
        const wavRes = await axios_1.default.get(voice.sampleAudioUrl, { responseType: 'arraybuffer' });
        const wavBuffer = Buffer.from(wavRes.data);
        console.log(`[Admin] Downloaded WAV: ${Math.round(wavBuffer.length / 1024)}KB`);
        const fileId = await uploadForVoiceClone(wavBuffer, `${voiceId}_full.wav`);
        console.log(`[Admin] Uploaded to MiniMax: fileId=${fileId}`);
        // Step 2: Register with Voice Clone API
        // voice_id must be 8+ chars, alphanumeric, start with letter
        const minimaxVoiceId = `billion${voiceId}voice`;
        const result = await registerVoiceClone(fileId, minimaxVoiceId, 'speech-01-turbo');
        console.log(`[Admin] Voice clone registered: ${minimaxVoiceId}`);
        // Step 3: Store the registered voice_id in api_keys table
        const sb = (0, supabaseClient_1.createSupabaseServiceClient)();
        if (sb) {
            await sb.from('api_keys').upsert({
                service: `minimax_clone_${voiceId}`,
                key_name: 'main',
                token: minimaxVoiceId,
                updated_at: new Date().toISOString(),
            }, { onConflict: 'service' });
            console.log(`[Admin] Stored clone ID in api_keys: minimax_clone_${voiceId} = ${minimaxVoiceId}`);
        }
        await (0, adminAuth_1.logAdminAction)(admin.id, 'register_voice_clone', 'voice', voiceId, { minimaxVoiceId });
        return c.json({
            success: true,
            voiceId,
            minimaxClonedVoiceId: minimaxVoiceId,
            demoAudio: result.demoAudio,
            fileId,
        });
    }
    catch (err) {
        console.error('Voice clone registration error:', err);
        return c.json({ error: err.message || 'Registration failed' }, 500);
    }
});
/**
 * POST /admin/voices/register-all-clones
 *
 * Registers ALL custom voices with MiniMax Voice Clone API in one call.
 */
router.post('/voices/register-all-clones', (0, adminAuth_1.requirePermission)('system', 'write'), async (c) => {
    try {
        const admin = (0, adminAuth_1.getAdmin)(c);
        const { getCustomVoices } = await Promise.resolve().then(() => __importStar(require('../config/voices')));
        const { uploadForVoiceClone, registerVoiceClone } = await Promise.resolve().then(() => __importStar(require('../services/minimaxTts')));
        const voices = getCustomVoices();
        const results = [];
        for (const voice of voices) {
            if (!voice.sampleAudioUrl) {
                results.push({ voiceId: voice.id, error: 'No sampleAudioUrl' });
                continue;
            }
            try {
                console.log(`[Admin] Registering clone for ${voice.displayName}...`);
                const wavRes = await axios_1.default.get(voice.sampleAudioUrl, { responseType: 'arraybuffer' });
                const fileId = await uploadForVoiceClone(Buffer.from(wavRes.data), `${voice.id}_full.wav`);
                const minimaxVoiceId = `billion${voice.id}voice`;
                const result = await registerVoiceClone(fileId, minimaxVoiceId, 'speech-01-turbo');
                // Store in api_keys
                const sb = (0, supabaseClient_1.createSupabaseServiceClient)();
                if (sb) {
                    await sb.from('api_keys').upsert({
                        service: `minimax_clone_${voice.id}`,
                        key_name: 'main',
                        token: minimaxVoiceId,
                        updated_at: new Date().toISOString(),
                    }, { onConflict: 'service' });
                }
                results.push({
                    voiceId: voice.id,
                    minimaxClonedVoiceId: minimaxVoiceId,
                    demoAudio: result.demoAudio,
                    success: true,
                });
                // Small delay between registrations to avoid rate limits
                await new Promise(r => setTimeout(r, 2000));
            }
            catch (err) {
                console.error(`Failed to register ${voice.id}:`, err.message);
                results.push({ voiceId: voice.id, error: err.message });
            }
        }
        await (0, adminAuth_1.logAdminAction)(admin.id, 'register_all_voice_clones', 'voice', null, { registered: results.filter(r => r.success).length, total: voices.length });
        return c.json({ success: true, results });
    }
    catch (err) {
        console.error('Batch voice clone error:', err);
        return c.json({ error: err.message }, 500);
    }
});
/**
 * GET /admin/voices/clone-status
 *
 * Check which voices have registered MiniMax clones stored in api_keys.
 */
router.get('/voices/clone-status', (0, adminAuth_1.requirePermission)('system', 'read'), async (c) => {
    try {
        const { getCustomVoices } = await Promise.resolve().then(() => __importStar(require('../config/voices')));
        const sb = (0, supabaseClient_1.createSupabaseServiceClient)();
        if (!sb)
            return c.json({ error: 'Supabase not configured' }, 500);
        const voices = getCustomVoices();
        const keyNames = voices.map(v => `minimax_clone_${v.id}`);
        const { data: keys } = await sb
            .from('api_keys')
            .select('service, token, updated_at')
            .in('service', keyNames);
        const keyMap = new Map((keys || []).map((k) => [k.service, k]));
        const status = voices.map(v => ({
            voiceId: v.id,
            displayName: v.displayName,
            registered: keyMap.has(`minimax_clone_${v.id}`),
            minimaxClonedVoiceId: keyMap.get(`minimax_clone_${v.id}`)?.token || null,
            registeredAt: keyMap.get(`minimax_clone_${v.id}`)?.updated_at || null,
        }));
        return c.json({ voices: status });
    }
    catch (err) {
        return c.json({ error: err.message }, 500);
    }
});
exports.default = router;
//# sourceMappingURL=admin.js.map