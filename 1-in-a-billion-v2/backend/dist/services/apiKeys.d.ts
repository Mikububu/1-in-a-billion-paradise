/**
 * API KEYS SERVICE
 *
 * Fetches API keys from Supabase api_keys table.
 * Falls back to environment variables if Supabase is unavailable.
 */
/**
 * Get API key from Supabase api_keys table
 * Falls back to environment variable if not found in Supabase
 */
export declare function getApiKey(service: string, envFallback?: string): Promise<string | null>;
/**
 * Clear cache for a specific service (useful for testing)
 */
export declare function clearApiKeyCache(service?: string): void;
/**
 * Preload all common API keys at startup
 */
export declare function preloadApiKeys(): Promise<void>;
//# sourceMappingURL=apiKeys.d.ts.map