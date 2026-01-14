import { createClient } from '@supabase/supabase-js';
import { env } from './src/config/env';

const supabase = createClient(env.SUPABASE_URL!, env.SUPABASE_SERVICE_ROLE_KEY!);

async function checkMiniMaxKey() {
  const { data: key, error } = await supabase
    .from('api_keys')
    .select('*')
    .eq('key_name', 'minimax')
    .single();

  if (error) {
    console.log('❌ MiniMax API key NOT found in Supabase');
    console.log('   Error:', error.message);
    return;
  }

  if (key) {
    console.log('✅ MiniMax API key found');
    console.log('   Key:', key.token ? key.token.substring(0, 10) + '...' : 'N/A');
    console.log('   Description:', key.description || 'N/A');
  } else {
    console.log('❌ MiniMax API key NOT found in Supabase');
  }
}

checkMiniMaxKey().catch(console.error);
