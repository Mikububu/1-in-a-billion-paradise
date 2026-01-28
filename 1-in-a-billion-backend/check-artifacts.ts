import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';
config();

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function checkArtifacts() {
  const { data: jobs } = await supabase
    .from('jobs')
    .select('id')
    .order('created_at', { ascending: false })
    .limit(1);

  const jobId = jobs?.[0]?.id;
  if (!jobId) return;

  const { data: tasks } = await supabase
    .from('job_tasks')
    .select('task_type, status, output')
    .eq('job_id', jobId)
    .eq('status', 'complete');

  console.log(`\n✅ Completed tasks (${tasks?.length || 0}):\n`);
  
  tasks?.forEach(task => {
    console.log(`${task.task_type}:`);
    const output = task.output as any;
    if (output?.textArtifactPath) console.log(`  📄 Text: ${output.textArtifactPath}`);
    if (output?.pdfArtifactPath) console.log(`  📕 PDF: ${output.pdfArtifactPath}`);
    if (output?.audioArtifactPath) console.log(`  🎵 Audio: ${output.audioArtifactPath}`);
    console.log('');
  });
}

checkArtifacts().catch(console.error);
