const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const env = fs.readFileSync('.env', 'utf8');
const url = env.match(/SUPABASE_URL="?([^"\n]+)"?/)[1];
const key = env.match(/SUPABASE_SERVICE_ROLE_KEY="?([^"\n]+)"?/)[1];
const supabase = createClient(url, key);

async function run() {
  const { data: jobs } = await supabase.from('jobs').select('id, type').order('created_at', { ascending: false }).limit(5);
  console.log("TEST DB JOBS:", jobs);
  if (jobs?.length > 0) {
    const { data: tasks } = await supabase.from('job_tasks').select('sequence, input, status, error').eq('job_id', jobs[0].id).order('sequence', { ascending: true });
    console.log("TASKS FOR LATEST JOB:", tasks);
  }
}
run();
