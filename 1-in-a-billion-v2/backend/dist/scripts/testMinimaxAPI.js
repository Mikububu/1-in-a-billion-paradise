"use strict";
/**
 * TEST MINIMAX API CAPABILITIES
 *
 * Tests the MiniMax API key to determine:
 * 1. What endpoints are available
 * 2. If music generation is supported
 * 3. What the API key can access
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.testMinimaxAPI = testMinimaxAPI;
const apiKeysHelper_1 = require("../services/apiKeysHelper");
const axios_1 = __importDefault(require("axios"));
// MiniMax has multiple base URLs:
// - api.minimax.chat (for text/chat)
// - platform.minimax.io (for music generation)
const MINIMAX_BASE_URL = 'https://api.minimax.chat';
const MINIMAX_MUSIC_BASE_URL = 'https://platform.minimax.io';
async function testMinimaxAPI() {
    console.log('🧪 Testing MiniMax API capabilities...\n');
    try {
        // Get API key
        const apiKey = await apiKeysHelper_1.apiKeys.minimax();
        console.log('✅ API Key retrieved from Supabase');
        console.log(`   Key prefix: ${apiKey.substring(0, 20)}...\n`);
        // Test 1: Check available endpoints (try common patterns)
        console.log('📡 Testing API endpoints...\n');
        const endpointsToTest = [
            // Music generation endpoints (platform.minimax.io)
            { name: 'Music Generation (platform)', url: `${MINIMAX_MUSIC_BASE_URL}/v1/music_generation`, method: 'POST', baseUrl: MINIMAX_MUSIC_BASE_URL },
            { name: 'Music Generation v1', url: `${MINIMAX_MUSIC_BASE_URL}/v1/music/generate`, method: 'POST', baseUrl: MINIMAX_MUSIC_BASE_URL },
            { name: 'Music 1.5', url: `${MINIMAX_MUSIC_BASE_URL}/v1/music-1.5`, method: 'POST', baseUrl: MINIMAX_MUSIC_BASE_URL },
            // Text/chat endpoints (api.minimax.chat)
            { name: 'Chat Completion', url: `${MINIMAX_BASE_URL}/v1/text/chatcompletion_pro`, method: 'POST', baseUrl: MINIMAX_BASE_URL },
        ];
        for (const endpoint of endpointsToTest) {
            try {
                console.log(`Testing: ${endpoint.name} (${endpoint.url})`);
                // Prepare request data based on endpoint type
                let requestData;
                if (endpoint.name.includes('Music')) {
                    // Music generation request format
                    requestData = {
                        model: 'music-1.5',
                        prompt: 'A dark, poetic song with deep male vocals',
                        lyrics: 'Test lyrics for a dark, poetic song',
                        style: 'dark_poetic',
                        emotion: 'intimate',
                        duration: 60, // seconds
                    };
                }
                else {
                    // Chat completion request
                    requestData = {
                        model: 'abab5.5-chat',
                        messages: [{ role: 'user', content: 'Hello' }],
                    };
                }
                const response = await (0, axios_1.default)({
                    method: endpoint.method,
                    url: endpoint.url,
                    headers: {
                        'Authorization': `Bearer ${apiKey}`,
                        'Content-Type': 'application/json',
                    },
                    data: requestData,
                    validateStatus: () => true, // Don't throw on any status
                    timeout: 30000, // Longer timeout for music generation
                });
                if (response.status === 200 || response.status === 201) {
                    console.log(`   ✅ ${endpoint.name} - SUCCESS (Status: ${response.status})`);
                    if (response.data) {
                        console.log(`   Response keys: ${Object.keys(response.data).join(', ')}`);
                        // For music generation, show more details
                        if (endpoint.name.includes('Music') && response.data.data) {
                            console.log(`   Music data keys: ${Object.keys(response.data.data).join(', ')}`);
                            if (response.data.data.audio_url) {
                                console.log(`   ✅ Audio URL available: ${response.data.data.audio_url.substring(0, 50)}...`);
                            }
                            if (response.data.data.audio_base64) {
                                console.log(`   ✅ Audio Base64 available (length: ${response.data.data.audio_base64.length})`);
                            }
                            if (response.data.data.duration) {
                                console.log(`   Duration: ${response.data.data.duration} seconds`);
                            }
                        }
                    }
                }
                else if (response.status === 401) {
                    console.log(`   ❌ ${endpoint.name} - Authentication failed (invalid key or permissions)`);
                }
                else if (response.status === 404) {
                    console.log(`   ⚠️  ${endpoint.name} - Endpoint not found (may not exist)`);
                }
                else if (response.status === 403) {
                    console.log(`   ⚠️  ${endpoint.name} - Forbidden (key may not have access to this feature)`);
                }
                else {
                    console.log(`   ⚠️  ${endpoint.name} - Status: ${response.status}`);
                    if (response.data?.error) {
                        console.log(`   Error: ${JSON.stringify(response.data.error).substring(0, 100)}`);
                    }
                }
            }
            catch (error) {
                if (error.code === 'ECONNREFUSED' || error.code === 'ENOTFOUND') {
                    console.log(`   ❌ ${endpoint.name} - Connection failed (wrong base URL?)`);
                }
                else if (error.response) {
                    console.log(`   ⚠️  ${endpoint.name} - Status: ${error.response.status}`);
                }
                else {
                    console.log(`   ❌ ${endpoint.name} - Error: ${error.message}`);
                }
            }
            console.log('');
        }
        // Test 2: Try to get API info or list available models
        console.log('📋 Testing API info endpoints...\n');
        const infoEndpoints = [
            { name: 'Models List', url: `${MINIMAX_BASE_URL}/v1/models` },
            { name: 'API Info', url: `${MINIMAX_BASE_URL}/v1/info` },
            { name: 'Capabilities', url: `${MINIMAX_BASE_URL}/v1/capabilities` },
        ];
        for (const endpoint of infoEndpoints) {
            try {
                const response = await (0, axios_1.default)({
                    method: 'GET',
                    url: endpoint.url,
                    headers: {
                        'Authorization': `Bearer ${apiKey}`,
                    },
                    validateStatus: () => true,
                    timeout: 5000,
                });
                if (response.status === 200) {
                    console.log(`✅ ${endpoint.name} - Available`);
                    if (response.data) {
                        console.log(`   Data: ${JSON.stringify(response.data).substring(0, 200)}...`);
                    }
                }
                else {
                    console.log(`⚠️  ${endpoint.name} - Status: ${response.status}`);
                }
            }
            catch (error) {
                console.log(`❌ ${endpoint.name} - ${error.message}`);
            }
            console.log('');
        }
        // Test 3: Check if it's a coding-only API key
        console.log('💻 Testing coding capabilities...\n');
        try {
            const codingResponse = await (0, axios_1.default)({
                method: 'POST',
                url: `${MINIMAX_BASE_URL}/v1/text/chatcompletion_pro`,
                headers: {
                    'Authorization': `Bearer ${apiKey}`,
                    'Content-Type': 'application/json',
                },
                data: {
                    model: 'abab5.5-chat',
                    messages: [
                        { role: 'user', content: 'Write a simple hello world in Python' }
                    ],
                },
                validateStatus: () => true,
                timeout: 10000,
            });
            if (codingResponse.status === 200) {
                console.log('✅ Coding API - Works!');
                console.log('   This API key supports text/chat completion');
            }
            else {
                console.log(`⚠️  Coding API - Status: ${codingResponse.status}`);
            }
        }
        catch (error) {
            console.log(`❌ Coding API - Error: ${error.message}`);
        }
        console.log('\n═══════════════════════════════════════════');
        console.log('📊 Summary:');
        console.log('   Check the results above to see:');
        console.log('   1. Which endpoints are available');
        console.log('   2. If music generation is supported');
        console.log('   3. What capabilities the API key has');
        console.log('\n💡 If music endpoints return 404/403, they may:');
        console.log('   - Not be available via API (UI only)');
        console.log('   - Require a different API key type');
        console.log('   - Need special permissions/plan');
    }
    catch (error) {
        console.error('❌ Test failed:', error.message);
        if (error.response) {
            console.error('   Status:', error.response.status);
            console.error('   Data:', JSON.stringify(error.response.data));
        }
        process.exit(1);
    }
}
// Run if called directly
if (require.main === module) {
    testMinimaxAPI()
        .then(() => {
        console.log('\n🎉 Testing complete!');
        process.exit(0);
    })
        .catch((error) => {
        console.error('❌ Error:', error);
        process.exit(1);
    });
}
//# sourceMappingURL=testMinimaxAPI.js.map