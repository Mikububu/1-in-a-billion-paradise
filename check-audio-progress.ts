import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';
config();

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function checkAudio() {
  const { data: jobs } = await supabase.from('jobs').select('id, created_at').order('created_at', { ascending: false }).limit(1);
  const jobId = jobs?.[0]?.id;
  const startTime = new Date(jobs?.[0]?.created_at);

  const { data: tasks } = await supabase
    .from('job_tasks')
    .select('task_type, status, completed_at')
    .eq('job_id', jobId)
    .in('task_type', ['audio_generation', 'song_generation']);

  const audioComplete = tasks?.filter(t => t.task_type === 'audio_generation' && t.status === 'complete') || [];
  const songComplete = tasks?.filter(t => t.task_type === 'song_generation' && t.status === 'complete') || [];
  
  console.log(`\n🎵 Audio: ${audioComplete.length}/16 complete`);
  console.log(`🎶 Songs: ${songComplete.length}/16 complete`);
  
  if (audioComplete.length > 0) {
    const lastAudio = audioComplete.sort((a, b) => 
      new Date(b.completed_at).getTime() - new Date(a.completed_at).getTime()
    )[0];
    const elapsed = Math.floor((new Date(lastAudio.completed_at).getTime() - startTime.getTime()) / 60000);
    console.log(`⏱️  Last audio completed: ${elapsed} min after job start`);
  }

  const elapsedTotal = Math.floor((Date.now() - startTime.getTime()) / 60000);
  console.log(`⏰ Total elapsed: ${elapsedTotal} minutes`);
}

checkAudio().catch(console.error);
