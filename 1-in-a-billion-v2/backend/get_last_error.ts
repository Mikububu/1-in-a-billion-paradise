import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

async function check() {
  const { data, error } = await supabase
    .from('job_tasks')
    .select('id, error, attempts, status, updated_at')
    .eq('job_id', '3a11e2f1-5d23-4177-a777-fe77111c3ece');
  console.log(data, error);
}
check();
