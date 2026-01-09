import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

async function checkAllJobs() {
  console.log('🔍 Checking all jobs...\n');
  
  const { data: jobs, error } = await supabase
    .from('jobs')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(10);

  if (error) {
    console.error('❌ Error fetching jobs:', error);
    return;
  }

  if (!jobs || jobs.length === 0) {
    console.log('❌ No jobs found');
    return;
  }

  console.log(`Found ${jobs.length} recent jobs:\n`);
  
  for (const job of jobs) {
    const personName = job.params?.person1?.name || 'Unknown';
    console.log(`📋 Job ${job.id.slice(0, 8)}... (${job.type})`);
    console.log(`   Person: ${personName}`);
    console.log(`   Status: ${job.status}`);
    console.log(`   Created: ${new Date(job.created_at).toLocaleString()}`);
    
    // Check tasks for this job
    const { data: tasks } = await supabase
      .from('job_tasks')
      .select('task_type, status')
      .eq('job_id', job.id);
    
    if (tasks && tasks.length > 0) {
      const taskSummary = tasks.reduce((acc: any, t: any) => {
        if (!acc[t.task_type]) acc[t.task_type] = {};
        acc[t.task_type][t.status] = (acc[t.task_type][t.status] || 0) + 1;
        return acc;
      }, {});
      console.log(`   Tasks:`, JSON.stringify(taskSummary, null, 2));
    } else {
      console.log(`   ⚠️  NO TASKS FOUND FOR THIS JOB`);
    }
    console.log('');
  }
}

checkAllJobs().then(() => process.exit(0)).catch((e) => {
  console.error(e);
  process.exit(1);
});
