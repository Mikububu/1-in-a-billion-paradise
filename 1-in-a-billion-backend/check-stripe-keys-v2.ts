import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';
config();

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function checkStripe() {
  // First check table structure
  const { data: allKeys, error: fetchError } = await supabase
    .from('api_keys')
    .select('*')
    .limit(1);

  if (fetchError) {
    console.error('❌ Error:', fetchError);
    return;
  }

  console.log('📋 Table structure:', Object.keys(allKeys?.[0] || {}));

  // Now get Stripe keys
  const { data, error } = await supabase
    .from('api_keys')
    .select('*')
    .ilike('service', '%stripe%');

  if (error) {
    console.error('❌ Error:', error);
    return;
  }

  if (!data || data.length === 0) {
    console.log('\n❌ No Stripe keys found in database');
    console.log('\n📝 To add Stripe TEST keys:');
    console.log('1. Get test keys: https://dashboard.stripe.com/test/apikeys');
    console.log('2. Copy the "Secret key" (starts with sk_test_...)');
    console.log('3. Add to Supabase api_keys table');
    return;
  }

  console.log('\n✅ Stripe keys found:\n');
  data.forEach((key: any) => {
    const keyValue = key.key || key.api_key || key.secret || 'unknown';
    const masked = keyValue.substring(0, 12) + '...' + keyValue.slice(-4);
    const isTest = keyValue.includes('_test_');
    const mode = isTest ? '🧪 TEST (safe for App Store)' : '🔴 LIVE PRODUCTION';
    console.log(`${mode}`);
    console.log(`Service: ${key.service}`);
    console.log(`Key: ${masked}`);
    console.log(`Added: ${new Date(key.created_at).toLocaleDateString()}\n`);
  });
}

checkStripe().catch(console.error);
