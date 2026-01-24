import { config } from 'dotenv';
import path from 'path';

// Load .env from backend root directory explicitly
const envPath = path.resolve(__dirname, '../../.env');
console.log('Loading .env from:', envPath);
const result = config({ path: envPath });
console.log('Dotenv result:', result.error ? result.error.message : 'OK, parsed:', Object.keys(result.parsed || {}).length, 'vars');

// NOTE: API keys are now fetched from Supabase api_keys table via getApiKey()
// Environment variables are used as fallback only
// See: src/services/apiKeys.ts

export const env = {
  PORT: Number(process.env.PORT ?? 8787),
  
  // LLM APIs - These will be loaded from Supabase via getApiKey()
  // Fallback to env vars if Supabase is unavailable
  DEEPSEEK_API_KEY: process.env.DEEPSEEK_API_KEY ?? '',
  DEEPSEEK_BASE_URL: process.env.DEEPSEEK_BASE_URL ?? 'https://api.deepseek.com/v1',
  CLAUDE_API_KEY: process.env.CLAUDE_API_KEY ?? '',
  CLAUDE_BASE_URL: process.env.CLAUDE_BASE_URL ?? 'https://api.anthropic.com/v1/messages',
  OPENAI_API_KEY: process.env.OPENAI_API_KEY ?? '',
  OPENAI_BASE_URL: process.env.OPENAI_BASE_URL ?? 'https://api.openai.com/v1/chat/completions',
  OPENAI_MODEL: process.env.OPENAI_MODEL ?? 'gpt-4o',

  // 🎯 ONE LINE TO CHANGE: LLM for all text generation
  // Options: 'claude' | 'deepseek' | 'openai'
  // Change this value or set env var PAID_LLM_PROVIDER
  PAID_LLM_PROVIDER: process.env.PAID_LLM_PROVIDER ?? 'claude',

  // Optional beta protection (OFF unless set)
  // If set, backend requires header: X-BETA-KEY: <value> for /api/jobs/* endpoints
  BETA_KEY: process.env.BETA_KEY ?? '',
  
  // TTS - RunPod Chatterbox (self-hosted, voice cloning)
  // These will be loaded from Supabase via getApiKey()
  RUNPOD_API_KEY: process.env.RUNPOD_API_KEY ?? '',
  RUNPOD_ENDPOINT_ID: process.env.RUNPOD_ENDPOINT_ID ?? '',
  // Safety guard: prevent this backend from scaling the wrong RunPod endpoint if misconfigured.
  // If set, autoscaler will do a GET on the endpoint and refuse to scale unless it matches.
  RUNPOD_ENDPOINT_GUARD_NAME_CONTAINS: process.env.RUNPOD_ENDPOINT_GUARD_NAME_CONTAINS ?? '',
  RUNPOD_ENDPOINT_GUARD_TEMPLATE_ID: process.env.RUNPOD_ENDPOINT_GUARD_TEMPLATE_ID ?? '',
  VOICE_SAMPLE_URL: process.env.VOICE_SAMPLE_URL ?? '',
  
  // TTS - Replicate (Chatterbox Turbo for built-in voices)
  // Used for Turbo preset voices (no voice cloning needed)
  REPLICATE_API_TOKEN: process.env.REPLICATE_API_TOKEN ?? '',
  
  // Chunk size for TTS generation (300 for original Chatterbox, 500 for Turbo)
  CHATTERBOX_CHUNK_SIZE: Number(process.env.CHATTERBOX_CHUNK_SIZE ?? 500),

  
  // Supabase (for Queue V2) - Required for api_keys table access
  SUPABASE_URL: process.env.SUPABASE_URL ?? '',
  SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY ?? '',
  SUPABASE_ANON_KEY: process.env.SUPABASE_ANON_KEY ?? '',

  // Admin Panel (V0 bridge): internal operations triggered from admin-panel server-side
  // Requires header: x-admin-secret: <ADMIN_PANEL_SECRET>
  ADMIN_PANEL_SECRET: process.env.ADMIN_PANEL_SECRET ?? '',
  
  // Feature Flags
  SUPABASE_QUEUE_ENABLED: process.env.SUPABASE_QUEUE_ENABLED === 'true',
  SUPABASE_QUEUE_ROLLOUT_PERCENT: Number(process.env.SUPABASE_QUEUE_ROLLOUT_PERCENT ?? 0),
  
  // Worker Configuration
  WORKER_ID: process.env.WORKER_ID ?? '',
  WORKER_MAX_CONCURRENT_TASKS: Number(process.env.WORKER_MAX_CONCURRENT_TASKS ?? 5),
  WORKER_POLLING_INTERVAL_MS: Number(process.env.WORKER_POLLING_INTERVAL_MS ?? 5000),
  WORKER_MAX_POLLING_INTERVAL_MS: Number(process.env.WORKER_MAX_POLLING_INTERVAL_MS ?? 30000),
  
  // Storage
  AUDIO_BUCKET_URL: process.env.AUDIO_BUCKET_URL ?? '',
  
  // Google Places API (for city search) - Will be loaded from Supabase via getApiKey()
  GOOGLE_PLACES_API_KEY: process.env.GOOGLE_PLACES_API_KEY ?? '',
  
  // Google AI Studio API (for portrait generation) - Will be loaded from Supabase via getApiKey()
  GOOGLE_AI_STUDIO_API_KEY: process.env.GOOGLE_AI_STUDIO_API_KEY ?? '',
  
  // Frontend URL for email redirects
  FRONTEND_URL: process.env.FRONTEND_URL ?? 'oneinabillion://auth',
  
  // Development mode - bypasses email confirmation for testing
  // Set to 'true' to auto-confirm emails (DEV ONLY - never in production!)
  DEV_AUTO_CONFIRM_EMAIL: process.env.DEV_AUTO_CONFIRM_EMAIL === 'true',
  
  // MiniMax API (for music/song generation) - Will be loaded from Supabase via getApiKey()
  MINIMAX_API_KEY: process.env.MINIMAX_API_KEY ?? '',

  // Writing Lens: Tragic Realism (global, applies to hook + deep + overlays).
  // Kill-switch: set TRAGIC_REALISM_LEVEL=0 to disable instantly.
  // Levels:
  // - 0: off (legacy tone)
  // - 1: subtle
  // - 2: clear
  // - 3: mythic / destiny-forward (Michael's preference)
  TRAGIC_REALISM_LEVEL: Math.max(0, Math.min(3, Number(process.env.TRAGIC_REALISM_LEVEL ?? 3))),
};
