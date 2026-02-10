import { createClient } from '@supabase/supabase-js';
import { env } from './src/config/env';

const supabase = createClient(env.SUPABASE_URL!, env.SUPABASE_SERVICE_ROLE_KEY!);

async function resetSongTask() {
  const taskId = '0de12dff-61e5-47a7-8fbb-4009283e8ec1';
  
  console.log('🔄 Resetting song task to pending...');
  
  const { error } = await supabase
    .from('job_tasks')
    .update({
      status: 'pending',
      error: null,
      last_heartbeat: null,
    })
    .eq('id', taskId);

  if (error) {
    console.error('❌ Error:', error.message);
  } else {
    console.log('✅ Song task reset to pending - should be picked up by song worker');
  }
}

resetSongTask().catch(console.error);
