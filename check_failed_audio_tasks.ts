import { createSupabaseServiceClient } from './src/services/supabaseClient';
import { config } from 'dotenv';
import { join } from 'path';

config({ path: join(__dirname, '.env') });

const supabase = createSupabaseServiceClient();

if (!supabase) {
  console.error('❌ Supabase not configured');
  process.exit(1);
}

async function checkFailedAudioTasks() {
  console.log('🔍 Checking failed audio generation tasks...\n');

  // Get failed audio tasks from recent jobs
  const { data: failedTasks, error: tasksError } = await supabase
    .from('job_tasks')
    .select('id, job_id, task_type, status, error, created_at, completed_at, input')
    .eq('task_type', 'audio_generation')
    .eq('status', 'failed')
    .order('created_at', { ascending: false })
    .limit(10);

  if (tasksError) {
    console.error('❌ Error fetching tasks:', tasksError);
    return;
  }

  if (!failedTasks || failedTasks.length === 0) {
    console.log('✅ No failed audio tasks found');
    return;
  }

  console.log(`📊 Found ${failedTasks.length} failed audio tasks:\n`);

  for (const task of failedTasks) {
    console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
    console.log(`Task ID: ${task.id}`);
    console.log(`Job ID: ${task.job_id}`);
    console.log(`Created: ${task.created_at}`);
    console.log(`Failed: ${task.completed_at || 'N/A'}`);
    console.log(`\nError Message:`);
    console.log(`  ${task.error || 'No error message'}`);
    
    if (task.input) {
      const input = task.input as any;
      console.log(`\nTask Input:`);
      console.log(`  docNum: ${input.docNum || 'N/A'}`);
      console.log(`  system: ${input.system || 'N/A'}`);
      console.log(`  textLength: ${input.text?.length || 'N/A'} chars`);
    }
  }

  console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);
}

checkFailedAudioTasks().catch(err => {
  console.error('❌ Fatal error:', err);
  process.exit(1);
});
