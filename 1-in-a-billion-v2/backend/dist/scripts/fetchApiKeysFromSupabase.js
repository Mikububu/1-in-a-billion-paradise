"use strict";
/**
 * FETCH API KEYS FROM SUPABASE
 *
 * Queries Supabase to get all API keys from both api_keys and assistant_config tables.
 * This helps verify what keys are available in Supabase.
 */
Object.defineProperty(exports, "__esModule", { value: true });
const supabaseClient_1 = require("../services/supabaseClient");
async function fetchApiKeys() {
    console.log('🔑 Fetching API keys from Supabase...\n');
    const supabase = (0, supabaseClient_1.createSupabaseServiceClient)();
    if (!supabase) {
        console.error('❌ Supabase client not initialized');
        console.log('   Please check your SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env');
        process.exit(1);
    }
    // Try api_keys table first (newer approach)
    console.log('📊 Checking api_keys table...');
    const { data: apiKeysData, error: apiKeysError } = await supabase
        .from('api_keys')
        .select('service, key_name, description, created_at')
        .order('service');
    if (apiKeysError) {
        if (apiKeysError.message?.includes('relation') || apiKeysError.message?.includes('does not exist')) {
            console.log('⚠️  api_keys table does not exist yet\n');
        }
        else {
            console.log(`❌ Error querying api_keys: ${apiKeysError.message}\n`);
        }
    }
    else if (apiKeysData && apiKeysData.length > 0) {
        console.log(`✅ Found ${apiKeysData.length} keys in api_keys table:\n`);
        apiKeysData.forEach((row, i) => {
            console.log(`  ${i + 1}. ${row.service}${row.key_name ? ` (${row.key_name})` : ''}`);
            if (row.description)
                console.log(`     ${row.description}`);
            console.log(`     Created: ${row.created_at}\n`);
        });
    }
    else {
        console.log('⚠️  api_keys table exists but is empty\n');
    }
    // Try assistant_config table (older approach, might still exist)
    console.log('📊 Checking assistant_config table...');
    const { data: assistantConfigData, error: assistantConfigError } = await supabase
        .from('assistant_config')
        .select('key, description')
        .order('key');
    if (assistantConfigError) {
        if (assistantConfigError.message?.includes('relation') || assistantConfigError.message?.includes('does not exist')) {
            console.log('⚠️  assistant_config table does not exist\n');
        }
        else {
            console.log(`❌ Error querying assistant_config: ${assistantConfigError.message}\n`);
        }
    }
    else if (assistantConfigData && assistantConfigData.length > 0) {
        console.log(`✅ Found ${assistantConfigData.length} keys in assistant_config table:\n`);
        assistantConfigData.forEach((row, i) => {
            console.log(`  ${i + 1}. ${row.key}`);
            if (row.description)
                console.log(`     ${row.description}`);
            console.log('');
        });
    }
    else {
        console.log('⚠️  assistant_config table exists but is empty\n');
    }
    // Summary
    console.log('═══════════════════════════════════════════');
    if ((!apiKeysData || apiKeysData.length === 0) && (!assistantConfigData || assistantConfigData.length === 0)) {
        console.log('⚠️  No API keys found in Supabase');
        console.log('\n💡 Next steps:');
        console.log('   1. Create api_keys table (run migration 003_api_keys_storage.sql)');
        console.log('   2. Insert your API keys into the table');
        console.log('   3. Keys will be automatically used by the backend');
    }
    else {
        console.log('✅ API keys are available in Supabase!');
        console.log('   The backend will automatically fetch them when needed.');
    }
}
fetchApiKeys().catch(err => {
    console.error('❌ Failed to fetch API keys:', err);
    process.exit(1);
});
//# sourceMappingURL=fetchApiKeysFromSupabase.js.map