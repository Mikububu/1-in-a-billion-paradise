/**
 * WATCHDOG WORKER - Reclaim Stale Tasks
 * 
 * Runs reclaim_stale_tasks() every 5 minutes to unstick zombie tasks.
 * This prevents tasks from being stuck forever when workers crash.
 */

import { supabase } from '../services/supabaseClient';

const INTERVAL_MS = 5 * 60 * 1000; // 5 minutes

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

async function start() {
  console.log('👁️  Watchdog Worker started');
  console.log(`   Interval: ${INTERVAL_MS / 1000}s`);

  // Run immediately on start
  await reclaimStaleTasks();

  // Then run every 5 minutes
  setInterval(reclaimStaleTasks, INTERVAL_MS);
}

// Start if run directly
if (require.main === module) {
  start().catch((err) => {
    console.error('💀 Watchdog worker failed:', err);
    process.exit(1);
  });
}

export { start as startWatchdog };
