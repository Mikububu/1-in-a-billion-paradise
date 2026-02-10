import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';
config();

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function resetJob() {
  // Find Akasha & Anand job
  const { data: jobs, error: jobError } = await supabase
    .from('jobs')
    .select('*')
    .ilike('job_name', '%Akasha%Anand%')
    .order('created_at', { ascending: false })
    .limit(1);

  if (jobError || !jobs || jobs.length === 0) {
    console.error('❌ Could not find Akasha & Anand job:', jobError);
    process.exit(1);
  }

  const job = jobs[0];
  console.log(`✅ Found job: ${job.job_name} (${job.id})`);
  console.log(`⏰ Original created: ${job.created_at}`);

  // Reset job status
  const { error: updateError } = await supabase
    .from('jobs')
    .update({ 
      status: 'processing',
      updated_at: new Date().toISOString()
    })
    .eq('id', job.id);

  if (updateError) {
    console.error('❌ Failed to update job:', updateError);
    process.exit(1);
  }

  // Reset all tasks to pending (except completed ones we want to keep)
  const { data: tasks } = await supabase
    .from('job_tasks')
    .select('*')
    .eq('job_id', job.id);

  console.log(`\n📋 Found ${tasks?.length || 0} tasks`);

  // Reset all tasks to pending
  const { error: tasksError } = await supabase
    .from('job_tasks')
    .update({ 
      status: 'pending',
      started_at: null,
      completed_at: null,
      error: null,
      updated_at: new Date().toISOString()
    })
    .eq('job_id', job.id);

  if (tasksError) {
    console.error('❌ Failed to reset tasks:', tasksError);
    process.exit(1);
  }

  console.log('✅ All tasks reset to pending');
  console.log(`\n🚀 Job ready for processing!`);
  console.log(`🆔 Job ID: ${job.id}`);
  console.log(`📁 Output will be saved to: ~/Desktop/output/Akasha_Anand/`);
  console.log(`\n⏱️  Timer started: ${new Date().toISOString()}`);
  
  return job.id;
}

resetJob().catch(console.error);
