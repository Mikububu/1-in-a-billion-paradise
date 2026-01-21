import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';
config();

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function checkErrors() {
  const { data: jobs } = await supabase.from('jobs').select('id').order('created_at', { ascending: false }).limit(1);
  const jobId = jobs?.[0]?.id;

  const { data: tasks } = await supabase
    .from('job_tasks')
    .select('task_type, status, error, started_at')
    .eq('job_id', jobId)
    .eq('status', 'processing')
    .in('task_type', ['audio_generation', 'song_generation']);

  console.log(`\n🔍 Processing tasks (${tasks?.length || 0}):\n`);
  tasks?.forEach(t => {
    const startTime = t.started_at ? new Date(t.started_at) : null;
    const elapsed = startTime && !isNaN(startTime.getTime()) ? Math.floor((Date.now() - startTime.getTime()) / 60000) : 'unknown';
    console.log(`${t.task_type}:`);
    console.log(`  Started: ${startTime?.toLocaleString() || 'N/A'}`);
    console.log(`  Running for: ${elapsed} min`);
    console.log(`  Error: ${t.error || 'none'}`);
    console.log('');
  });

  // Check failed tasks
  const { data: failed } = await supabase
    .from('job_tasks')
    .select('task_type, error')
    .eq('job_id', jobId)
    .eq('status', 'failed');

  if (failed && failed.length > 0) {
    console.log(`\n❌ Failed tasks (${failed.length}):\n`);
    failed.forEach(t => {
      console.log(`${t.task_type}: ${t.error}`);
    });
  }
}

checkErrors().catch(console.error);
