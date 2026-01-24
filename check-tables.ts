import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';
config();

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function checkTables() {
  const { data: jobs } = await supabase.from('jobs').select('id').order('created_at', { ascending: false }).limit(1);
  const jobId = jobs?.[0]?.id;

  // Check job_artifacts table
  const { data: artifacts } = await supabase
    .from('job_artifacts')
    .select('*')
    .eq('job_id', jobId);

  console.log(`\n📦 job_artifacts table: ${artifacts?.length || 0} rows`);
  if (artifacts && artifacts.length > 0) {
    console.log('Sample:', artifacts[0]);
  }

  // Check job_tasks with PDFs/audio
  const { data: tasks } = await supabase
    .from('job_tasks')
    .select('task_type, status, output')
    .eq('job_id', jobId)
    .eq('status', 'complete')
    .in('task_type', ['pdf_generation', 'audio_generation']);

  console.log(`\n📋 job_tasks (PDF/Audio): ${tasks?.length || 0} complete`);
  tasks?.forEach(t => {
    const out = t.output as any;
    if (out?.pdfArtifactPath) console.log(`  📕 PDF: ${out.pdfArtifactPath}`);
    if (out?.audioArtifactPath) console.log(`  🎵 Audio: ${out.audioArtifactPath}`);
  });
}

checkTables().catch(console.error);
