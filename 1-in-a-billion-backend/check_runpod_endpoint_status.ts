import { createSupabaseServiceClient } from './src/services/supabaseClient';
import { apiKeys } from './src/services/apiKeysHelper';
import axios from 'axios';
import { config } from 'dotenv';
import { join } from 'path';

config({ path: join(__dirname, '.env') });

async function checkRunPodEndpointStatus() {
  console.log('🔍 Checking RunPod endpoint status...\n');

  const runpodKey = await apiKeys.runpod().catch(() => null);
  const runpodEndpoint = await apiKeys.runpodEndpoint().catch(() => null);

  if (!runpodKey || !runpodEndpoint) {
    console.error('❌ RunPod keys not found');
    process.exit(1);
  }

  console.log(`✅ RunPod Endpoint ID: ${runpodEndpoint}\n`);

  // Check endpoint info
  console.log('1. Checking endpoint info...');
  try {
    const infoUrl = `https://api.runpod.ai/v2/serverless/${runpodEndpoint}`;
    console.log(`   URL: ${infoUrl}`);
    
    const response = await axios.get(infoUrl, {
      headers: {
        Authorization: `Bearer ${runpodKey}`,
        'Content-Type': 'application/json',
      },
      timeout: 10000,
    });

    console.log(`   ✅ Endpoint exists!`);
    console.log(`   Name: ${response.data?.name || 'N/A'}`);
    console.log(`   Status: ${response.data?.status || 'N/A'}`);
    console.log(`   Template ID: ${response.data?.templateId || 'N/A'}`);
    console.log(`   GPU Type: ${response.data?.gpuIds || 'N/A'}`);
  } catch (error: any) {
    console.error(`   ❌ Failed to get endpoint info: ${error.message}`);
    if (error.response?.status === 404) {
      console.error(`   💡 Endpoint ${runpodEndpoint} does NOT exist!`);
      console.error(`   You need to create a new endpoint or update the endpoint ID.`);
    }
  }

  // Test /run endpoint (async)
  console.log('\n2. Testing /run endpoint (async)...');
  try {
    const runUrl = `https://api.runpod.ai/v2/${runpodEndpoint}/run`;
    console.log(`   URL: ${runUrl}`);
    
    const response = await axios.post(
      runUrl,
      {
        input: {
          text: 'Test',
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
        timeout: 10000,
      }
    );

    console.log(`   ✅ /run endpoint works!`);
    console.log(`   Status: ${response.status}`);
    if (response.data?.id) {
      console.log(`   Job ID: ${response.data.id}`);
      console.log(`   Job Status: ${response.data.status}`);
    }
  } catch (error: any) {
    console.error(`   ❌ /run failed: ${error.message}`);
    console.error(`   Status: ${error.response?.status || 'N/A'}`);
  }

  // Test /runsync endpoint (synchronous)
  console.log('\n3. Testing /runsync endpoint (synchronous)...');
  try {
    const runsyncUrl = `https://api.runpod.ai/v2/${runpodEndpoint}/runsync`;
    console.log(`   URL: ${runsyncUrl}`);
    
    const response = await axios.post(
      runsyncUrl,
      {
        input: {
          text: 'Test',
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
        timeout: 10000,
      }
    );

    console.log(`   ✅ /runsync endpoint works!`);
    console.log(`   Status: ${response.status}`);
  } catch (error: any) {
    console.error(`   ❌ /runsync failed: ${error.message}`);
    console.error(`   Status: ${error.response?.status || 'N/A'}`);
    if (error.response?.status === 404) {
      console.error(`   💡 This endpoint does NOT support /runsync!`);
      console.error(`   Solution: Switch to /run (async) endpoint.`);
    }
  }

  console.log('\n💡 Recommendation:');
  console.log('   If /run works but /runsync doesn\'t, update audioWorker.ts to use /run instead.');
}

checkRunPodEndpointStatus().catch(err => {
  console.error('❌ Fatal error:', err);
  process.exit(1);
});
