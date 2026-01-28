/**
 * RESET MICHAEL HUMAN DESIGN SONG TASK
 */

import { createSupabaseServiceClient } from '../services/supabaseClient';
import { config } from 'dotenv';
import { join } from 'path';

config({ path: join(__dirname, '../../.env') });

async function main() {
  const supabase = createSupabaseServiceClient();
  if (!supabase) {
    console.error('❌ Supabase not configured');
    process.exit(1);
  }

  const jobId = '9d312971-6802-40e5-8317-7b57e7ac3048';
  
  console.log(`🔄 Resetting failed song task for job ${jobId}...\n`);

  // Find the failed song task
  const { data: tasks, error: tasksError } = await supabase
    .from('job_tasks')
    .select('id, task_type, status, error, attempts, max_attempts')
    .eq('job_id', jobId)
    .eq('task_type', 'song_generation')
    .eq('status', 'failed');

  if (tasksError) {
    console.error('❌ Failed to fetch tasks:', tasksError);
    process.exit(1);
  }

  if (!tasks || tasks.length === 0) {
    console.log('❌ No failed song tasks found');
    process.exit(0);
  }

  for (const task of tasks) {
    console.log(`📋 Task ${task.id.substring(0, 8)}:`);
    console.log(`   Status: ${task.status}`);
    console.log(`   Attempts: ${task.attempts}/${task.max_attempts}`);
    console.log(`   Error: ${task.error?.substring(0, 150)}`);

    if (task.attempts >= task.max_attempts) {
      console.log(`   ⚠️  Max attempts reached - resetting attempts to allow retry`);
    }

    // Reset to pending
    const { error: updateError } = await supabase
      .from('job_tasks')
      .update({
        status: 'pending',
        error: null,
        worker_id: null,
        claimed_at: null,
        last_heartbeat: null,
        attempts: 0, // Reset attempts to allow retry
        updated_at: new Date().toISOString(),
      })
      .eq('id', task.id);

    if (updateError) {
      console.error(`   ❌ Failed to reset: ${updateError.message}`);
    } else {
      console.log(`   ✅ Reset to pending - will be picked up by song worker`);
    }
  }

  console.log('\n✅ Done\n');
}

main().catch(err => {
  console.error('❌ Script failed:', err);
  process.exit(1);
});
