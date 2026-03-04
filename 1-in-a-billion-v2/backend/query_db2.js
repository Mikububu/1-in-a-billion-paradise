const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env' });
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);
async function main() {
  const { data: ur, error: e3 } = await supabase.from('user_readings').select('*').limit(1);
  console.log('--- user_readings ---', JSON.stringify(ur, null, 2), e3);
}
main();
