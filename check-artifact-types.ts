import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';
config();

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function checkTypes() {
  const { data: jobs } = await supabase.from('jobs').select('id').order('created_at', { ascending: false }).limit(1);
  const jobId = jobs?.[0]?.id;

  const { data } = await supabase
    .from('job_artifacts')
    .select('artifact_type')
    .eq('job_id', jobId);

  const types = data?.reduce((acc: any, row) => {
    acc[row.artifact_type] = (acc[row.artifact_type] || 0) + 1;
    return acc;
  }, {});

  console.log('\n📊 Artifact types in job_artifacts:');
  Object.entries(types || {}).forEach(([type, count]) => {
    console.log(`  ${type}: ${count}`);
  });

  // Check specifically PDFs and audio
  const { data: downloadable } = await supabase
    .from('job_artifacts')
    .select('artifact_type, storage_path')
    .eq('job_id', jobId)
    .in('artifact_type', ['pdf', 'audio_mp3', 'audio_m4a']);

  console.log(`\n📥 Downloadable artifacts (${downloadable?.length || 0}):`);
  downloadable?.slice(0, 5).forEach(a => {
    console.log(`  ${a.artifact_type}: ${a.storage_path.split('/').pop()}`);
  });
}

checkTypes().catch(console.error);
