import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';
import * as readline from 'readline';
config();

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

function question(prompt: string): Promise<string> {
  return new Promise(resolve => rl.question(prompt, resolve));
}

async function updateToTest() {
  console.log('\n🔄 Switch to Stripe TEST keys\n');
  console.log('Get your test keys from: https://dashboard.stripe.com/test/apikeys\n');
  
  const secretKey = await question('Enter Stripe TEST Secret Key (sk_test_...): ');
  const publishableKey = await question('Enter Stripe TEST Publishable Key (pk_test_...): ');
  
  if (!secretKey.startsWith('sk_test_') || !publishableKey.startsWith('pk_test_')) {
    console.log('\n❌ Invalid keys! Must start with sk_test_ and pk_test_');
    rl.close();
    return;
  }

  // Update secret key
  const { error: error1 } = await supabase
    .from('api_keys')
    .update({ token: secretKey })
    .eq('service', 'stripe');

  // Update publishable key
  const { error: error2 } = await supabase
    .from('api_keys')
    .update({ token: publishableKey })
    .eq('service', 'stripe_publishable');

  if (error1 || error2) {
    console.error('❌ Error:', error1 || error2);
  } else {
    console.log('\n✅ Updated to TEST keys!');
    console.log('🧪 All payments will now be in TEST mode');
    console.log('💳 Use test cards: 4242 4242 4242 4242');
  }

  rl.close();
}

updateToTest().catch(console.error);
