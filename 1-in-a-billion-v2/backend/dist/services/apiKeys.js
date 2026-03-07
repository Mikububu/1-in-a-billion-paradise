"use strict";
/**
 * API KEYS SERVICE
 *
 * Fetches API keys from Supabase api_keys table.
 * Falls back to environment variables if Supabase is unavailable.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.getApiKey = getApiKey;
exports.clearApiKeyCache = clearApiKeyCache;
exports.preloadApiKeys = preloadApiKeys;
const supabaseClient_1 = require("./supabaseClient");
// Cache API keys for 5 minutes to avoid excessive DB queries
const CACHE_TTL_MS = 5 * 60 * 1000;
const cache = {};
/**
 * Get API key from Supabase api_keys table
 * Falls back to environment variable if not found in Supabase
 */
async function getApiKey(service, envFallback) {
    // Check cache first
    const cached = cache[service];
    if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
        return cached.value;
    }
    // Try Supabase first - check both api_keys and assistant_config tables
    try {
        const supabase = (0, supabaseClient_1.createSupabaseServiceClient)();
        if (supabase) {
            // First try api_keys table (newer approach).
            // Use limit(1) instead of single(): some installs may keep multiple rows per service.
            const serviceCandidates = service === 'claude'
                ? ['claude', 'anthropic']
                : service === 'anthropic'
                    ? ['anthropic', 'claude']
                    : service === 'replicate'
                        ? ['replicate', 'REPLICATE_API_TOKEN', 'replicate_api']
                        : [service];
            for (const serviceName of serviceCandidates) {
                const { data: apiKeysData, error: apiKeysError } = await supabase
                    .from('api_keys')
                    .select('token')
                    .eq('service', serviceName)
                    .limit(1);
                const token = Array.isArray(apiKeysData) ? apiKeysData[0]?.token : null;
                if (!apiKeysError && token) {
                    cache[service] = {
                        value: token,
                        timestamp: Date.now(),
                    };
                    console.log(`✅ [API Keys] Loaded ${service} from Supabase api_keys table (${serviceName})`);
                    return token;
                }
            }
            // If not found in api_keys, try assistant_config table (older approach)
            // Map service names to assistant_config key names
            const keyMapping = {
                'deepseek': 'DEEPSEEK_API_KEY',
                'claude': 'ANTHROPIC_API_KEY',
                'anthropic': 'ANTHROPIC_API_KEY',
                'openai': 'OPENAI_API_KEY',
                'runpod': 'RUNPOD_API_KEY',
                'runpod_endpoint': 'RUNPOD_ENDPOINT_ID',
                'google_places': 'GOOGLE_PLACES_API_KEY',
                'fly_io': 'FLY_ACCESS_TOKEN', // Fly.io deployment token
                'minimax': 'MINIMAX_API_KEY', // MiniMax API for music generation
                'resend': 'RESEND_API_KEY', // Resend API for email notifications
                'revenuecat_secret': 'REVENUECAT_SECRET_KEY', // RevenueCat secret - webhook Authorization: Bearer <key>
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
    }
    catch (err) {
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
    }
    else {
        console.warn(`⚠️ [API Keys] No key found for ${service} (Supabase or env)`);
    }
    return envValue;
}
/**
 * Clear cache for a specific service (useful for testing)
 */
function clearApiKeyCache(service) {
    if (service) {
        delete cache[service];
    }
    else {
        Object.keys(cache).forEach(key => delete cache[key]);
    }
}
/**
 * Preload all common API keys at startup
 */
async function preloadApiKeys() {
    const services = [
        'deepseek',
        'claude',
        'openai',
        'runpod',
        'runpod_endpoint',
        'google_places',
        'google_ai_studio',
        'minimax',
        'active_tts_provider',
        'revenuecat_secret',
    ];
    console.log('🔄 [API Keys] Preloading keys from Supabase...');
    await Promise.all(services.map(service => getApiKey(service)));
    console.log('✅ [API Keys] Preload complete');
}
//# sourceMappingURL=apiKeys.js.map