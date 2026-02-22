/**
 * API KEYS HELPER
 * 
 * Convenience functions to get API keys with proper service name mapping
 */

import { getApiKey } from './apiKeys';
import { env } from '../config/env';

/**
 * Get API keys with proper service name mapping from Supabase api_keys table
 */
export const apiKeys = {
  async deepseek(): Promise<string> {
    const key = await getApiKey('deepseek', env.DEEPSEEK_API_KEY);
    if (!key) throw new Error('DeepSeek API key not found');
    return key;
  },

  async claude(): Promise<string> {
    const key = await getApiKey('claude', env.CLAUDE_API_KEY);
    if (!key) throw new Error('Claude API key not found');
    return key;
  },

  async openai(): Promise<string> {
    const key = await getApiKey('openai', env.OPENAI_API_KEY);
    if (!key) throw new Error('OpenAI API key not found');
    return key;
  },

  async runpod(): Promise<string> {
    const key = await getApiKey('runpod', env.RUNPOD_API_KEY);
    if (!key) throw new Error('RunPod API key not found');
    return key;
  },

  async runpodEndpoint(): Promise<string> {
    const key = await getApiKey('runpod_endpoint', env.RUNPOD_ENDPOINT_ID);
    if (!key) throw new Error('RunPod endpoint ID not found');
    return key;
  },

  async googlePlaces(): Promise<string | null> {
    return await getApiKey('google_places', env.GOOGLE_PLACES_API_KEY);
  },

  async flyIo(): Promise<string | null> {
    return await getApiKey('fly_io', process.env.FLY_ACCESS_TOKEN || undefined);
  },

  async minimax(): Promise<string> {
    const key = await getApiKey('minimax', env.MINIMAX_API_KEY);
    if (!key) throw new Error('MiniMax API key not found');
    return key;
  },

  async stripe(): Promise<string | null> {
    return await getApiKey('stripe', process.env.STRIPE_SECRET_KEY || undefined);
  },

  async resend(): Promise<string | null> {
    return await getApiKey('resend', process.env.RESEND_API_KEY || undefined);
  },

  async replicate(): Promise<string | null> {
    return await getApiKey('replicate', env.REPLICATE_API_TOKEN);
  },
};

