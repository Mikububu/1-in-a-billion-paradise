#!/bin/bash

# Quick script to update RunPod endpoint ID
# Usage: ./quick_fix_endpoint.sh YOUR_ENDPOINT_ID

if [ -z "$1" ]; then
  echo "❌ Error: Please provide an endpoint ID"
  echo "Usage: ./quick_fix_endpoint.sh YOUR_ENDPOINT_ID"
  echo ""
  echo "To get your endpoint ID:"
  echo "1. Go to https://www.runpod.io/console/serverless"
  echo "2. Find your Chatterbox/TTS endpoint"
  echo "3. Copy the Endpoint ID"
  exit 1
fi

ENDPOINT_ID="$1"

echo "🔧 Updating RunPod endpoint ID to: $ENDPOINT_ID"
echo ""

# Run the TypeScript update script
npx tsx -e "
import { createSupabaseServiceClient } from './src/services/supabaseClient';
import { config } from 'dotenv';
import { join } from 'path';

config({ path: join(__dirname, '.env') });

const supabase = createSupabaseServiceClient();

if (!supabase) {
  console.error('❌ Supabase not configured');
  process.exit(1);
}

async function update() {
  const { error } = await supabase
    .from('api_keys')
    .update({ 
      token: '$ENDPOINT_ID',
      updated_at: new Date().toISOString()
    })
    .eq('service', 'runpod_endpoint');

  if (error) {
    console.error('❌ Failed:', error.message);
    process.exit(1);
  }

  console.log('✅ Endpoint ID updated successfully!');
  console.log('');
  console.log('🧪 Testing the endpoint...');
  
  // Test it
  const { apiKeys } = await import('./src/services/apiKeysHelper');
  const axios = await import('axios');
  
  try {
    const runpodKey = await apiKeys.runpod();
    const runpodEndpoint = await apiKeys.runpodEndpoint();
    
    const response = await axios.default.post(
      \`https://api.runpod.ai/v2/\${runpodEndpoint}/run\`,
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
          Authorization: \`Bearer \${runpodKey}\`,
          'Content-Type': 'application/json',
        },
        timeout: 10000,
      }
    );
    
    console.log('✅ Endpoint is working! Status:', response.status);
    if (response.data?.id) {
      console.log('   Job ID:', response.data.id);
    }
  } catch (error: any) {
    console.error('❌ Endpoint test failed:', error.response?.status || error.message);
    if (error.response?.status === 404) {
      console.error('   The endpoint ID is still wrong or the endpoint doesn\'t exist');
    }
  }
}

update().catch(err => {
  console.error('❌ Error:', err);
  process.exit(1);
});
"
