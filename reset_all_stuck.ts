import { config } from 'dotenv';
import { resolve } from 'path';
config({ path: resolve(__dirname, '.env') });

import { createClient } from '@supabase/supabase-js';

const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

async function resetAll() {
  console.log('🔄 Resetting ALL stuck tasks to pending...\n');

  const { data, error } = await supabase
    .from('job_tasks')
    .update({ 
      status: 'pending',
      worker_id: null,
      last_heartbeat: null,
      claimed_at: null,
      started_at: null,
      attempts: 0
    })
    .eq('status', 'processing')
    .select('id, task_type');

  if (error) {
    console.error('❌ Error:', error);
    return;
  }

  console.log(`✅ Reset ${data.length} tasks to pending:`);
  for (const t of data) {
    console.log(`  - ${t.id.slice(0,8)}... ${t.task_type}`);
  }

  // Also check job statuses
  console.log('\n📊 Updating job statuses...');
  const { data: jobs } = await supabase
    .from('jobs')
    .update({ status: 'queued' })
    .eq('status', 'processing')
    .select('id');

  console.log(`✅ Reset ${jobs?.length || 0} jobs to queued`);
}

resetAll().then(() => process.exit(0)).catch((e) => {
  console.error(e);
  process.exit(1);
});
