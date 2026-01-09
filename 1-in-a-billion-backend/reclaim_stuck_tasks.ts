import { config } from 'dotenv';
import { resolve } from 'path';
config({ path: resolve(__dirname, '.env') });

import { createClient } from '@supabase/supabase-js';

const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

async function reclaimTasks() {
  console.log('🔄 Manually resetting stuck tasks...\n');
  
  // First, let's see what's stuck
  const { data: stuckTasks } = await supabase
    .from('job_tasks')
    .select('id, task_type, status, claimed_at, last_heartbeat, heartbeat_timeout_seconds')
    .eq('status', 'processing');

  if (stuckTasks && stuckTasks.length > 0) {
    console.log(`Found ${stuckTasks.length} stuck tasks:\n`);
    for (const t of stuckTasks) {
      const claimedAgo = t.claimed_at ? Math.floor((Date.now() - new Date(t.claimed_at).getTime()) / 1000 / 60) : 0;
      console.log(`  ${t.id.slice(0,8)}... ${t.task_type} - claimed ${claimedAgo}m ago, last_heartbeat: ${t.last_heartbeat || 'NULL'}`);
    }
    console.log('');
  }

  // Call the reclaim function
  const { data, error } = await supabase.rpc('reclaim_stale_tasks');

  if (error) {
    console.error('❌ Error calling reclaim_stale_tasks:', error);
    return;
  }

  console.log(`✅ Reclaimed ${data} tasks`);

  // Now manually reset any tasks with NULL last_heartbeat that are > 10 min old
  const { data: resetData, error: resetError } = await supabase
    .from('job_tasks')
    .update({ 
      status: 'pending',
      worker_id: null,
      last_heartbeat: null,
      claimed_at: null
    })
    .eq('status', 'processing')
    .is('last_heartbeat', null)
    .lt('claimed_at', new Date(Date.now() - 10 * 60 * 1000).toISOString())
    .select();

  if (resetError) {
    console.error('❌ Manual reset error:', resetError);
  } else {
    console.log(`✅ Manually reset ${resetData?.length || 0} tasks with NULL heartbeat`);
  }
}

reclaimTasks().then(() => process.exit(0)).catch((e) => {
  console.error(e);
  process.exit(1);
});
