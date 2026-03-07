"use strict";
/**
 * API KEYS HELPER
 *
 * Convenience functions to get API keys with proper service name mapping
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.apiKeys = void 0;
const apiKeys_1 = require("./apiKeys");
const env_1 = require("../config/env");
/**
 * Get API keys with proper service name mapping from Supabase api_keys table
 */
exports.apiKeys = {
    async deepseek() {
        const key = await (0, apiKeys_1.getApiKey)('deepseek', env_1.env.DEEPSEEK_API_KEY);
        if (!key)
            throw new Error('DeepSeek API key not found');
        return key;
    },
    async claude() {
        const key = await (0, apiKeys_1.getApiKey)('claude', env_1.env.CLAUDE_API_KEY);
        if (!key)
            throw new Error('Claude API key not found');
        return key;
    },
    async openai() {
        const key = await (0, apiKeys_1.getApiKey)('openai', env_1.env.OPENAI_API_KEY);
        if (!key)
            throw new Error('OpenAI API key not found');
        return key;
    },
    async runpod() {
        const key = await (0, apiKeys_1.getApiKey)('runpod', env_1.env.RUNPOD_API_KEY);
        if (!key)
            throw new Error('RunPod API key not found');
        return key;
    },
    async runpodEndpoint() {
        const key = await (0, apiKeys_1.getApiKey)('runpod_endpoint', env_1.env.RUNPOD_ENDPOINT_ID);
        if (!key)
            throw new Error('RunPod endpoint ID not found');
        return key;
    },
    async googlePlaces() {
        return await (0, apiKeys_1.getApiKey)('google_places', env_1.env.GOOGLE_PLACES_API_KEY);
    },
    async flyIo() {
        return await (0, apiKeys_1.getApiKey)('fly_io', process.env.FLY_ACCESS_TOKEN || undefined);
    },
    async minimax() {
        const key = await (0, apiKeys_1.getApiKey)('minimax', env_1.env.MINIMAX_API_KEY);
        if (!key)
            throw new Error('MiniMax API key not found');
        return key;
    },
    async activeTtsProvider() {
        const val = await (0, apiKeys_1.getApiKey)('active_tts_provider');
        if (val === 'replicate')
            return 'replicate';
        return 'minimax'; // Default to minimax
    },
    async stripe() {
        return await (0, apiKeys_1.getApiKey)('stripe', process.env.STRIPE_SECRET_KEY || undefined);
    },
    async resend() {
        return await (0, apiKeys_1.getApiKey)('resend', process.env.RESEND_API_KEY || undefined);
    },
    async replicate() {
        return await (0, apiKeys_1.getApiKey)('replicate', env_1.env.REPLICATE_API_TOKEN);
    },
};
//# sourceMappingURL=apiKeysHelper.js.map