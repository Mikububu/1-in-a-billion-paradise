import { createSupabaseServiceClient } from './src/services/supabaseClient';
import { apiKeys } from './src/services/apiKeysHelper';
import axios from 'axios';
import { config } from 'dotenv';
import { join } from 'path';

config({ path: join(__dirname, '.env') });

async function testRunPodEndpoint() {
  console.log('🔍 Testing RunPod endpoint...\n');

  // Get keys
  const runpodKey = await apiKeys.runpod().catch(() => null);
  const runpodEndpoint = await apiKeys.runpodEndpoint().catch(() => null);

  if (!runpodKey || !runpodEndpoint) {
    console.error('❌ RunPod keys not found');
    console.log(`   Key: ${runpodKey ? 'Found' : 'Missing'}`);
    console.log(`   Endpoint: ${runpodEndpoint || 'Missing'}`);
    process.exit(1);
  }

  console.log(`✅ RunPod API Key: ${runpodKey.substring(0, 10)}...`);
  console.log(`✅ RunPod Endpoint ID: ${runpodEndpoint}`);
  console.log(`   Length: ${runpodEndpoint.length} characters`);

  // Test the endpoint URL
  const testUrl = `https://api.runpod.ai/v2/${runpodEndpoint}/runsync`;
  console.log(`\n🌐 Testing URL: ${testUrl}`);

  // Try a minimal request
  try {
    console.log('\n📤 Sending test request...');
    const response = await axios.post(
      testUrl,
      {
        input: {
          text: 'Hello, this is a test.',
          audio_url: 'https://qdfikbgwuauertfmkmzk.supabase.co/storage/v1/object/public/voices/david.wav',
          exaggeration: 0.3,
          cfg_weight: 0.5,
        },
      },
      {
        headers: {
          Authorization: `Bearer ${runpodKey}`,
          'Content-Type': 'application/json',
        },
        timeout: 30000,
      }
    );

    console.log(`✅ Request succeeded!`);
    console.log(`   Status: ${response.status}`);
    console.log(`   Response keys: ${Object.keys(response.data || {}).join(', ')}`);
    if (response.data?.id) {
      console.log(`   Job ID: ${response.data.id}`);
    }
    if (response.data?.status) {
      console.log(`   Status: ${response.data.status}`);
    }
  } catch (error: any) {
    console.error(`❌ Request failed!`);
    console.error(`   Message: ${error.message}`);
    console.error(`   Status: ${error.response?.status || 'N/A'}`);
    console.error(`   Status Text: ${error.response?.statusText || 'N/A'}`);
    console.error(`   Response Data:`, JSON.stringify(error.response?.data || {}, null, 2));
    console.error(`   URL: ${error.config?.url || 'N/A'}`);
    
    if (error.response?.status === 404) {
      console.error(`\n💡 404 Error means the endpoint doesn't exist!`);
      console.error(`   Possible causes:`);
      console.error(`   1. Endpoint ID is wrong: "${runpodEndpoint}"`);
      console.error(`   2. Endpoint was deleted/deactivated`);
      console.error(`   3. API URL format changed`);
      console.error(`   4. Endpoint doesn't support /runsync`);
    }
  }
}

testRunPodEndpoint().catch(err => {
  console.error('❌ Fatal error:', err);
  process.exit(1);
});
