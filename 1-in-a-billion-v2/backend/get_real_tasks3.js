const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const env = fs.readFileSync('.env', 'utf8');
const url = env.match(/SUPABASE_URL="?([^"\n]+)"?/)[1];
const key = env.match(/SUPABASE_SERVICE_ROLE_KEY="?([^"\n]+)"?/)[1];
const supabase = createClient(url, key);
async function run() {
  const { data: jobs, error: err1 } = await supabase.from('jobs').select('id, type').order('created_at', { ascending: false }).limit(20);
  if (!jobs || jobs.length === 0) { console.log("No jobs found"); return; }
  const types = [...new Set(jobs.map(j => j.type))];
  console.log("Recent Job Types:", types);
  
  // Find a job with 'verdict' logic
  for (const job of jobs) {
    const jobId = job.id;
    const { data: tasks, error: err2 } = await supabase.from('job_tasks').select('sequence, input, status, error').eq('job_id', jobId).order('sequence', { ascending: true });
    if(tasks.some(t => t.input && t.input.docType === 'verdict')) {
       console.log("Found Verdict in job:", jobId, "Type:", job.type);
    }
  }
}
run();
