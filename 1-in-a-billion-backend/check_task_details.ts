import { config } from 'dotenv';
import { resolve } from 'path';
config({ path: resolve(__dirname, '.env') });

import { createClient } from '@supabase/supabase-js';

const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

async function checkTasks() {
  // Get Akasha's job
  const { data: jobs } = await supabase
    .from('jobs')
    .select('*')
    .ilike('params->>person1->>name', '%Akasha%')
    .order('created_at', { ascending: false })
    .limit(1);

  if (!jobs || jobs.length === 0) {
    console.log('❌ No jobs found for Akasha');
    return;
  }

  const job = jobs[0];
  console.log(`📋 Akasha's Job: ${job.id}`);
  console.log(`   Status: ${job.status}`);
  console.log(`   Created: ${new Date(job.created_at).toLocaleString()}`);
  console.log(`   Type: ${job.type}\n`);

  // Get all tasks for this job
  const { data: tasks } = await supabase
    .from('job_tasks')
    .select('*')
    .eq('job_id', job.id)
    .order('sequence');

  if (!tasks || tasks.length === 0) {
    console.log('⚠️ NO TASKS FOUND');
    return;
  }

  console.log(`Found ${tasks.length} tasks:\n`);
  for (const task of tasks) {
    console.log(`Task ${task.sequence}: ${task.task_type}`);
    console.log(`  Status: ${task.status}`);
    console.log(`  Worker: ${task.worker_id || 'none'}`);
    console.log(`  Claimed: ${task.claimed_at ? new Date(task.claimed_at).toLocaleString() : 'never'}`);
    console.log(`  Completed: ${task.completed_at ? new Date(task.completed_at).toLocaleString() : 'not yet'}`);
    console.log(`  Attempts: ${task.attempts}/${task.max_attempts}`);
    if (task.error_message) {
      console.log(`  Error: ${task.error_message}`);
    }
    console.log('');
  }
}

checkTasks().then(() => process.exit(0)).catch((e) => {
  console.error(e);
  process.exit(1);
});
