import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  throw new Error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set in .env');
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkAPIKeys() {
  // Check api_keys table
  const { data: apiKeys, error: apiError } = await supabase
    .from('api_keys')
    .select('*');

  if (apiError) {
    console.error('❌ Error fetching api_keys:', apiError);
    return;
  }

  console.log('📋 API Keys from Supabase:\n');
  for (const key of apiKeys || []) {
    const masked = key.api_key ? `${key.api_key.substring(0, 10)}...${key.api_key.substring(key.api_key.length - 4)}` : '(empty)';
    console.log(`  ${key.service_name}: ${masked}`);
  }

  // Check assistant_config table
  const { data: config, error: configError } = await supabase
    .from('assistant_config')
    .select('*')
    .single();

  if (configError) {
    console.error('\n❌ Error fetching assistant_config:', configError);
    return;
  }

  console.log('\n📋 Assistant Config:\n');
  if (config?.deepseek_api_key) {
    const masked = `${config.deepseek_api_key.substring(0, 10)}...${config.deepseek_api_key.substring(config.deepseek_api_key.length - 4)}`;
    console.log(`  deepseek_api_key: ${masked}`);
  } else {
    console.log('  deepseek_api_key: (not set)');
  }

  if (config?.claude_api_key) {
    const masked = `${config.claude_api_key.substring(0, 10)}...${config.claude_api_key.substring(config.claude_api_key.length - 4)}`;
    console.log(`  claude_api_key: ${masked}`);
  } else {
    console.log('  claude_api_key: (not set)');
  }
}

checkAPIKeys().catch(console.error);
