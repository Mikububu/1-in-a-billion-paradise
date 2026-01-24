import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';
config();

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function checkStripe() {
  const { data, error } = await supabase
    .from('api_keys')
    .select('service, key_value, created_at')
    .ilike('service', '%stripe%');

  if (error) {
    console.error('❌ Error:', error);
    return;
  }

  if (!data || data.length === 0) {
    console.log('❌ No Stripe keys found in database');
    console.log('\nYou need to add Stripe test keys:');
    console.log('1. Get test keys from: https://dashboard.stripe.com/test/apikeys');
    console.log('2. Add to Supabase api_keys table:');
    console.log('   - service: "stripe"');
    console.log('   - key_value: "sk_test_..."');
    return;
  }

  console.log('\n✅ Stripe keys found:\n');
  data.forEach(key => {
    const masked = key.key_value.substring(0, 12) + '...' + key.key_value.slice(-4);
    const isTest = key.key_value.includes('_test_');
    const mode = isTest ? '🧪 TEST' : '🔴 LIVE';
    console.log(`${mode} ${key.service}: ${masked}`);
    console.log(`   Added: ${new Date(key.created_at).toLocaleDateString()}`);
  });
}

checkStripe().catch(console.error);
