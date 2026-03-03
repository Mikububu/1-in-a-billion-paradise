import { config } from 'dotenv';
config({ path: './.env' });
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

if (!supabaseUrl || !supabaseKey) {
    console.error("Missing supabase env variables");
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function main() {
    const jobId = 'a140c430-270f-46f0-96d0-9023f5bd5a4d';

    const { data: tasks, error: taskErr } = await supabase
        .from('job_tasks')
        .select('*')
        .eq('job_id', jobId)
        .not('status', 'eq', 'complete')
        .order('sequence', { ascending: true });

    if (taskErr) {
        console.error("Tasks error:", taskErr);
    } else {
        for (const t of tasks || []) {
            console.log(`Task ${t.id} (seq ${t.sequence}) status: ${t.status}, attempts: ${t.attempts}`);
            console.log(`  Updated at: ${t.updated_at}`);
            console.log(`  Heartbeat: ${t.last_heartbeat_at}`);
            console.log(`  Error: ${t.error}`);
            console.log('---');
        }
    }
}

main().catch(console.error);
