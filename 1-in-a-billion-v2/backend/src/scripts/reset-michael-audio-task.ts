/**
 * RESET MICHAEL HUMAN DESIGN AUDIO TASK
 * Task is stuck - reset it to pending
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
  
  console.log(`🔄 Finding and resetting stuck audio task for job ${jobId.substring(0, 8)}...\n`);

  // Find the stuck audio task
  const { data: tasks, error: fetchError } = await supabase
    .from('job_tasks')
    .select('id, status, error, attempts, max_attempts, worker_id, task_type')
    .eq('job_id', jobId)
    .eq('task_type', 'audio_generation')
    .eq('status', 'processing');

  if (fetchError) {
    console.error('❌ Failed to fetch tasks:', fetchError?.message);
    process.exit(1);
  }

  if (!tasks || tasks.length === 0) {
    console.log('❌ No stuck audio tasks found');
    process.exit(0);
  }

  for (const task of tasks) {
    console.log(`📋 Task ${task.id.substring(0, 8)}:`);
    console.log(`   Status: ${task.status}`);
    console.log(`   Worker: ${task.worker_id || 'NONE'}`);
    console.log(`   Attempts: ${task.attempts}/${task.max_attempts}`);
    console.log(`   Error: ${task.error?.substring(0, 150) || 'NONE'}`);

    // Reset to pending
    const { error: updateError } = await supabase
      .from('job_tasks')
      .update({
        status: 'pending',
        error: null,
        worker_id: null,
        claimed_at: null,
        last_heartbeat: null,
        attempts: 0, // Reset attempts
        updated_at: new Date().toISOString(),
      })
      .eq('id', task.id);

    if (updateError) {
      console.error(`   ❌ Failed to reset: ${updateError.message}`);
    } else {
      console.log(`   ✅ Reset to pending - will be picked up by audio worker`);
    }
  }

  console.log(`\n✅ Done - task(s) reset\n`);
}

main().catch(err => {
  console.error('❌ Script failed:', err);
  process.exit(1);
});
