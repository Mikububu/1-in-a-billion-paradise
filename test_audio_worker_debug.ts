import { createSupabaseServiceClient } from './src/services/supabaseClient';
import { config } from 'dotenv';
import { join } from 'path';

config({ path: join(__dirname, '.env') });

const supabase = createSupabaseServiceClient();

if (!supabase) {
  console.error('❌ Supabase not configured');
  process.exit(1);
}

async function testAudioWorkerDebug() {
  console.log('🔍 Testing audio worker with debug instrumentation...\n');

  // Find a failed audio task to retry, or create a test task
  const { data: failedTask, error: taskError } = await supabase
    .from('job_tasks')
    .select('*')
    .eq('task_type', 'audio_generation')
    .eq('status', 'failed')
    .order('created_at', { ascending: false })
    .limit(1)
    .single();

  if (taskError || !failedTask) {
    console.log('⚠️  No failed tasks found. Checking for pending tasks...\n');
    
    // Check for pending tasks
    const { data: pendingTask } = await supabase
      .from('job_tasks')
      .select('*')
      .eq('task_type', 'audio_generation')
      .eq('status', 'pending')
      .limit(1)
      .single();

    if (pendingTask) {
      console.log(`✅ Found pending task: ${pendingTask.id}`);
      console.log(`   Job ID: ${pendingTask.job_id}`);
      console.log(`   Input:`, JSON.stringify(pendingTask.input, null, 2));
      console.log(`\n💡 This task will be picked up by the audio worker.`);
      console.log(`   Check Fly.io logs: flyctl logs -a 1-in-a-billion-backend | grep AudioWorker`);
      console.log(`   Or check debug.log after the worker processes it.`);
    } else {
      console.log('❌ No pending or failed tasks found.');
      console.log('   You may need to start a new job to trigger audio generation.');
    }
    return;
  }

  console.log(`📋 Found failed task: ${failedTask.id}`);
  console.log(`   Job ID: ${failedTask.job_id}`);
  console.log(`   Error: ${failedTask.error}`);
  console.log(`   Input:`, JSON.stringify(failedTask.input, null, 2));
  
  // Get the job to see the full context
  const { data: job } = await supabase
    .from('jobs')
    .select('*')
    .eq('id', failedTask.job_id)
    .single();

  if (job) {
    console.log(`\n📊 Job Details:`);
    console.log(`   Type: ${job.type}`);
    console.log(`   Status: ${job.status}`);
    console.log(`   Created: ${job.created_at}`);
  }

  // Check RunPod configuration
  console.log(`\n🔑 Checking RunPod configuration...`);
  const { data: runpodKey } = await supabase
    .from('api_keys')
    .select('*')
    .eq('service', 'runpod')
    .single();

  const { data: runpodEndpoint } = await supabase
    .from('api_keys')
    .select('*')
    .eq('service', 'runpod_endpoint')
    .single();

  if (runpodKey) {
    console.log(`   ✅ RunPod API Key: Found (${runpodKey.value?.substring(0, 10)}...)`);
  } else {
    console.log(`   ❌ RunPod API Key: NOT FOUND in Supabase`);
  }

  if (runpodEndpoint) {
    console.log(`   ✅ RunPod Endpoint ID: ${runpodEndpoint.value}`);
  } else {
    console.log(`   ❌ RunPod Endpoint ID: NOT FOUND in Supabase`);
  }

  console.log(`\n💡 To see debug logs when the worker processes this task:`);
  console.log(`   1. Reset the task status to 'pending' to retry it`);
  console.log(`   2. Or check Fly.io logs: flyctl logs -a 1-in-a-billion-backend`);
  console.log(`   3. Or wait for the next audio task to be processed`);
}

testAudioWorkerDebug().catch(err => {
  console.error('❌ Fatal error:', err);
  process.exit(1);
});
