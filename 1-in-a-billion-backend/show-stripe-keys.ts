import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';
config();

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function showStripe() {
  const { data } = await supabase
    .from('api_keys')
    .select('*')
    .ilike('service', '%stripe%');

  if (!data || data.length === 0) {
    console.log('❌ No Stripe keys');
    return;
  }

  console.log('\n🔑 Current Stripe Configuration:\n');
  data.forEach((key: any) => {
    const token = key.token || '';
    const masked = token ? token.substring(0, 15) + '...' + token.slice(-6) : 'NOT SET';
    const isTest = token.includes('_test_');
    const mode = isTest ? '🧪 TEST MODE (Safe for TestFlight)' : '🔴 LIVE MODE (Real charges!)';
    
    console.log(`${mode}`);
    console.log(`Service: ${key.service}`);
    console.log(`Key: ${masked}`);
    console.log(`Description: ${key.description || 'N/A'}`);
    console.log('');
  });

  const hasTest = data.some((k: any) => k.token?.includes('_test_'));
  
  if (!hasTest) {
    console.log('\n⚠️  WARNING: You have LIVE Stripe keys configured!');
    console.log('For App Store testing, you should use TEST keys.\n');
    console.log('📝 To add TEST keys:');
    console.log('1. Go to: https://dashboard.stripe.com/test/apikeys');
    console.log('2. Copy "Secret key" (sk_test_...)');
    console.log('3. Copy "Publishable key" (pk_test_...)');
    console.log('4. Update api_keys table in Supabase');
  }
}

showStripe().catch(console.error);
