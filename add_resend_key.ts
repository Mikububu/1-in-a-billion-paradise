/**
 * Helper script to add Resend API key to Supabase
 * 
 * Usage:
 *   npx tsx add_resend_key.ts YOUR_RESEND_API_KEY
 */

import { createSupabaseServiceClient } from './src/services/supabaseClient';
import { config } from 'dotenv';
import { join } from 'path';

config({ path: join(__dirname, '.env') });

async function addResendKey() {
  const apiKey = process.argv[2];

  if (!apiKey) {
    console.error('❌ Please provide your Resend API key as an argument');
    console.log('\nUsage:');
    console.log('  npx tsx add_resend_key.ts YOUR_RESEND_API_KEY');
    console.log('\nGet your API key from: https://resend.com/api-keys');
    process.exit(1);
  }

  if (!apiKey.startsWith('re_')) {
    console.warn('⚠️  Warning: Resend API keys usually start with "re_"');
    console.warn('   Are you sure this is the correct key?');
  }

  const supabase = createSupabaseServiceClient();

  if (!supabase) {
    console.error('❌ Supabase not configured');
    process.exit(1);
  }

  console.log('🔑 Adding Resend API key to Supabase...\n');

  const { error } = await supabase
    .from('api_keys')
    .upsert({
      service: 'resend',
      token: apiKey,
      updated_at: new Date().toISOString(),
    }, {
      onConflict: 'service',
    });

  if (error) {
    console.error('❌ Failed to save Resend API key:', error.message);
    process.exit(1);
  }

  console.log('✅ Resend API key saved to Supabase!');
  console.log('\n📧 Email notifications are now enabled.');
  console.log('   The system will use Resend to send emails when jobs complete.');
  console.log('\n🧪 To test:');
  console.log('   1. Complete a reading job');
  console.log('   2. Check backend logs for: "✅ Email sent to [email]"');
  console.log('   3. Check the user\'s inbox for the notification');
}

addResendKey().catch(console.error);
