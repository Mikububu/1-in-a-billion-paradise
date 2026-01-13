import { config } from 'dotenv';
import { join } from 'path';

config({ path: join(__dirname, '.env') });

async function checkFlyIoSupabaseAccess() {
  console.log('🔍 Checking Supabase access configuration for Fly.io...\n');

  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const runpodEndpointId = process.env.RUNPOD_ENDPOINT_ID;
  const runpodApiKey = process.env.RUNPOD_API_KEY;

  console.log('1. Environment Variables (Local .env):');
  if (supabaseUrl) {
    console.log(`   ✅ SUPABASE_URL: ${supabaseUrl.substring(0, 30)}...`);
  } else {
    console.log(`   ❌ SUPABASE_URL: NOT SET`);
  }

  if (supabaseServiceRoleKey) {
    console.log(`   ✅ SUPABASE_SERVICE_ROLE_KEY: ${supabaseServiceRoleKey.substring(0, 20)}...`);
  } else {
    console.log(`   ❌ SUPABASE_SERVICE_ROLE_KEY: NOT SET`);
    console.log(`   ⚠️  This is CRITICAL - workers need this to access Supabase api_keys table!`);
  }

  if (runpodEndpointId) {
    console.log(`   ✅ RUNPOD_ENDPOINT_ID: ${runpodEndpointId}`);
  } else {
    console.log(`   ❌ RUNPOD_ENDPOINT_ID: NOT SET`);
  }

  if (runpodApiKey) {
    console.log(`   ✅ RUNPOD_API_KEY: ${runpodApiKey.substring(0, 10)}...`);
  } else {
    console.log(`   ❌ RUNPOD_API_KEY: NOT SET`);
  }

  console.log('\n2. What happens on Fly.io:');
  console.log('   The audio worker on Fly.io needs:');
  console.log('   - SUPABASE_SERVICE_ROLE_KEY: To query api_keys table');
  console.log('   - RUNPOD_ENDPOINT_ID: As fallback if Supabase lookup fails');
  console.log('   - RUNPOD_API_KEY: As fallback if Supabase lookup fails');
  
  console.log('\n3. How getApiKey() works:');
  console.log('   Step 1: Try Supabase api_keys table (requires SUPABASE_SERVICE_ROLE_KEY)');
  console.log('   Step 2: If Supabase fails, try assistant_config table');
  console.log('   Step 3: If both fail, fallback to environment variable');
  
  console.log('\n4. The Problem:');
  if (!supabaseServiceRoleKey) {
    console.log('   ❌ SUPABASE_SERVICE_ROLE_KEY is missing!');
    console.log('   → getApiKey() cannot query Supabase');
    console.log('   → Falls back to environment variables');
    if (!runpodEndpointId) {
      console.log('   ❌ RUNPOD_ENDPOINT_ID is also missing!');
      console.log('   → Result: undefined endpoint ID → 404 error');
    }
  } else {
    console.log('   ✅ SUPABASE_SERVICE_ROLE_KEY is set locally');
    console.log('   ⚠️  But on Fly.io, it might not be set!');
  }

  console.log('\n💡 SOLUTION:');
  console.log('   Check Fly.io secrets:');
  console.log('   flyctl secrets list -a 1-in-a-billion-backend');
  console.log('\n   If SUPABASE_SERVICE_ROLE_KEY is missing, set it:');
  console.log('   flyctl secrets set SUPABASE_SERVICE_ROLE_KEY=your-key -a 1-in-a-billion-backend');
  console.log('\n   If RUNPOD_ENDPOINT_ID is missing (as fallback), set it:');
  console.log('   flyctl secrets set RUNPOD_ENDPOINT_ID=90dt1bkdj3y08r -a 1-in-a-billion-backend');
}

checkFlyIoSupabaseAccess().catch(err => {
  console.error('❌ Fatal error:', err);
  process.exit(1);
});
