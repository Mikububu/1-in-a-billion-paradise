/**
 * WATCHDOG WORKER - Reclaim Stale Tasks & Send Notifications
 * 
 * Runs every 5 minutes to:
 * 1. Reclaim stale tasks (unstick zombie tasks)
 * 2. Send notifications for newly completed jobs
 */

import { supabase } from '../services/supabaseClient';
import { notifyJobComplete } from '../services/notificationService';

const INTERVAL_MS = 60 * 1000; // 1 minute

async function reclaimStaleTasks() {
  if (!supabase) {
    console.error('❌ Supabase not configured');
    return;
  }

  try {
    const { data, error } = await supabase.rpc('reclaim_stale_tasks');

    if (error) {
      console.error('❌ Failed to reclaim stale tasks:', error.message);
      return;
    }

    const reclaimed = data as number;
    if (reclaimed > 0) {
      console.log(`♻️  Reclaimed ${reclaimed} stale task(s)`);
    } else {
      console.log(`✅ No stale tasks found`);
    }
  } catch (err: any) {
    console.error('❌ Exception in watchdog:', err.message);
  }
}

/**
 * Check for completed jobs that have pending notifications
 */
async function sendPendingNotifications() {
  if (!supabase) return;

  try {
    // Find jobs that completed recently and have unsent notifications
    const { data: pendingJobs, error } = await supabase
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
    const uniqueJobIds: string[] = Array.from(new Set(pendingJobs.map((p: any) => String(p.job_id))));

    for (const jobId of uniqueJobIds) {
      const jobData = pendingJobs.find((p: any) => p.job_id === jobId);
      const job = (jobData as any)?.jobs;
      
      if (!job) continue;

      const personName = job.params?.person1?.name;
      const systemName = job.params?.systems?.[0];
      
      await notifyJobComplete(jobId, {
        personName,
        systemName,
        type: job.type,
      });
    }
  } catch (err: any) {
    console.error('❌ Exception checking notifications:', err.message);
  }
}

async function start() {
  console.log('👁️  Watchdog Worker started');
  console.log(`   Interval: ${INTERVAL_MS / 1000}s`);

  // Run immediately on start
  await reclaimStaleTasks();
  await sendPendingNotifications();

  // Then run every 5 minutes
  setInterval(async () => {
    await reclaimStaleTasks();
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

export { start as startWatchdog };
