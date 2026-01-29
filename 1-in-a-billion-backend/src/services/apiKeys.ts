/**
 * API KEYS SERVICE
 * 
 * Fetches API keys from Supabase api_keys table.
 * Falls back to environment variables if Supabase is unavailable.
 */

import { createSupabaseServiceClient } from './supabaseClient';

interface ApiKeyCache {
  [service: string]: {
    value: string | null;
    timestamp: number;
  };
}

// Cache API keys for 5 minutes to avoid excessive DB queries
const CACHE_TTL_MS = 5 * 60 * 1000;
const cache: ApiKeyCache = {};

/**
 * Get API key from Supabase api_keys table
 * Falls back to environment variable if not found in Supabase
 */
export async function getApiKey(
  service: string,
  envFallback?: string
): Promise<string | null> {
  // Check cache first
  const cached = cache[service];
  if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
    return cached.value;
  }

  // Try Supabase first - check both api_keys and assistant_config tables
  try {
    const supabase = createSupabaseServiceClient();
    if (supabase) {
      // First try api_keys table (newer approach)
      const { data: apiKeysData, error: apiKeysError } = await supabase
        .from('api_keys')
        .select('token')
        .eq('service', service)
        .single();

      if (!apiKeysError && apiKeysData?.token) {
        cache[service] = {
          value: apiKeysData.token,
          timestamp: Date.now(),
        };
        console.log(`✅ [API Keys] Loaded ${service} from Supabase api_keys table`);
        return apiKeysData.token;
      }

      // If not found in api_keys, try assistant_config table (older approach)
      // Map service names to assistant_config key names
      const keyMapping: Record<string, string> = {
        'deepseek': 'DEEPSEEK_API_KEY',
        'claude': 'ANTHROPIC_API_KEY',
        'openai': 'OPENAI_API_KEY',
        'runpod': 'RUNPOD_API_KEY',
        'runpod_endpoint': 'RUNPOD_ENDPOINT_ID',
        'google_places': 'GOOGLE_PLACES_API_KEY',
        'fly_io': 'FLY_ACCESS_TOKEN', // Fly.io deployment token
        'minimax': 'MINIMAX_API_KEY', // MiniMax API for music generation
        'resend': 'RESEND_API_KEY', // Resend API for email notifications
        'revenuecat_secret': 'REVENUECAT_SECRET_KEY', // RevenueCat secret – webhook Authorization: Bearer <key>
      };

      const configKey = keyMapping[service];
      if (configKey) {
        const { data: configData, error: configError } = await supabase
          .from('assistant_config')
          .select('value')
          .eq('key', configKey)
          .single();

        if (!configError && configData?.value) {
          cache[service] = {
            value: configData.value,
            timestamp: Date.now(),
          };
          console.log(`✅ [API Keys] Loaded ${service} from Supabase assistant_config table`);
          return configData.value;
        }
      }
    }
  } catch (err: any) {
    // Table might not exist yet - that's OK, fallback to .env
    if (!err.message?.includes('PGRST205') && !err.message?.includes('relation')) {
      console.warn(`⚠️ [API Keys] Supabase lookup failed for ${service}:`, err.message);
    }
  }

  // Fallback to environment variable (passed as parameter)
  const envValue = envFallback || null;
  if (envValue) {
    cache[service] = {
      value: envValue,
      timestamp: Date.now(),
    };
    console.log(`✅ [API Keys] Loaded ${service} from environment`);
  } else {
    cache[service] = {
      value: null,
      timestamp: Date.now(),
    };
    console.warn(`⚠️ [API Keys] No key found for ${service} (Supabase or env)`);
  }

  return envValue;
}

/**
 * Clear cache for a specific service (useful for testing)
 */
export function clearApiKeyCache(service?: string) {
  if (service) {
    delete cache[service];
  } else {
    Object.keys(cache).forEach(key => delete cache[key]);
  }
}

/**
 * Preload all common API keys at startup
 */
export async function preloadApiKeys() {
  const services = [
    'deepseek',
    'claude',
    'openai',
    'runpod',
    'runpod_endpoint',
    'google_places',
    'minimax',
    'revenuecat_secret',
  ];

  console.log('🔄 [API Keys] Preloading keys from Supabase...');
  await Promise.all(
    services.map(service => getApiKey(service))
  );
  console.log('✅ [API Keys] Preload complete');
}

