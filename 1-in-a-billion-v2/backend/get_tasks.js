const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_ANON_KEY;
const supabase = createClient(url, key);
async function run() {
  const { data, error } = await supabase.from('job_tasks').select('*').eq('job_id', 'a_real_job_id_needed').limit(1);
  console.log(data, error);
}
run();
