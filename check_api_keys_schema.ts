import { createSupabaseServiceClient } from './src/services/supabaseClient';
import { config } from 'dotenv';
import { join } from 'path';

config({ path: join(__dirname, '.env') });

const supabase = createSupabaseServiceClient();

if (!supabase) {
  console.error('❌ Supabase not configured');
  process.exit(1);
}

async function checkApiKeysSchema() {
  console.log('🔍 Checking api_keys table schema...\n');

  // Try to get all columns
  const { data: allKeys, error: allError } = await supabase
    .from('api_keys')
    .select('*')
    .in('service', ['runpod', 'runpod_endpoint']);

  if (allError) {
    console.error(`❌ Error: ${allError.message}`);
    return;
  }

  if (!allKeys || allKeys.length === 0) {
    console.log('⚠️  No keys found');
    return;
  }

  console.log('📊 Found keys:');
  for (const key of allKeys) {
    console.log(`\n   Service: ${key.service}`);
    console.log(`   ID: ${key.id}`);
    console.log(`   Columns:`, Object.keys(key));
    console.log(`   Values:`, JSON.stringify(key, null, 2));
  }

  // Try querying with 'token' column
  console.log('\n🔍 Testing query with "token" column:');
  const { data: tokenData, error: tokenError } = await supabase
    .from('api_keys')
    .select('token')
    .eq('service', 'runpod_endpoint')
    .single();

  if (tokenError) {
    console.log(`   ❌ Error: ${tokenError.message} (code: ${tokenError.code})`);
  } else {
    console.log(`   ✅ Token value: ${tokenData?.token || 'NULL'}`);
  }

  // Try querying with 'value' column
  console.log('\n🔍 Testing query with "value" column:');
  const { data: valueData, error: valueError } = await supabase
    .from('api_keys')
    .select('value')
    .eq('service', 'runpod_endpoint')
    .single();

  if (valueError) {
    console.log(`   ❌ Error: ${valueError.message} (code: ${valueError.code})`);
  } else {
    console.log(`   ✅ Value: ${valueData?.value || 'NULL'}`);
  }
}

checkApiKeysSchema().catch(err => {
  console.error('❌ Fatal error:', err);
  process.exit(1);
});
