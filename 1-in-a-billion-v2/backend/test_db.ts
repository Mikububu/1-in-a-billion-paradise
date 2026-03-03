import { supabase } from './src/services/supabaseClient';

async function run() {
  const { data: jobs, error } = await supabase.from('jobs').select('id, type').order('created_at', { ascending: false }).limit(5);
  console.log("TEST DB JOBS:", jobs);
  if (jobs?.length > 0) {
    const { data: tasks } = await supabase.from('job_tasks').select('sequence, input, status, error').eq('job_id', jobs[0].id).order('sequence', { ascending: true });
    console.log("TASKS FOR LATEST JOB:", tasks);
  }
}
run();
