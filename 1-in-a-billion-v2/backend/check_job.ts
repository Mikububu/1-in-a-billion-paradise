import { createClient } from '@supabase/supabase-js';
import { env } from './src/config/env';

const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

async function main() {
    console.log("Fetching job: 478b6ef3-e7e9-4720-9b50-49ecd0437b17");
    const { data: job, error: jobErr } = await supabase.from('jobs').select('*').eq('id', '478b6ef3-e7e9-4720-9b50-49ecd0437b17').single();
    if (jobErr) console.error("Job Error:", jobErr);
    console.log("JOB STATUS:", job?.status);

    const { data: tasks, error: taskErr } = await supabase.from('job_tasks').select('*').eq('job_id', '478b6ef3-e7e9-4720-9b50-49ecd0437b17');
    if (taskErr) console.error("Task Error:", taskErr);

    console.log("TASKS:");
    tasks?.forEach(t => console.log(t));
}
main();
