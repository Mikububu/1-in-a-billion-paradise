const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const env = fs.readFileSync('.env', 'utf8');
const url = env.match(/SUPABASE_URL="?([^"\n]+)"?/)[1];
const key = env.match(/SUPABASE_SERVICE_ROLE_KEY="?([^"\n]+)"?/)[1];
const supabase = createClient(url, key);
async function run() {
  const { data: jobs, error: err1 } = await supabase.from('jobs').select('id, type').in('type', ['nuclear', 'nuclear_v2']).order('created_at', { ascending: false }).limit(2);
  if (!jobs || jobs.length === 0) { console.log("No nuclear jobs found"); return; }
  for (const job of jobs) {
    const jobId = job.id;
    const { data: tasks, error: err2 } = await supabase.from('job_tasks').select('sequence, input, status, error').eq('job_id', jobId).order('sequence', { ascending: true });
    console.log("Job:", jobId, "Type:", job.type, "Tasks length:", tasks.length);
    const verdictTasks = tasks.filter(t => t.input && t.input.docType === 'verdict');
    console.log("Verdict Tasks:", verdictTasks);
  }
}
run();
