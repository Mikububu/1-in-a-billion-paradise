/**
 * MODULAR LLM SERVICE
 *
 * Easy switching between providers via environment variable or config.
 * SUPPORTS STREAMING for long-form content (2000+ words) - prevents timeouts!
 *
 * Usage:
 *   import { llm } from './services/llm';
 *   const text = await llm.generate(prompt, 'reading-western');
 *   const longText = await llm.generateStreaming(prompt, 'extended-reading'); // For 2000+ words
 *
 * To switch providers:
 *   - Set LLM_PROVIDER env var to: 'deepseek' | 'claude' | 'openai'
 *   - Or change DEFAULT_PROVIDER below
 */
type LLMProvider = 'deepseek' | 'claude' | 'openai';
export interface TokenUsage {
    inputTokens: number;
    outputTokens: number;
    totalTokens: number;
}
export interface LLMResponse {
    text: string;
    usage: TokenUsage;
    provider: LLMProvider;
    model: string;
    durationMs: number;
}
declare class LLMService {
    private provider;
    private config;
    constructor(provider?: LLMProvider);
    /**
     * Switch provider at runtime
     */
    setProvider(provider: LLMProvider): void;
    /**
     * Get current provider name
     */
    getProvider(): string;
    private lastUsage;
    private lastProvider;
    private lastDurationMs;
    /**
     * Get the last call's token usage (for cost tracking)
     */
    getLastUsage(): {
        usage: TokenUsage;
        provider: LLMProvider;
        durationMs: number;
    } | null;
    /**
     * Generate text from prompt (standard non-streaming)
     */
    generate(prompt: string, label: string, options?: {
        maxTokens?: number;
        temperature?: number;
        maxRetries?: number;
        provider?: LLMProvider;
        systemPrompt?: string;
    }): Promise<string>;
    /**
     * 🚀 STREAMING GENERATION - for long-form content (2000+ words)
     * Uses axios with responseType: 'stream' for reliable streaming
     */
    generateStreaming(prompt: string, label: string, options?: {
        maxTokens?: number;
        temperature?: number;
        onChunk?: (chunk: string) => void;
        systemPrompt?: string;
        provider?: LLMProvider;
        maxRetries?: number;
    }): Promise<string>;
}
declare class FallbackLLMService {
    private primaryProvider;
    private fallbackChain;
    constructor(primaryProvider: LLMProvider, fallbackChain?: LLMProvider[]);
    /**
     * Generate with automatic fallback to next provider on failure
     *
     * Tries each provider in the fallback chain until one succeeds.
     * Each provider gets its own retry attempts before moving to next.
     */
    generateWithFallback(prompt: string, label: string, options?: {
        maxTokens?: number;
        temperature?: number;
        retriesPerProvider?: number;
        systemPrompt?: string;
    }): Promise<{
        text: string;
        provider: LLMProvider;
        usedFallback: boolean;
    }>;
    /**
     * Streaming generation with fallback
     * Note: Fallback only happens before streaming starts. Once streaming begins,
     * a failure mid-stream will not fallback (to avoid partial duplicate content).
     */
    generateStreamingWithFallback(prompt: string, label: string, options?: {
        maxTokens?: number;
        temperature?: number;
        onChunk?: (chunk: string) => void;
        systemPrompt?: string;
    }): Promise<{
        text: string;
        provider: LLMProvider;
        usedFallback: boolean;
    }>;
}
export declare const llm: LLMService;
export declare const llmWithFallback: FallbackLLMService;
export declare const llmPaid: LLMService;
export declare const llmPaidWithFallback: FallbackLLMService;
export type { LLMProvider };
export { FallbackLLMService };
//# sourceMappingURL=llm.d.ts.map