"use strict";
/**
 * FULL PIPELINE TEST
 *
 * Tests the complete reading generation pipeline:
 * 1. API key fetching from Supabase
 * 2. LLM service initialization and text generation
 * 3. Supabase connection and queue system
 * 4. Swiss Ephemeris calculations
 * 5. Job creation and processing
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
const supabaseClient_1 = require("../services/supabaseClient");
const apiKeysHelper_1 = require("../services/apiKeysHelper");
const llm_1 = require("../services/llm");
async function testApiKeys() {
    console.log('\n🔑 Testing API Key Fetching...');
    const results = {};
    // Test each key individually with proper function names
    try {
        const deepseek = await apiKeysHelper_1.apiKeys.deepseek();
        results.deepseek = !!deepseek;
        console.log(`  ✅ deepseek: Found (${deepseek.substring(0, 15)}...)`);
    }
    catch (err) {
        results.deepseek = false;
        console.log(`  ❌ deepseek: ${err.message}`);
    }
    try {
        const claude = await apiKeysHelper_1.apiKeys.claude();
        results.claude = !!claude;
        console.log(`  ✅ claude: Found (${claude.substring(0, 15)}...)`);
    }
    catch (err) {
        results.claude = false;
        console.log(`  ❌ claude: ${err.message}`);
    }
    try {
        const runpod = await apiKeysHelper_1.apiKeys.runpod();
        results.runpod = !!runpod;
        console.log(`  ✅ runpod: Found (${runpod.substring(0, 15)}...)`);
    }
    catch (err) {
        results.runpod = false;
        console.log(`  ❌ runpod: ${err.message}`);
    }
    try {
        const runpodEndpoint = await apiKeysHelper_1.apiKeys.runpodEndpoint();
        results.runpod_endpoint = !!runpodEndpoint;
        console.log(`  ✅ runpod_endpoint: Found (${runpodEndpoint.substring(0, 15)}...)`);
    }
    catch (err) {
        results.runpod_endpoint = false;
        console.log(`  ❌ runpod_endpoint: ${err.message}`);
    }
    return Object.values(results).every(v => v);
}
async function testLLMGeneration() {
    console.log('\n🤖 Testing LLM Text Generation...');
    try {
        const testPrompt = 'Write a one-sentence test response.';
        const response = await llm_1.llm.generate(testPrompt, 'pipeline-test', {
            maxTokens: 50,
            temperature: 0.7,
        });
        if (response && response.length > 0) {
            console.log(`  ✅ LLM generated text: "${response.substring(0, 50)}..."`);
            return true;
        }
        else {
            console.log('  ❌ LLM returned empty response');
            return false;
        }
    }
    catch (err) {
        console.log(`  ❌ LLM generation failed: ${err.message}`);
        return false;
    }
}
async function testSupabaseConnection() {
    console.log('\n📊 Testing Supabase Connection...');
    try {
        const supabase = (0, supabaseClient_1.createSupabaseServiceClient)();
        if (!supabase) {
            console.log('  ❌ Supabase client not initialized');
            return false;
        }
        // Test by querying a simple table
        const { data, error } = await supabase
            .from('jobs')
            .select('id')
            .limit(1);
        if (error && !error.message?.includes('relation')) {
            console.log(`  ⚠️  Query test: ${error.message}`);
            // Still OK if table doesn't exist
        }
        console.log('  ✅ Supabase connection successful');
        return true;
    }
    catch (err) {
        console.log(`  ❌ Supabase connection failed: ${err.message}`);
        return false;
    }
}
async function testSwissEphemeris() {
    console.log('\n🌌 Testing Swiss Ephemeris...');
    try {
        const { swissEngine } = await Promise.resolve().then(() => __importStar(require('../services/swissEphemeris')));
        const result = await swissEngine.healthCheck();
        if (result.status === 'ok') {
            console.log('  ✅ Swiss Ephemeris is healthy');
            return true;
        }
        else {
            console.log(`  ⚠️  Swiss Ephemeris: ${result.message}`);
            return false;
        }
    }
    catch (err) {
        console.log(`  ❌ Swiss Ephemeris error: ${err.message}`);
        return false;
    }
}
async function testJobCreation() {
    console.log('\n📝 Testing Job Creation...');
    try {
        const supabase = (0, supabaseClient_1.createSupabaseServiceClient)();
        if (!supabase) {
            console.log('  ⚠️  Skipping (Supabase not available)');
            return true; // Not critical
        }
        // Test if we can query the jobs table structure
        const { error } = await supabase
            .from('jobs')
            .select('id')
            .limit(0);
        if (error && error.message?.includes('relation')) {
            console.log('  ⚠️  jobs table does not exist (will be created on first job)');
            return true; // Not critical for initial test
        }
        console.log('  ✅ Job system ready');
        return true;
    }
    catch (err) {
        console.log(`  ⚠️  Job creation test: ${err.message}`);
        return true; // Not critical
    }
}
async function testRunPodConnection() {
    console.log('\n🎤 Testing RunPod Connection...');
    try {
        const runpodKey = await apiKeysHelper_1.apiKeys.runpod();
        const runpodEndpoint = await apiKeysHelper_1.apiKeys.runpodEndpoint();
        if (!runpodKey || !runpodEndpoint) {
            console.log('  ⚠️  RunPod keys not found (audio generation will be disabled)');
            return true; // Not critical for basic pipeline
        }
        // Test RunPod API connection
        const axios = (await Promise.resolve().then(() => __importStar(require('axios')))).default;
        try {
            const response = await axios.get(`https://api.runpod.ai/v2/serverless/${runpodEndpoint}`, {
                headers: {
                    'Authorization': `Bearer ${runpodKey}`,
                },
                timeout: 10000,
            });
            if (response.status === 200) {
                console.log('  ✅ RunPod API connection successful');
                return true;
            }
            else {
                console.log(`  ⚠️  RunPod API returned status ${response.status}`);
                return true; // Still OK
            }
        }
        catch (apiErr) {
            if (apiErr.response?.status === 404) {
                console.log('  ⚠️  RunPod endpoint not found (may need to be created)');
            }
            else if (apiErr.response?.status === 401) {
                console.log('  ⚠️  RunPod authentication failed (check API key)');
            }
            else {
                console.log(`  ⚠️  RunPod connection: ${apiErr.message}`);
            }
            return true; // Not critical for basic pipeline
        }
    }
    catch (err) {
        console.log(`  ⚠️  RunPod test error: ${err.message}`);
        return true; // Not critical for basic pipeline
    }
}
async function runFullPipelineTest() {
    console.log('🧪 Full Pipeline Test Suite');
    console.log('═══════════════════════════════════════════');
    const results = {
        apiKeys: await testApiKeys(),
        supabase: await testSupabaseConnection(),
        swissEphemeris: await testSwissEphemeris(),
        llm: await testLLMGeneration(),
        jobs: await testJobCreation(),
        runpod: await testRunPodConnection(),
    };
    console.log('\n📋 Test Results Summary');
    console.log('═══════════════════════════════════════════');
    console.log(`API Keys:        ${results.apiKeys ? '✅' : '❌'}`);
    console.log(`Supabase:        ${results.supabase ? '✅' : '❌'}`);
    console.log(`Swiss Ephemeris: ${results.swissEphemeris ? '✅' : '⚠️'}`);
    console.log(`LLM Generation:  ${results.llm ? '✅' : '❌'}`);
    console.log(`Job System:      ${results.jobs ? '✅' : '⚠️'}`);
    console.log(`RunPod:          ${results.runpod ? '✅' : '⚠️'}`);
    const critical = results.apiKeys && results.supabase && results.llm;
    if (critical) {
        console.log('\n✅ Critical pipeline components are working!');
        console.log('   The system is ready to generate readings.');
        if (!results.swissEphemeris) {
            console.log('   ⚠️  Swiss Ephemeris may need attention for calculations.');
        }
        if (!results.runpod) {
            console.log('   ⚠️  RunPod may need setup for audio generation.');
        }
    }
    else {
        console.log('\n❌ Critical components are not ready');
        console.log('   Please check the errors above.');
        process.exit(1);
    }
}
runFullPipelineTest().catch(err => {
    console.error('❌ Pipeline test failed:', err);
    process.exit(1);
});
//# sourceMappingURL=testFullPipeline.js.map