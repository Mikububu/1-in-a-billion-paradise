import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  throw new Error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set in .env');
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkRecentJobs() {
  // Get user ID from auth.users
  const { data: { users }, error: userError } = await supabase.auth.admin.listUsers();

  if (userError || !users) {
    console.error('❌ Error listing users:', userError);
    return;
  }

  const user = users.find((u: any) => u.email === 'cooltantra@gmail.com');
  if (!user) {
    console.error('❌ User cooltantra@gmail.com not found');
    return;
  }

  const userId = user.id;
  console.log(`✅ Found user: ${userId}\n`);

  // Get recent jobs
  const { data: jobs, error: jobsError } = await supabase
    .from('jobs')
    .select('id, type, status, created_at, updated_at, error')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(10);

  if (jobsError) {
    console.error('❌ Error fetching jobs:', jobsError);
    return;
  }

  console.log(`📋 Recent ${jobs?.length || 0} jobs:\n`);

  // Focus on the failed synastry job
  const failedJob = jobs?.find((j: any) => j.id === 'f5e55743-1ed4-4910-b7a1-9bb5fff57e76');
  let jobsToAnalyze = jobs;
  if (failedJob) {
    console.log('🔍 ANALYZING FAILED JOB:\n');
    jobsToAnalyze = [failedJob];
  }

  for (const job of jobsToAnalyze || []) {
    console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
    console.log(`Job ID: ${job.id}`);
    console.log(`Type: ${job.type}`);
    console.log(`Status: ${job.status}`);
    console.log(`Created: ${new Date(job.created_at).toLocaleString()}`);
    console.log(`Updated: ${new Date(job.updated_at).toLocaleString()}`);
    
    if (job.error) {
      console.log(`❌ Error: ${job.error}`);
    }

    // Get job tasks for this job
    const { data: tasks, error: tasksError } = await supabase
      .from('job_tasks')
      .select('id, type, status, created_at, updated_at, error, output')
      .eq('job_id', job.id)
      .order('created_at', { ascending: true });

    if (!tasksError && tasks && tasks.length > 0) {
      console.log(`\n📝 Tasks (${tasks.length}):`);
      for (const task of tasks) {
        console.log(`  - ${task.type}: ${task.status}${task.error ? ` (${task.error})` : ''}`);
      }
    }

    // Get artifacts for this job
    const { data: artifacts, error: artifactsError } = await supabase
      .from('job_artifacts')
      .select('id, type, status, created_at')
      .eq('job_id', job.id)
      .order('created_at', { ascending: true });

    if (!artifactsError && artifacts && artifacts.length > 0) {
      console.log(`\n📦 Artifacts (${artifacts.length}):`);
      for (const artifact of artifacts) {
        console.log(`  - ${artifact.type}: ${artifact.status}`);
      }
    }

    console.log('');
  }
}

checkRecentJobs().catch(console.error);
