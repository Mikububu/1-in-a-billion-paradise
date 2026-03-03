import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkJob() {
    const jobId = '3a11e2f1-5d23-4177-a777-fe77111c3ece';

    console.log(`Checking job: ${jobId}`);
    const { data: job, error: jobError } = await supabase
        .from('jobs')
        .select('*')
        .eq('id', jobId)
        .single();

    if (jobError) console.error("Job Error:", jobError);
    console.log("Job:", job);

    const { data: tasks, error: tasksError } = await supabase
        .from('job_tasks')
        .select('*')
        .eq('job_id', jobId);

    if (tasksError) console.error("Tasks Error:", tasksError);
    console.log("Tasks:", tasks);
}

checkJob();
