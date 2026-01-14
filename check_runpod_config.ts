import { createSupabaseServiceClient } from './src/services/supabaseClient';
import { config } from 'dotenv';
import { join } from 'path';

config({ path: join(__dirname, '.env') });

const supabase = createSupabaseServiceClient();

if (!supabase) {
  console.error('❌ Supabase not configured');
  process.exit(1);
}

async function checkRunPodConfig() {
  console.log('🔍 Checking RunPod configuration...\n');

  // Check Supabase api_keys table
  console.log('1. Checking Supabase api_keys table:');
  const { data: apiKeys, error: keysError } = await supabase
    .from('api_keys')
    .select('*')
    .in('service', ['runpod', 'runpod_endpoint']);

  if (keysError) {
    console.error(`   ❌ Error: ${keysError.message}`);
  } else if (!apiKeys || apiKeys.length === 0) {
    console.log(`   ⚠️  No RunPod keys found in Supabase api_keys table`);
  } else {
    for (const key of apiKeys) {
      const masked = key.value ? `${key.value.substring(0, 10)}...` : 'NULL';
      console.log(`   ${key.service}: ${masked} (id: ${key.id})`);
    }
  }

  // Check environment variables
  console.log('\n2. Checking environment variables:');
  const runpodKey = process.env.RUNPOD_API_KEY;
  const runpodEndpoint = process.env.RUNPOD_ENDPOINT_ID;
  
  if (runpodKey) {
    console.log(`   ✅ RUNPOD_API_KEY: ${runpodKey.substring(0, 10)}...`);
  } else {
    console.log(`   ❌ RUNPOD_API_KEY: NOT SET`);
  }

  if (runpodEndpoint) {
    console.log(`   ✅ RUNPOD_ENDPOINT_ID: ${runpodEndpoint}`);
  } else {
    console.log(`   ❌ RUNPOD_ENDPOINT_ID: NOT SET`);
  }

  // Check apiKeysHelper
  console.log('\n3. Testing apiKeysHelper service:');
  try {
    const { apiKeys: apiKeysHelper } = await import('./src/services/apiKeysHelper');
    const key = await apiKeysHelper.runpod().catch(() => null);
    const endpoint = await apiKeysHelper.runpodEndpoint().catch(() => null);
    
    if (key) {
      console.log(`   ✅ apiKeys.runpod(): ${key.substring(0, 10)}...`);
    } else {
      console.log(`   ❌ apiKeys.runpod(): returned null`);
    }

    if (endpoint) {
      console.log(`   ✅ apiKeys.runpodEndpoint(): ${endpoint}`);
    } else {
      console.log(`   ❌ apiKeys.runpodEndpoint(): returned null`);
    }
  } catch (err: any) {
    console.log(`   ⚠️  Error importing apiKeysHelper: ${err.message}`);
  }

  console.log('\n💡 SOLUTION:');
  if (!runpodEndpoint) {
    console.log('   The RUNPOD_ENDPOINT_ID environment variable is missing!');
    console.log('   Add it to your .env file or set it in Fly.io secrets:');
    console.log('   flyctl secrets set RUNPOD_ENDPOINT_ID=your-endpoint-id -a 1-in-a-billion-backend');
  }
  if (!runpodKey) {
    console.log('   The RUNPOD_API_KEY environment variable is missing!');
    console.log('   Add it to your .env file or set it in Fly.io secrets:');
    console.log('   flyctl secrets set RUNPOD_API_KEY=your-api-key -a 1-in-a-billion-backend');
  }
}

checkRunPodConfig().catch(err => {
  console.error('❌ Fatal error:', err);
  process.exit(1);
});
