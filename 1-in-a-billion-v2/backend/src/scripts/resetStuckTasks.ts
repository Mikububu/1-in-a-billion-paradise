/**
 * Reset stuck tasks to pending so workers can pick them up
 */

import { createSupabaseServiceClient } from '../services/supabaseClient';
import { config } from 'dotenv';
import { join } from 'path';

config({ path: join(__dirname, '../../.env') });

async function resetStuckTasks() {
  const supabase = createSupabaseServiceClient();
  
  if (!supabase) {
    console.error('❌ Supabase not configured');
    process.exit(1);
  }

  console.log('🔧 Resetting stuck tasks...\n');

  // Find stuck tasks (processing for > 10 minutes)
  const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000).toISOString();

  const { data: stuckTasks, error: fetchError } = await supabase
    .from('job_tasks')
    .select('*')
    .eq('status', 'processing')
    .lt('updated_at', tenMinutesAgo);

  if (fetchError) {
    console.error('❌ Error fetching stuck tasks:', fetchError);
    process.exit(1);
  }

  if (!stuckTasks || stuckTasks.length === 0) {
    console.log('✅ No stuck tasks found!');
    return;
  }

  console.log(`📊 Found ${stuckTasks.length} stuck tasks\n`);

  // Reset each stuck task
  for (const task of stuckTasks) {
    console.log(`🔄 Resetting ${task.task_type} (${task.id.substring(0, 8)}...)`);
    
    const { error: updateError } = await supabase
      .from('job_tasks')
      .update({
        status: 'pending',
        started_at: null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', task.id);

    if (updateError) {
      console.error(`   ❌ Failed to reset task: ${updateError.message}`);
    } else {
      console.log(`   ✅ Reset to pending`);
    }
  }

  console.log(`\n✅ Reset ${stuckTasks.length} tasks to pending`);
  console.log('💡 Now start the workers to process these tasks!');
}

resetStuckTasks().catch(err => {
  console.error('❌ Fatal error:', err);
  process.exit(1);
});
