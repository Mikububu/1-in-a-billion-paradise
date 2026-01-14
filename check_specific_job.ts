import { config } from 'dotenv';
import { resolve } from 'path';
config({ path: resolve(__dirname, '.env') });

import { createClient } from '@supabase/supabase-js';

const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

async function checkJob() {
  // Get the most recent job (should be Akasha's based on previous output)
  const { data: jobs } = await supabase
    .from('jobs')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(6);

  if (!jobs) {
    console.log('❌ No jobs found');
    return;
  }

  console.log('All recent jobs:');
  for (const j of jobs) {
    const name = j.params?.person1?.name || 'Unknown';
    console.log(`  ${j.id.slice(0,8)}... ${name} - ${j.status}`);
  }
  console.log('');

  // Check the last one (Akasha's)
  const job = jobs[jobs.length - 1];
  console.log(`\n📋 Checking Job: ${job.id}`);
  console.log(`   Person: ${job.params?.person1?.name}`);
  console.log(`   Status: ${job.status}`);
  console.log(`   Systems: ${JSON.stringify(job.params?.systems || [])}`);
  console.log(`   Created: ${new Date(job.created_at).toLocaleString()}\n`);

  // Get all tasks
  const { data: tasks } = await supabase
    .from('job_tasks')
    .select('*')
    .eq('job_id', job.id)
    .order('sequence');

  if (!tasks || tasks.length === 0) {
    console.log('⚠️ NO TASKS FOUND FOR THIS JOB');
    return;
  }

  console.log(`Found ${tasks.length} tasks:\n`);
  for (const task of tasks) {
    console.log(`Task ${task.sequence}: ${task.task_type}`);
    console.log(`  Status: ${task.status}`);
    console.log(`  Worker: ${task.worker_id || 'none'}`);
    console.log(`  Claimed: ${task.claimed_at ? new Date(task.claimed_at).toLocaleString() : 'never'}`);
    console.log(`  Heartbeat: ${task.heartbeat_at ? new Date(task.heartbeat_at).toLocaleString() : 'never'}`);
    console.log(`  Attempts: ${task.attempts}/${task.max_attempts}`);
    if (task.error_message) {
      console.log(`  ❌ Error: ${task.error_message}`);
    }
    console.log('');
  }
}

checkJob().then(() => process.exit(0)).catch((e) => {
  console.error(e);
  process.exit(1);
});
