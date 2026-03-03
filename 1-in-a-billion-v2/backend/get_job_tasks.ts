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
    const jobId = '23df59a5-7b31-4451-9708-03fc0169af06';

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
