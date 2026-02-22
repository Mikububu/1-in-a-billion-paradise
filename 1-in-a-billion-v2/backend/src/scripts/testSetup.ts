/**
 * TEST SETUP SCRIPT
 * 
 * Tests backend setup and configuration:
 * - Supabase connection
 * - API key fetching
 * - LLM service initialization
 * - All critical services
 */

import { createSupabaseServiceClient } from '../services/supabaseClient';
import { getApiKey, preloadApiKeys } from '../services/apiKeys';
import { env } from '../config/env';

async function testSupabaseConnection() {
  console.log('\n📊 Testing Supabase Connection...');
  try {
    const supabase = createSupabaseServiceClient();
    if (!supabase) {
      console.log('❌ Supabase client not initialized (missing credentials)');
      return false;
    }

    // Test connection by querying a simple table
    const { data, error } = await supabase
      .from('api_keys')
      .select('service')
      .limit(1);

    if (error) {
      if (error.message?.includes('relation') || error.message?.includes('does not exist') || error.message?.includes('schema cache')) {
        console.log('⚠️  api_keys table does not exist yet');
        console.log('   💡 Run migration: npm run apply-migration 003_api_keys_storage.sql');
        console.log('   💡 Or create table manually in Supabase Dashboard');
        return true; // Not a critical error - will use env fallback
      }
      console.log('❌ Supabase query failed:', error.message);
      return false;
    }

    console.log('✅ Supabase connection successful');
    console.log(`   Found ${data?.length || 0} API keys in database`);
    return true;
  } catch (err: any) {
    console.log('❌ Supabase connection error:', err.message);
    return false;
  }
}

async function testApiKeyFetching() {
  console.log('\n🔑 Testing API Key Fetching...');
  const services = ['deepseek', 'claude', 'runpod', 'runpod_endpoint'];
  let successCount = 0;

  for (const service of services) {
    try {
      const key = await getApiKey(service);
      if (key) {
        console.log(`✅ ${service}: Found (${key.substring(0, 8)}...)`);
        successCount++;
      } else {
        console.log(`⚠️  ${service}: Not found (will use env fallback if available)`);
      }
    } catch (err: any) {
      console.log(`❌ ${service}: Error - ${err.message}`);
    }
  }

  return successCount > 0;
}

async function testLLMService() {
  console.log('\n🤖 Testing LLM Service...');
  try {
    const { llm } = await import('../services/llm');
    const provider = llm.getProvider();
    console.log(`✅ LLM Service initialized: ${provider}`);
    
    // Test that headers can be generated (this will fetch keys)
    try {
      const headers = await llm['config'].getHeaders();
      if (headers && Object.keys(headers).length > 0) {
        console.log('✅ LLM headers generated successfully');
        return true;
      }
    } catch (err: any) {
      if (err.message?.includes('not found')) {
        console.log('⚠️  LLM key not found (will fail on actual generation)');
        return false;
      }
      throw err;
    }
  } catch (err: any) {
    console.log('❌ LLM Service error:', err.message);
    return false;
  }
  return false;
}

async function testEnvironment() {
  console.log('\n🌍 Testing Environment Configuration...');
  const required = [
    'SUPABASE_URL',
    'SUPABASE_SERVICE_ROLE_KEY',
  ];

  const optional = [
    'DEEPSEEK_API_KEY',
    'CLAUDE_API_KEY',
    'RUNPOD_API_KEY',
    'RUNPOD_ENDPOINT_ID',
  ];

  let allRequired = true;
  for (const key of required) {
    const value = env[key as keyof typeof env];
    if (value) {
      console.log(`✅ ${key}: Set`);
    } else {
      console.log(`❌ ${key}: Missing (REQUIRED)`);
      allRequired = false;
    }
  }

  console.log('\n   Optional keys:');
  for (const key of optional) {
    const value = env[key as keyof typeof env];
    if (value) {
      console.log(`   ✅ ${key}: Set (fallback available)`);
    } else {
      console.log(`   ⚠️  ${key}: Not set (will try Supabase)`);
    }
  }

  return allRequired;
}

async function runTests() {
  console.log('🧪 Backend Setup Test Suite');
  console.log('═══════════════════════════════════════════');

  const results = {
    environment: await testEnvironment(),
    supabase: await testSupabaseConnection(),
    apiKeys: await testApiKeyFetching(),
    llm: await testLLMService(),
  };

  console.log('\n📋 Test Results Summary');
  console.log('═══════════════════════════════════════════');
  console.log(`Environment: ${results.environment ? '✅' : '❌'}`);
  console.log(`Supabase:    ${results.supabase ? '✅' : '❌'}`);
  console.log(`API Keys:    ${results.apiKeys ? '✅' : '⚠️'}`);
  console.log(`LLM Service: ${results.llm ? '✅' : '⚠️'}`);

  const allCritical = results.environment && results.supabase;
  if (allCritical) {
    console.log('\n✅ Critical services are ready!');
    console.log('⚠️  Some optional services may need API keys in Supabase');
  } else {
    console.log('\n❌ Critical services are not ready');
    console.log('   Please check your .env file and Supabase configuration');
    process.exit(1);
  }
}

// Run tests
runTests().catch(err => {
  console.error('❌ Test suite failed:', err);
  process.exit(1);
});

