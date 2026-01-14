import { config } from 'dotenv';
import { resolve } from 'path';
config({ path: resolve(__dirname, '.env') });

import { createClient } from '@supabase/supabase-js';

const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

async function checkFunctions() {
  console.log('🔍 Checking Supabase functions...\n');
  
  // Try to call reclaim_stale_tasks
  console.log('1. Testing reclaim_stale_tasks()...');
  const { data: reclaimData, error: reclaimError } = await supabase.rpc('reclaim_stale_tasks');
  if (reclaimError) {
    console.log(`   ❌ reclaim_stale_tasks NOT FOUND`);
    console.log(`   Error: ${reclaimError.message}`);
  } else {
    console.log(`   ✅ reclaim_stale_tasks EXISTS - Reclaimed ${reclaimData} tasks`);
  }
  
  // Try to call claim_tasks
  console.log('\n2. Testing claim_tasks()...');
  const { data: claimData, error: claimError } = await supabase.rpc('claim_tasks', {
    p_worker_id: 'test-worker',
    p_max_tasks: 1,
    p_task_types: ['text_generation']
  });
  if (claimError) {
    console.log(`   ❌ claim_tasks NOT FOUND`);
    console.log(`   Error: ${claimError.message}`);
  } else {
    console.log(`   ✅ claim_tasks EXISTS - Claimed ${claimData?.length || 0} tasks`);
  }
  
  // Check if tables exist
  console.log('\n3. Checking tables...');
  const tables = ['jobs', 'job_tasks', 'job_artifacts'];
  for (const table of tables) {
    const { error } = await supabase.from(table).select('id').limit(1);
    if (error) {
      console.log(`   ❌ ${table} table NOT FOUND`);
    } else {
      console.log(`   ✅ ${table} table EXISTS`);
    }
  }
}

checkFunctions().then(() => process.exit(0)).catch((e) => {
  console.error(e);
  process.exit(1);
});
