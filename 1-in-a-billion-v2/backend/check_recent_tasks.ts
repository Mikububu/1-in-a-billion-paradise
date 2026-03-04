import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(__dirname, '.env') });

const supabaseUrl = process.env.SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const supabase = createClient(supabaseUrl, supabaseKey);

async function checkRecentTasks() {
    const { data, error } = await supabase
        .from('job_tasks')
        .select('id, job_id, task_type, status, error, created_at, updated_at')
        .order('created_at', { ascending: false })
        .limit(20);

    if (error) {
        console.error('Error fetching tasks:', error);
        return;
    }

    console.log('Recent 20 tasks:');
    console.table(data);
}

checkRecentTasks();
