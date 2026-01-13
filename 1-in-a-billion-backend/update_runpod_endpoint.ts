import { createSupabaseServiceClient } from './src/services/supabaseClient';
import { config } from 'dotenv';
import { join } from 'path';
import * as readline from 'readline';

config({ path: join(__dirname, '.env') });

const supabase = createSupabaseServiceClient();

if (!supabase) {
  console.error('❌ Supabase not configured');
  process.exit(1);
}

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

function question(prompt: string): Promise<string> {
  return new Promise((resolve) => {
    rl.question(prompt, resolve);
  });
}

async function updateRunPodEndpoint() {
  console.log('🔧 Update RunPod Endpoint ID\n');
  console.log('Current endpoint ID: 90dt1bkdj3y08r (DOES NOT EXIST)\n');
  
  const newEndpointId = await question('Enter your new RunPod endpoint ID: ');
  
  if (!newEndpointId || newEndpointId.trim().length === 0) {
    console.log('❌ No endpoint ID provided');
    rl.close();
    process.exit(1);
  }

  const trimmedId = newEndpointId.trim();
  console.log(`\n📝 Updating endpoint ID to: ${trimmedId}...`);

  const { error } = await supabase
    .from('api_keys')
    .update({ 
      token: trimmedId,
      updated_at: new Date().toISOString()
    })
    .eq('service', 'runpod_endpoint');

  if (error) {
    console.error('❌ Failed to update:', error.message);
    rl.close();
    process.exit(1);
  }

  console.log('✅ Endpoint ID updated successfully!');
  console.log('\n💡 Next steps:');
  console.log('   1. Test the endpoint with: npx tsx test_runpod_endpoint.ts');
  console.log('   2. If it works, audio generation should start working automatically');
  
  rl.close();
}

updateRunPodEndpoint().catch(err => {
  console.error('❌ Fatal error:', err);
  rl.close();
  process.exit(1);
});
