import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(__dirname, '.env') });

const supabaseUrl = process.env.SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const supabase = createClient(supabaseUrl, supabaseKey);

async function check() {
    const { data, error } = await supabase
        .from('job_tasks')
        .select('*')
        .eq('job_id', '80aad5e7-c894-4bca-9cf4-449a0dfef972');

    console.log('Tasks for 80aad5e7:');
    console.table(data);
}

check();
