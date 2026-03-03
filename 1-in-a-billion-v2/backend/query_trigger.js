const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const url = fs.readFileSync('.env', 'utf8').match(/SUPABASE_URL="?([^"\n]+)"?/)[1];
const key = fs.readFileSync('.env', 'utf8').match(/SUPABASE_SERVICE_ROLE_KEY="?([^"\n]+)"?/)[1];
const supabase = createClient(url, key);
async function run() {
  const { data, error } = await supabase.rpc('query_trigger_debug');
  console.log(data, error);
}
run();
