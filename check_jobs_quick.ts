import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

async function checkJobs() {
  // Get recent jobs
  const { data: jobs, error } = await supabase
    .from('jobs')
    .select('id, type, status, created_at')
    .order('created_at', { ascending: false })
    .limit(5);

  if (error) {
    console.error('Error:', error);
    return;
  }

  console.log('\n📦 Recent Jobs:');
  for (const job of jobs || []) {
    console.log(`\nJob ${job.id.substring(0, 8)}... (${job.type})`);
    console.log(`  Status: ${job.status}`);
    console.log(`  Created: ${job.created_at}`);
    
    // Get tasks for this job
    const { data: tasks } = await supabase
      .from('job_tasks')
      .select('task_type, status, attempts, error_message')
      .eq('job_id', job.id)
      .order('sequence');
    
    if (tasks && tasks.length > 0) {
      const pending = tasks.filter(t => t.status === 'pending').length;
      const processing = tasks.filter(t => t.status === 'processing').length;
      const complete = tasks.filter(t => t.status === 'complete').length;
      const failed = tasks.filter(t => t.status === 'failed').length;
      
      console.log(`  Tasks: ${complete}/${tasks.length} complete (${pending} pending, ${processing} processing, ${failed} failed)`);
      
      // Show failed tasks
      const failedTasks = tasks.filter(t => t.status === 'failed');
      if (failedTasks.length > 0) {
        console.log('  ❌ Failed tasks:');
        failedTasks.forEach(t => {
          console.log(`     - ${t.task_type}: ${t.error_message?.substring(0, 80) || 'Unknown error'}`);
        });
      }
      
      // Show pending/processing tasks
      const activeTasks = tasks.filter(t => t.status === 'pending' || t.status === 'processing');
      if (activeTasks.length > 0) {
        console.log('  ⏳ Active tasks:');
        activeTasks.forEach(t => {
          console.log(`     - ${t.task_type} (${t.status}, attempt ${t.attempts})`);
        });
      }
    }
  }
}

checkJobs().catch(console.error);
