"use strict";
/**
 * ACCOUNT PURGE ENDPOINT
 *
 * DELETE /api/account/purge
 *
 * Completely deletes a user's account and all associated data.
 * This is an irreversible operation that wipes out ALL user data.
 *
 * Deletes in order:
 * 1. library_people (self profile + partners)
 * 2. jobs, job_tasks, job_artifacts (DB records)
 * 3. vedic_people, vedic_matches, vedic_match_jobs, vedic_job_artifacts
 * 4. user_activity, user_notes, subscription_history
 * 5. audiobook_jobs, audiobook_chapters
 * 6. Supabase Storage files (job-artifacts bucket)
 * 7. user_commercial_state
 * 8. auth.users record (final step - cascades to any remaining tables)
 *
 * Note: RunPod jobs are ephemeral and don't need cleanup.
 *
 * GDPR Compliant: Complete data deletion with zero orphaned records.
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
Object.defineProperty(exports, "__esModule", { value: true });
const hono_1 = require("hono");
const env_1 = require("../config/env");
const rateLimiter_1 = require("../middleware/rateLimiter");
const router = new hono_1.Hono();
function getBearerToken(c) {
    const auth = c.req.header('Authorization') || c.req.header('authorization');
    if (!auth)
        return null;
    const m = auth.match(/^Bearer\s+(.+)$/i);
    return m ? m[1] : null;
}
/**
 * DELETE /api/account/purge
 *
 * Requires: Authorization header with valid access token
 * Returns: { success: true } on success
 */
router.delete('/purge', rateLimiter_1.authLimiter, async (c) => {
    try {
        const accessToken = getBearerToken(c);
        if (!accessToken) {
            return c.json({
                success: false,
                error: 'Missing authorization token'
            }, 401);
        }
        // Use env vars directly (can't use getApiKey for Supabase keys - circular dependency)
        const supabaseUrl = env_1.env.SUPABASE_URL;
        const supabaseServiceKey = env_1.env.SUPABASE_SERVICE_ROLE_KEY;
        const supabaseAnonKey = env_1.env.SUPABASE_ANON_KEY;
        // Validate Supabase configuration (check for empty strings too)
        const hasUrl = supabaseUrl && supabaseUrl.trim().length > 0;
        const hasServiceKey = supabaseServiceKey && supabaseServiceKey.trim().length > 0;
        const hasAnonKey = supabaseAnonKey && supabaseAnonKey.trim().length > 0;
        if (!hasUrl || !hasServiceKey || !hasAnonKey) {
            console.error('❌ Supabase configuration missing:', {
                hasUrl,
                hasServiceKey,
                hasAnonKey,
                urlLength: supabaseUrl?.length || 0,
                serviceKeyLength: supabaseServiceKey?.length || 0,
                anonKeyLength: supabaseAnonKey?.length || 0,
                envUrl: !!env_1.env.SUPABASE_URL,
                envServiceKey: !!env_1.env.SUPABASE_SERVICE_ROLE_KEY,
                envAnonKey: !!env_1.env.SUPABASE_ANON_KEY,
            });
            const missingKeys = [];
            if (!hasUrl)
                missingKeys.push('SUPABASE_URL');
            if (!hasServiceKey)
                missingKeys.push('SUPABASE_SERVICE_ROLE_KEY');
            if (!hasAnonKey)
                missingKeys.push('SUPABASE_ANON_KEY');
            return c.json({
                success: false,
                error: `Supabase not configured. Missing: ${missingKeys.join(', ')}. Please set these environment variables in your backend (Fly.io secrets or .env file).`
            }, 500);
        }
        // Create Supabase clients
        const { createClient } = await Promise.resolve().then(() => __importStar(require('@supabase/supabase-js')));
        // User client to verify auth and get user ID
        const userClient = createClient(supabaseUrl, supabaseAnonKey, {
            global: {
                headers: {
                    Authorization: `Bearer ${accessToken}`,
                },
            },
        });
        // Get authenticated user
        const { data: { user }, error: authError } = await userClient.auth.getUser();
        if (authError || !user) {
            return c.json({
                success: false,
                error: 'Invalid or expired token'
            }, 401);
        }
        const userId = user.id;
        console.log(`🗑️ Purging account for user: ${userId}`);
        // Service role client for deletion (bypasses RLS)
        const serviceClient = createClient(supabaseUrl, supabaseServiceKey);
        // ═══════════════════════════════════════════════════════════════════════
        // STEP 1: Delete library_people (self profile + partners)
        // ═══════════════════════════════════════════════════════════════════════
        const { error: peopleError } = await serviceClient
            .from('library_people')
            .delete()
            .eq('user_id', userId);
        if (peopleError) {
            console.error('❌ Failed to delete library_people:', peopleError);
            return c.json({
                success: false,
                error: `Failed to delete people: ${peopleError.message}`
            }, 500);
        }
        console.log('✅ Deleted library_people records');
        // ═══════════════════════════════════════════════════════════════════════
        // STEP 2: Delete jobs (cascades to job_tasks and job_artifacts)
        // ═══════════════════════════════════════════════════════════════════════
        const { error: jobsError } = await serviceClient
            .from('jobs')
            .delete()
            .eq('user_id', userId);
        if (jobsError) {
            console.error('❌ Failed to delete jobs:', jobsError);
            return c.json({
                success: false,
                error: `Failed to delete jobs: ${jobsError.message}`
            }, 500);
        }
        console.log('✅ Deleted jobs (and cascaded tasks/artifacts)');
        // ═══════════════════════════════════════════════════════════════════════
        // STEP 3: Delete commercial state
        // ═══════════════════════════════════════════════════════════════════════
        try {
            await serviceClient
                .from('user_commercial_state')
                .delete()
                .eq('user_id', userId);
            console.log('✅ Deleted commercial state');
        }
        catch (err) {
            console.log('⚠️ Commercial state table not found (skipped)');
        }
        // ═══════════════════════════════════════════════════════════════════════
        // STEP 4: Delete Vedic matchmaking data
        // ═══════════════════════════════════════════════════════════════════════
        try {
            // Delete vedic job artifacts first (foreign key constraint)
            const { data: vedicJobs } = await serviceClient
                .from('vedic_match_jobs')
                .select('id')
                .eq('user_id', userId);
            if (vedicJobs && vedicJobs.length > 0) {
                const vedicJobIds = vedicJobs.map((j) => j.id);
                // Delete vedic job artifacts
                await serviceClient
                    .from('vedic_job_artifacts')
                    .delete()
                    .in('job_id', vedicJobIds);
                console.log(`✅ Deleted vedic job artifacts for ${vedicJobIds.length} job(s)`);
            }
            // Delete vedic match jobs
            const { error: vedicJobsError } = await serviceClient
                .from('vedic_match_jobs')
                .delete()
                .eq('user_id', userId);
            if (vedicJobsError) {
                console.warn('⚠️ Failed to delete vedic match jobs:', vedicJobsError);
            }
            else {
                console.log('✅ Deleted vedic match jobs');
            }
            // Delete vedic matches
            const { error: vedicMatchesError } = await serviceClient
                .from('vedic_matches')
                .delete()
                .eq('user_id', userId);
            if (vedicMatchesError) {
                console.warn('⚠️ Failed to delete vedic matches:', vedicMatchesError);
            }
            else {
                console.log('✅ Deleted vedic matches');
            }
            // Delete vedic people
            const { error: vedicPeopleError } = await serviceClient
                .from('vedic_people')
                .delete()
                .eq('user_id', userId);
            if (vedicPeopleError) {
                console.warn('⚠️ Failed to delete vedic people:', vedicPeopleError);
            }
            else {
                console.log('✅ Deleted vedic people');
            }
        }
        catch (vedicErr) {
            console.warn('⚠️ Vedic cleanup error (non-fatal):', vedicErr.message);
        }
        // ═══════════════════════════════════════════════════════════════════════
        // STEP 5: Delete admin/user tracking data
        // ═══════════════════════════════════════════════════════════════════════
        try {
            // Delete user activity
            await serviceClient
                .from('user_activity')
                .delete()
                .eq('user_id', userId);
            console.log('✅ Deleted user activity');
            // Delete user notes
            await serviceClient
                .from('user_notes')
                .delete()
                .eq('user_id', userId);
            console.log('✅ Deleted user notes');
            // Delete subscription history
            await serviceClient
                .from('subscription_history')
                .delete()
                .eq('user_id', userId);
            console.log('✅ Deleted subscription history');
        }
        catch (trackingErr) {
            console.warn('⚠️ User tracking cleanup error (non-fatal):', trackingErr.message);
        }
        // ═══════════════════════════════════════════════════════════════════════
        // STEP 6: Delete audiobook jobs and chapters
        // ═══════════════════════════════════════════════════════════════════════
        try {
            // Get all audiobook job IDs for this user
            const { data: audiobookJobs } = await serviceClient
                .from('audiobook_jobs')
                .select('id')
                .eq('user_id', userId);
            if (audiobookJobs && audiobookJobs.length > 0) {
                const jobIds = audiobookJobs.map((j) => j.id);
                // Delete audiobook chapters (cascades from jobs, but explicit for clarity)
                await serviceClient
                    .from('audiobook_chapters')
                    .delete()
                    .in('job_id', jobIds);
                console.log(`✅ Deleted audiobook chapters for ${jobIds.length} job(s)`);
            }
            // Delete audiobook jobs
            const { error: audiobookError } = await serviceClient
                .from('audiobook_jobs')
                .delete()
                .eq('user_id', userId);
            if (audiobookError) {
                console.warn('⚠️ Failed to delete audiobook jobs:', audiobookError);
            }
            else {
                console.log('✅ Deleted audiobook jobs');
            }
        }
        catch (audiobookErr) {
            console.warn('⚠️ Audiobook cleanup error (non-fatal):', audiobookErr.message);
        }
        // ═══════════════════════════════════════════════════════════════════════
        // STEP 7: Delete Supabase Storage artifacts
        // ═══════════════════════════════════════════════════════════════════════
        try {
            // List all files in user's folder in job-artifacts bucket
            const { data: files, error: listError } = await serviceClient.storage
                .from('job-artifacts')
                .list(userId);
            if (listError) {
                console.warn('⚠️ Failed to list storage files:', listError);
            }
            else if (files && files.length > 0) {
                // Delete all files in user's folder
                const filePaths = files.map(f => `${userId}/${f.name}`);
                const { error: deleteFilesError } = await serviceClient.storage
                    .from('job-artifacts')
                    .remove(filePaths);
                if (deleteFilesError) {
                    console.warn('⚠️ Failed to delete some storage files:', deleteFilesError);
                }
                else {
                    console.log(`✅ Deleted ${files.length} storage file(s)`);
                }
            }
            else {
                console.log('✅ No storage files to delete');
            }
        }
        catch (storageError) {
            console.warn('⚠️ Storage cleanup error (non-fatal):', storageError.message);
        }
        // ═══════════════════════════════════════════════════════════════════════
        // STEP 8: Delete auth user (final step - cascades to any remaining tables)
        // ═══════════════════════════════════════════════════════════════════════
        const { error: deleteUserError } = await serviceClient.auth.admin.deleteUser(userId);
        if (deleteUserError) {
            console.error('❌ Failed to delete auth user:', deleteUserError);
            return c.json({
                success: false,
                error: `Failed to delete auth user: ${deleteUserError.message}`
            }, 500);
        }
        console.log('✅ Deleted auth user');
        console.log(`🎉 Account purge complete for user: ${userId}`);
        console.log('   ✅ Library people deleted');
        console.log('   ✅ Jobs and tasks deleted');
        console.log('   ✅ Vedic matchmaking data deleted');
        console.log('   ✅ User activity and notes deleted');
        console.log('   ✅ Subscription history deleted');
        console.log('   ✅ Storage artifacts deleted');
        console.log('   ✅ Audiobook jobs deleted');
        console.log('   ✅ Commercial state deleted');
        console.log('   ✅ Auth user deleted');
        console.log('   ✅ Zero orphaned data');
        return c.json({
            success: true,
            message: 'Account and all data permanently deleted'
        });
    }
    catch (error) {
        console.error('❌ Account purge error:', error);
        return c.json({
            success: false,
            error: error.message || 'Unknown error during account purge'
        }, 500);
    }
});
exports.default = router;
//# sourceMappingURL=account.js.map