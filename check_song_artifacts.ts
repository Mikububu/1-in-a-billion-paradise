import { createClient } from '@supabase/supabase-js';
import { env } from './src/config/env';

const supabase = createClient(env.SUPABASE_URL!, env.SUPABASE_SERVICE_ROLE_KEY!);

async function checkSongArtifacts() {
  const jobId = '5949528b-c445-48f3-a877-709b91ad8e7e';
  
  const { data: artifacts, error } = await supabase
    .from('job_artifacts')
    .select('*')
    .eq('job_id', jobId)
    .eq('artifact_type', 'audio_song');

  if (error) {
    console.error('❌ Error:', error.message);
    return;
  }

  console.log(`Song artifacts: ${artifacts?.length || 0}`);
  
  if (artifacts && artifacts.length > 0) {
    artifacts.forEach(a => {
      console.log(`\n  Artifact ${a.id}:`);
      console.log(`    docNum: ${a.metadata?.docNum || 'N/A'}`);
      console.log(`    storage_path: ${a.storage_path || 'N/A'}`);
      console.log(`    storage_url: ${a.storage_url || 'N/A'}`);
      console.log(`    created_at: ${a.created_at}`);
    });
  } else {
    console.log('\n⚠️  No song artifacts found - song generation may not have completed yet');
    
    // Check song task status
    const { data: songTask } = await supabase
      .from('job_tasks')
      .select('*')
      .eq('job_id', jobId)
      .eq('task_type', 'song_generation')
      .single();
    
    if (songTask) {
      console.log(`\n📋 Song task status: ${songTask.status}`);
      console.log(`   Attempts: ${songTask.attempts}/${songTask.max_attempts}`);
      if (songTask.error) {
        console.log(`   Error: ${songTask.error}`);
      }
    }
  }
}

checkSongArtifacts().catch(console.error);
