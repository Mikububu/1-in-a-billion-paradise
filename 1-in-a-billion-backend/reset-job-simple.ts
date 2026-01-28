import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';
config();

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function resetJob() {
  // Find most recent Akasha & Anand job
  const { data: jobs, error: jobError } = await supabase
    .from('jobs')
    .select('*')
    .eq('type', 'nuclear_v2')
    .order('created_at', { ascending: false })
    .limit(5);

  if (jobError || !jobs) {
    console.error('❌ Error:', jobError);
    process.exit(1);
  }

  console.log(`\n📋 Found ${jobs.length} recent nuclear jobs:`);
  jobs.forEach((j, i) => {
    console.log(`${i + 1}. ${j.id} - ${j.status} - ${j.created_at}`);
  });

  const job = jobs[0];
  console.log(`\n✅ Using most recent job: ${job.id}`);
  console.log(`⏰ Created: ${job.created_at}`);
  console.log(`📊 Status: ${job.status}`);

  // Reset all tasks
  const { data: tasks } = await supabase
    .from('job_tasks')
    .select('id, task_type, status')
    .eq('job_id', job.id);

  console.log(`\n📋 Tasks (${tasks?.length || 0}):`);
  tasks?.forEach(t => console.log(`  - ${t.task_type}: ${t.status}`));

  // Reset everything
  const { error: resetError } = await supabase
    .from('job_tasks')
    .update({ 
      status: 'pending',
      started_at: null,
      completed_at: null,
      error: null,
      updated_at: new Date().toISOString()
    })
    .eq('job_id', job.id);

  if (resetError) {
    console.error('❌ Reset failed:', resetError);
    process.exit(1);
  }

  await supabase
    .from('jobs')
    .update({ 
      status: 'processing',
      updated_at: new Date().toISOString()
    })
    .eq('id', job.id);

  console.log('\n✅ Job reset complete!');
  console.log(`🆔 Job ID: ${job.id}`);
  console.log(`⏱️  Timer started: ${new Date().toISOString()}`);
  console.log(`\n📊 Monitor: tail -f /tmp/auto-download.log`);
}

resetJob().catch(console.error);
