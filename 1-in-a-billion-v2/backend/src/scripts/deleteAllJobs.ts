/**
 * Delete ALL jobs (use with caution!)
 */

import { createSupabaseServiceClient } from '../services/supabaseClient';
import { config } from 'dotenv';
import { join } from 'path';

config({ path: join(__dirname, '../../.env') });

async function deleteAllJobs() {
  const supabase = createSupabaseServiceClient();
  
  if (!supabase) {
    console.error('❌ Supabase not configured');
    process.exit(1);
  }

  console.log('🗑️  Deleting ALL jobs...\n');

  // Delete all tasks first
  const { error: deleteTasksError, count: tasksCount } = await supabase
    .from('job_tasks')
    .delete()
    .neq('id', '00000000-0000-0000-0000-000000000000'); // Delete all

  if (deleteTasksError) {
    console.error('❌ Failed to delete tasks:', deleteTasksError);
    process.exit(1);
  }

  console.log(`✅ Deleted ${tasksCount || 'all'} tasks`);

  // Delete all jobs
  const { error: deleteJobsError, count: jobsCount } = await supabase
    .from('jobs')
    .delete()
    .neq('id', '00000000-0000-0000-0000-000000000000'); // Delete all

  if (deleteJobsError) {
    console.error('❌ Failed to delete jobs:', deleteJobsError);
    process.exit(1);
  }

  console.log(`✅ Deleted ${jobsCount || 'all'} jobs`);
  console.log(`\n✅ All jobs cleaned up!`);
}

deleteAllJobs().catch(err => {
  console.error('❌ Fatal error:', err);
  process.exit(1);
});
