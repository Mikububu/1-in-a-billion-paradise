"use strict";
/**
 * WATCHDOG WORKER - Reclaim Stale Tasks, Finalize Stuck Jobs, Send Notifications
 *
 * Runs every 60 seconds to:
 * 1. Reclaim stale tasks (unstick zombie tasks whose workers crashed)
 * 2. Finalize stuck jobs (mark as complete/error when all tasks are done+failed)
 * 3. Send notifications for newly completed jobs
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.startWatchdog = start;
const supabaseClient_1 = require("../services/supabaseClient");
const notificationService_1 = require("../services/notificationService");
const INTERVAL_MS = 60 * 1000; // 60 seconds
async function reclaimStaleTasks() {
    if (!supabaseClient_1.supabase) {
        console.error('❌ Supabase not configured');
        return;
    }
    try {
        const { data, error } = await supabaseClient_1.supabase.rpc('reclaim_stale_tasks');
        if (error) {
            console.error('❌ Failed to reclaim stale tasks:', error.message);
            return;
        }
        const reclaimed = data;
        if (reclaimed > 0) {
            console.log(`♻️  Reclaimed ${reclaimed} stale task(s)`);
        }
    }
    catch (err) {
        console.error('❌ Exception in watchdog reclaim:', err.message);
    }
}
/**
 * Finalize stuck jobs where ALL tasks are terminal (complete/failed/skipped)
 * but the job itself is still in 'processing' state.
 *
 * This fixes the "83% stuck forever" bug:
 *   - 53 tasks complete, 11 tasks failed (hit max_attempts)
 *   - No pending/claimed/processing tasks remain
 *   - Job stays 'processing' because nothing triggers the status transition
 *
 * Logic:
 *   - If ALL tasks are 'complete' → job = 'complete'
 *   - If some tasks are 'failed' but none are pending/claimed/processing → job = 'complete_with_errors'
 *   - This allows the user to see what completed, download PDFs, listen to audio
 */
async function finalizeStuckJobs() {
    if (!supabaseClient_1.supabase)
        return;
    try {
        // Find jobs that are still 'processing' but have NO active tasks left
        const { data: stuckJobs, error } = await supabaseClient_1.supabase
            .from('jobs')
            .select('id')
            .eq('status', 'processing')
            .limit(20);
        if (error) {
            console.warn('⚠️ Could not query stuck jobs:', error.message);
            return;
        }
        if (!stuckJobs || stuckJobs.length === 0)
            return;
        for (const job of stuckJobs) {
            // Count task states for this job
            const { data: taskCounts, error: countErr } = await supabaseClient_1.supabase
                .from('job_tasks')
                .select('status')
                .eq('job_id', job.id);
            if (countErr || !taskCounts || taskCounts.length === 0)
                continue;
            const total = taskCounts.length;
            const complete = taskCounts.filter((t) => t.status === 'complete').length;
            const failed = taskCounts.filter((t) => t.status === 'failed').length;
            const skipped = taskCounts.filter((t) => t.status === 'skipped').length;
            const active = taskCounts.filter((t) => t.status === 'pending' || t.status === 'claimed' || t.status === 'processing').length;
            // Only finalize if NO active tasks remain
            if (active > 0)
                continue;
            const terminal = complete + failed + skipped;
            if (terminal < total)
                continue; // Shouldn't happen, but guard
            if (failed === 0) {
                // All tasks complete - job is fully done
                await supabaseClient_1.supabase
                    .from('jobs')
                    .update({ status: 'complete', updated_at: new Date().toISOString() })
                    .eq('id', job.id);
                console.log(`✅ Finalized job ${job.id}: complete (${complete}/${total} tasks)`);
            }
            else {
                // Some tasks failed - mark as complete_with_errors so user can still
                // access the readings that DID complete (PDFs, audio, text)
                await supabaseClient_1.supabase
                    .from('jobs')
                    .update({
                    status: 'complete',
                    error: `${failed} of ${total} tasks failed after max retries`,
                    updated_at: new Date().toISOString(),
                })
                    .eq('id', job.id);
                console.log(`⚠️ Finalized job ${job.id}: complete with ${failed} failed tasks (${complete}/${total} succeeded)`);
            }
        }
    }
    catch (err) {
        console.error('❌ Exception in finalizeStuckJobs:', err.message);
    }
}
/**
 * Check for completed jobs that have pending notifications
 */
async function sendPendingNotifications() {
    if (!supabaseClient_1.supabase)
        return;
    try {
        // Find jobs that completed recently and have unsent notifications
        const { data: pendingJobs, error } = await supabaseClient_1.supabase
            .from('job_notification_subscriptions')
            .select(`
        job_id,
        jobs!inner(id, status, params, type)
      `)
            .is('notified_at', null)
            .eq('jobs.status', 'complete')
            .limit(10);
        if (error) {
            // Table might not exist yet - that's OK
            if (!error.message.includes('does not exist')) {
                console.warn('⚠️ Could not check pending notifications:', error.message);
            }
            return;
        }
        if (!pendingJobs || pendingJobs.length === 0) {
            return;
        }
        console.log(`🔔 Found ${pendingJobs.length} jobs with pending notifications`);
        // Get unique job IDs
        const uniqueJobIds = Array.from(new Set(pendingJobs.map((p) => String(p.job_id))));
        for (const jobId of uniqueJobIds) {
            const jobData = pendingJobs.find((p) => p.job_id === jobId);
            const job = jobData?.jobs;
            if (!job)
                continue;
            const personName = job.params?.person1?.name;
            const systemName = job.params?.systems?.[0];
            await (0, notificationService_1.notifyJobComplete)(jobId, {
                personName,
                systemName,
                type: job.type,
            });
        }
    }
    catch (err) {
        console.error('❌ Exception checking notifications:', err.message);
    }
}
async function start() {
    console.log('👁️  Watchdog Worker started');
    console.log(`   Interval: ${INTERVAL_MS / 1000}s`);
    // Run immediately on start
    await reclaimStaleTasks();
    await finalizeStuckJobs();
    await sendPendingNotifications();
    // Then run every 60 seconds
    setInterval(async () => {
        await reclaimStaleTasks();
        await finalizeStuckJobs();
        await sendPendingNotifications();
    }, INTERVAL_MS);
}
// Start if run directly
if (require.main === module) {
    start().catch((err) => {
        console.error('💀 Watchdog worker failed:', err);
        process.exit(1);
    });
}
//# sourceMappingURL=watchdogWorker.js.map