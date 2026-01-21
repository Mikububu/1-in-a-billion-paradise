import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';
config();

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function checkStatus() {
  const { data: jobs } = await supabase
    .from('jobs')
    .select('id, status, created_at')
    .order('created_at', { ascending: false })
    .limit(1);

  if (!jobs || jobs.length === 0) return;

  const job = jobs[0];
  const { data: tasks } = await supabase
    .from('job_tasks')
    .select('task_type, status')
    .eq('job_id', job.id);

  const pending = tasks?.filter(t => t.status === 'pending').length || 0;
  const processing = tasks?.filter(t => t.status === 'processing').length || 0;
  const complete = tasks?.filter(t => t.status === 'complete').length || 0;
  const failed = tasks?.filter(t => t.status === 'failed').length || 0;

  console.log(`\n📊 Job Status (${job.id.slice(0, 8)})`);
  console.log(`⏰ Created: ${new Date(job.created_at).toLocaleTimeString()}`);
  console.log(`📋 Tasks: ${tasks?.length || 0} total`);
  console.log(`   ✅ Complete: ${complete}`);
  console.log(`   ⏳ Processing: ${processing}`);
  console.log(`   ⏸️  Pending: ${pending}`);
  console.log(`   ❌ Failed: ${failed}`);
  
  const elapsedMin = Math.floor((Date.now() - new Date(job.created_at).getTime()) / 60000);
  console.log(`\n⏱️  Elapsed: ${elapsedMin} minutes`);
}

checkStatus().catch(console.error);
