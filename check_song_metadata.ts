import { createSupabaseServiceClient } from './src/services/supabaseClient';
import { config } from 'dotenv';
import { join } from 'path';

config({ path: join(__dirname, '.env') });

const supabase = createSupabaseServiceClient();

if (!supabase) {
  console.error('❌ Supabase not configured');
  process.exit(1);
}

async function checkSongMetadata() {
  console.log('🔍 Checking song artifact metadata for Iya and Eva & Fabrice...\n');

  // Check Iya's job (106ac0b3-1652-47c0-b462-8bd3dbd7924b)
  const iyaJobId = '106ac0b3-1652-47c0-b462-8bd3dbd7924b';
  const evaJobId = '20b5f381-f57f-4965-8545-b8d1e0cc3615';

  for (const [name, jobId] of [['Iya & Jonathan (Nuclear)', iyaJobId], ['Eva & Fabrice (Nuclear)', evaJobId]]) {
    console.log(`\n═══════════════════════════════════════════════════════════`);
    console.log(`📊 ${name}`);
    console.log(`═══════════════════════════════════════════════════════════`);

    // Get job params
    const { data: job } = await supabase
      .from('jobs')
      .select('params, type')
      .eq('id', jobId)
      .single();

    console.log(`\n📦 Job Type: ${job?.type}`);
    console.log(`📦 Job Params:`, JSON.stringify(job?.params, null, 2));

    // Get song artifacts
    const { data: songArtifacts } = await supabase
      .from('job_artifacts')
      .select('*')
      .eq('job_id', jobId)
      .eq('artifact_type', 'audio_song')
      .order('created_at', { ascending: true });

    console.log(`\n🎵 Found ${songArtifacts?.length || 0} song artifacts:`);
    
    for (const artifact of songArtifacts || []) {
      console.log(`\n  📄 Artifact ID: ${artifact.id.substring(0, 8)}...`);
      console.log(`     Storage Key: ${artifact.storage_key}`);
      console.log(`     Metadata:`, JSON.stringify(artifact.metadata, null, 2));
      console.log(`     Created: ${new Date(artifact.created_at).toLocaleString()}`);
    }

    // Get song tasks to see what personName was used
    const { data: songTasks } = await supabase
      .from('job_tasks')
      .select('*')
      .eq('job_id', jobId)
      .eq('task_type', 'song_generation')
      .order('sequence', { ascending: true });

    console.log(`\n🎤 Found ${songTasks?.length || 0} song tasks:`);
    
    for (const task of songTasks || []) {
      console.log(`\n  🎵 Task ${task.sequence}: ${task.status}`);
      console.log(`     Input:`, JSON.stringify(task.input, null, 2));
      console.log(`     Created: ${new Date(task.created_at).toLocaleString()}`);
    }
  }
}

checkSongMetadata().catch(err => {
  console.error('❌ Fatal error:', err);
  process.exit(1);
});
