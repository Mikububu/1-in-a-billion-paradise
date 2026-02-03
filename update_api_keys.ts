import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

const keys = [
  { service: 'deepseek', key_name: 'main', token: process.env.DEEPSEEK_API_KEY, description: 'DeepSeek API for text generation' },
  { service: 'claude', key_name: 'main', token: process.env.ANTHROPIC_API_KEY, description: 'Claude API for overlay generation' },
  { service: 'minimax', key_name: 'main', token: process.env.MINIMAX_API_KEY, description: 'MiniMax API for song generation' },
  { service: 'replicate', key_name: 'main', token: process.env.REPLICATE_API_TOKEN, description: 'Replicate API for Chatterbox TTS' },
  { service: 'fly_io', key_name: 'main', token: process.env.FLY_API_TOKEN, description: 'Fly.io deploy token' },
];

async function updateKeys() {
  console.log('🔄 Updating API keys in Supabase...\n');

  for (const key of keys) {
    if (!key.token) {
      console.log(`⏭️  Skipping ${key.service} (no token in .env)`);
      continue;
    }

    const { error } = await supabase
      .from('api_keys')
      .upsert(
        { 
          service: key.service, 
          key_name: key.key_name, 
          token: key.token, 
          description: key.description,
          updated_at: new Date().toISOString()
        },
        { onConflict: 'service' }
      );

    if (error) {
      console.error(`❌ Failed to update ${key.service}:`, error.message);
    } else {
      console.log(`✅ ${key.service} updated`);
    }
  }

  // Remove old RunPod entries
  const { error: deleteError } = await supabase
    .from('api_keys')
    .delete()
    .in('service', ['runpod', 'runpod_endpoint']);

  if (!deleteError) {
    console.log(`🗑️  Removed old RunPod entries`);
  }

  console.log('\n✅ Done! All API keys updated in Supabase.');
}

updateKeys();
