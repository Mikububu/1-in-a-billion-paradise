import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';
config();

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function switchToLive() {
  console.log('\n⚠️  WARNING: Switching to LIVE Stripe keys!\n');
  console.log('This will enable REAL PAYMENTS with REAL MONEY.');
  console.log('Only do this when you are ready for production.\n');
  
  // Get your LIVE keys from: https://dashboard.stripe.com/apikeys
  const liveSecret = 'PASTE_YOUR_sk_live_KEY_HERE';
  const livePublishable = 'PASTE_YOUR_pk_live_KEY_HERE';
  
  if (liveSecret.includes('PASTE') || livePublishable.includes('PASTE')) {
    console.log('❌ ERROR: You need to edit this file first!');
    console.log('1. Go to: https://dashboard.stripe.com/apikeys');
    console.log('2. Copy your LIVE keys (sk_live_... and pk_live_...)');
    console.log('3. Replace the PASTE_YOUR placeholders in this file');
    console.log('4. Run again');
    return;
  }

  const { error: e1 } = await supabase
    .from('api_keys')
    .update({ token: liveSecret })
    .eq('service', 'stripe');

  const { error: e2 } = await supabase
    .from('api_keys')
    .update({ token: livePublishable })
    .eq('service', 'stripe_publishable');

  if (e1 || e2) {
    console.error('❌ Error:', e1 || e2);
    return;
  }

  console.log('✅ Switched to LIVE keys!');
  console.log('💰 Real payments are now ENABLED');
  console.log('🚨 Customers will be charged real money\n');
}

switchToLive().catch(console.error);
