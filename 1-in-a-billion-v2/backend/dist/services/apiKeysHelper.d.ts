/**
 * API KEYS HELPER
 *
 * Convenience functions to get API keys with proper service name mapping
 */
/**
 * Get API keys with proper service name mapping from Supabase api_keys table
 */
export declare const apiKeys: {
    deepseek(): Promise<string>;
    claude(): Promise<string>;
    openai(): Promise<string>;
    runpod(): Promise<string>;
    runpodEndpoint(): Promise<string>;
    googlePlaces(): Promise<string | null>;
    flyIo(): Promise<string | null>;
    minimax(): Promise<string>;
    activeTtsProvider(): Promise<"replicate" | "minimax">;
    stripe(): Promise<string | null>;
    resend(): Promise<string | null>;
    replicate(): Promise<string | null>;
};
//# sourceMappingURL=apiKeysHelper.d.ts.map