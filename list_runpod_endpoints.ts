import { apiKeys } from './src/services/apiKeysHelper';
import axios from 'axios';
import { config } from 'dotenv';
import { join } from 'path';

config({ path: join(__dirname, '.env') });

async function listRunPodEndpoints() {
  console.log('🔍 Listing all RunPod serverless endpoints...\n');

  const runpodKey = await apiKeys.runpod().catch(() => null);

  if (!runpodKey) {
    console.error('❌ RunPod API key not found');
    process.exit(1);
  }

  console.log(`✅ RunPod API Key: ${runpodKey.substring(0, 10)}...\n`);

  // Try different RunPod API endpoints to list serverless endpoints
  const endpoints = [
    { url: 'https://api.runpod.ai/v2/serverless', label: 'v2/serverless' },
    { url: 'https://api.runpod.ai/v2/endpoints', label: 'v2/endpoints' },
  ];

  for (const endpoint of endpoints) {
    try {
      console.log(`📡 Trying ${endpoint.label}...`);
      const response = await axios.get(endpoint.url, {
        headers: {
          Authorization: `Bearer ${runpodKey}`,
          'Content-Type': 'application/json',
        },
        timeout: 10000,
      });

      const data = response.data;
      
      // Handle different response formats
      let endpointsList: any[] = [];
      if (Array.isArray(data)) {
        endpointsList = data;
      } else if (data?.data && Array.isArray(data.data)) {
        endpointsList = data.data;
      } else if (data?.endpoints && Array.isArray(data.endpoints)) {
        endpointsList = data.endpoints;
      } else if (data?.serverless && Array.isArray(data.serverless)) {
        endpointsList = data.serverless;
      }

      if (endpointsList.length > 0) {
        console.log(`\n✅ Found ${endpointsList.length} endpoint(s):\n`);
        
        for (const ep of endpointsList) {
          const id = ep.id || ep.endpointId || ep.endpoint_id;
          const name = ep.name || ep.endpointName || ep.endpoint_name || 'Unnamed';
          const status = ep.status || 'unknown';
          const templateId = ep.templateId || ep.template_id || 'N/A';
          
          console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
          console.log(`Name: ${name}`);
          console.log(`ID: ${id}`);
          console.log(`Status: ${status}`);
          console.log(`Template ID: ${templateId}`);
          
          // Check if this might be the Chatterbox endpoint
          if (name.toLowerCase().includes('chatterbox') || 
              name.toLowerCase().includes('tts') ||
              name.toLowerCase().includes('voice') ||
              name.toLowerCase().includes('audio')) {
            console.log(`🎯 This looks like it might be your Chatterbox TTS endpoint!`);
          }
          
          console.log('');
        }
        
        return; // Success, exit
      } else {
        console.log(`   ⚠️  No endpoints found in response`);
        console.log(`   Response structure:`, Object.keys(data || {}).join(', '));
      }
    } catch (error: any) {
      console.log(`   ❌ Failed: ${error.message}`);
      if (error.response?.status === 404) {
        console.log(`   💡 This endpoint doesn't exist, trying next...`);
      }
    }
  }

  console.log('\n❌ Could not list endpoints from any API endpoint.');
  console.log('💡 You may need to check your RunPod console manually:');
  console.log('   https://www.runpod.io/console/serverless');
}

listRunPodEndpoints().catch(err => {
  console.error('❌ Fatal error:', err);
  process.exit(1);
});
