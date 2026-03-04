const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function main() {
  const { data: lp, error: e1 } = await supabase.from('library_people').select('user_id, client_person_id, is_user, hook_readings').not('hook_readings', 'is', null).limit(1);
  console.log('--- library_people hook_readings ---', JSON.stringify(lp, null, 2), e1);

  const { data: ur, error: e3 } = await supabase.from('user_readings').select('*').limit(1);
  console.log('--- user_readings ---', JSON.stringify(ur, null, 2), e3);
}
main();
