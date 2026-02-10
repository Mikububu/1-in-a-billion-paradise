import 'dotenv/config';
import { createSupabaseServiceClient } from './src/services/supabaseClient';

async function main() {
  const supabase = createSupabaseServiceClient();

  // Count all artifacts
  const { count: totalArtifacts } = await supabase
    .from('job_artifacts')
    .select('*', { count: 'exact', head: true });

  // Count PDFs
  const { count: pdfCount } = await supabase
    .from('job_artifacts')
    .select('*', { count: 'exact', head: true })
    .like('artifact_type', '%pdf%');

  // Count audio
  const { count: audioCount } = await supabase
    .from('job_artifacts')
    .select('*', { count: 'exact', head: true })
    .or('artifact_type.like.%audio%,artifact_type.like.%song%');

  // Get sample artifacts to see structure
  const { data: samples } = await supabase
    .from('job_artifacts')
    .select('artifact_type')
    .limit(50);

  const types = new Set(samples?.map(s => s.artifact_type) || []);

  console.log('📊 Artifact counts:');
  console.log('  Total:', totalArtifacts);
  console.log('  PDFs:', pdfCount);
  console.log('  Audio:', audioCount);
  console.log('\n📝 Artifact types:', Array.from(types).join(', '));
}

main().catch(console.error);
