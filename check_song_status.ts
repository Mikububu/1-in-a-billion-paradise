import { supabase } from './src/services/supabaseClient';

async function checkSongStatus() {
  console.log('🔍 Checking recent song generation tasks...\n');

  // Get recent song tasks
  const { data: tasks, error: tasksError } = await supabase!
    .from('job_tasks')
    .select('*')
    .eq('task_type', 'song_generation')
    .order('created_at', { ascending: false })
    .limit(10);

  if (tasksError) {
    console.error('Error fetching tasks:', tasksError);
    return;
  }

  if (!tasks || tasks.length === 0) {
    console.log('❌ No song generation tasks found');
    return;
  }

  console.log(`Found ${tasks.length} recent song tasks:\n`);

  for (const task of tasks) {
    console.log(`Task ${task.id}:`);
    console.log(`  Status: ${task.status}`);
    console.log(`  Job ID: ${task.job_id}`);
    console.log(`  Created: ${task.created_at}`);
    console.log(`  Claimed: ${task.claimed_at || 'not claimed'}`);
    console.log(`  Completed: ${task.completed_at || 'not completed'}`);
    
    if (task.error) {
      console.log(`  ❌ Error: ${task.error}`);
    }
    
    if (task.input) {
      const input = task.input as any;
      console.log(`  Input: docNum=${input.docNum}, docType=${input.docType}, system=${input.system}`);
    }

    // Check for artifacts
    const { data: artifacts, error: artifactsError } = await supabase!
      .from('job_artifacts')
      .select('*')
      .eq('task_id', task.id)
      .eq('artifact_type', 'audio_song');

    if (!artifactsError && artifacts && artifacts.length > 0) {
      console.log(`  ✅ Artifact created: ${artifacts[0].public_url || 'no URL'}`);
      if (artifacts[0].metadata?.error) {
        console.log(`  ⚠️ Artifact has error: ${artifacts[0].metadata.errorMessage}`);
      }
    } else {
      console.log(`  ⚠️ No artifact found`);
    }
    
    console.log('');
  }

  // Check MiniMax API key
  console.log('\n🔑 Checking MiniMax API key...');
  const { data: keyData, error: keyError } = await supabase!
    .from('api_keys')
    .select('*')
    .eq('provider', 'minimax')
    .single();

  if (keyError || !keyData) {
    console.log('❌ MiniMax API key NOT found in database');
  } else {
    console.log('✅ MiniMax API key found');
    console.log(`   Provider: ${keyData.provider}`);
    console.log(`   Token: ${keyData.token?.substring(0, 20)}...`);
  }
}

checkSongStatus().catch(console.error).finally(() => process.exit(0));
