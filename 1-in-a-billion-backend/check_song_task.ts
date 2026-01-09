import { createClient } from '@supabase/supabase-js';
import { env } from './src/config/env';

const supabase = createClient(env.SUPABASE_URL!, env.SUPABASE_SERVICE_ROLE_KEY!);

async function checkSongTask() {
  const taskId = '0de12dff-61e5-47a7-8fbb-4009283e8ec1';
  
  const { data: task, error } = await supabase
    .from('job_tasks')
    .select('*')
    .eq('id', taskId)
    .single();

  if (error) {
    console.error('❌ Error:', error.message);
    return;
  }

  console.log('Song task details:');
  console.log('  Status:', task?.status);
  console.log('  Attempts:', task?.attempts, '/', task?.max_attempts);
  console.log('  Last heartbeat:', task?.last_heartbeat);
  console.log('  Created:', task?.created_at);
  console.log('  Updated:', task?.updated_at);
  console.log('  Input:', JSON.stringify(task?.input, null, 2));
  console.log('  Output:', task?.output ? JSON.stringify(task.output, null, 2) : 'None');
  console.log('  Error:', task?.error || 'None');
  
  // Check if it's stale (no heartbeat in last 30 minutes)
  if (task?.last_heartbeat) {
    const lastHeartbeat = new Date(task.last_heartbeat);
    const now = new Date();
    const minutesSinceHeartbeat = (now.getTime() - lastHeartbeat.getTime()) / 1000 / 60;
    console.log(`\n⏱️  Minutes since last heartbeat: ${minutesSinceHeartbeat.toFixed(1)}`);
    
    if (minutesSinceHeartbeat > 30 && task.status === 'processing') {
      console.log('⚠️  Task appears stale - should be reclaimed');
    }
  }
}

checkSongTask().catch(console.error);
