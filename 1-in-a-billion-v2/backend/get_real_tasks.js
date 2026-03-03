const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const env = fs.readFileSync('.env', 'utf8');
const url = env.match(/SUPABASE_URL="?([^"\n]+)"?/)[1];
const key = env.match(/SUPABASE_SERVICE_ROLE_KEY="?([^"\n]+)"?/)[1];
const supabase = createClient(url, key);
async function run() {
  const { data: jobs, error: err1 } = await supabase.from('jobs').select('id, type').eq('type', 'bundle_verdict').order('created_at', { ascending: false }).limit(1);
  if (!jobs || jobs.length === 0) { console.log("No bundle_verdict jobs found"); return; }
  const jobId = jobs[0].id;
  const { data: tasks, error: err2 } = await supabase.from('job_tasks').select('sequence, input, status, error').eq('job_id', jobId).order('sequence', { ascending: true });
  console.log("Job:", jobId, "Tasks length:", tasks.length);
  const verdictTasks = tasks.filter(t => t.input && t.input.docType === 'verdict');
  console.log("Verdict Tasks:", verdictTasks);
}
run();
