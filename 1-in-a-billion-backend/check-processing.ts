import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';
config();

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function checkProcessing() {
  const { data: jobs } = await supabase.from('jobs').select('id').order('created_at', { ascending: false }).limit(1);
  const jobId = jobs?.[0]?.id;

  const { data: processing } = await supabase
    .from('job_tasks')
    .select('task_type, started_at')
    .eq('job_id', jobId)
    .eq('status', 'processing');

  console.log(`\n⏳ Currently processing (${processing?.length || 0}):\n`);
  processing?.forEach(t => {
    const elapsed = Math.floor((Date.now() - new Date(t.started_at).getTime()) / 60000);
    console.log(`  ${t.task_type} (running for ${elapsed} min)`);
  });
}

checkProcessing().catch(console.error);
