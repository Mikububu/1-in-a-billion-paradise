/**
 * LLM PROVIDER CONFIGURATION
 *
 * Maps each reading system to its LLM provider.
 *
 * NOTE: Currently all systems use the same provider (configured in env.ts PAID_LLM_PROVIDER)
 * This file remains for future per-system configuration if needed.
 *
 * Available providers: 'claude' | 'deepseek' | 'openai'
 */
export type LLMProviderName = 'claude' | 'deepseek' | 'openai';
export type ReadingSystem = 'western' | 'vedic' | 'human_design' | 'gene_keys' | 'kabbalah' | 'verdict';
/**
 * System to provider mapping
 *
 * Current config: All systems use 'claude' (actual LLM configured in env.ts)
 */
export declare const SYSTEM_LLM_PROVIDERS: Record<ReadingSystem, LLMProviderName>;
/**
 * Get the LLM provider for a given system
 */
export declare function getProviderForSystem(system: string): LLMProviderName;
/**
 * Check if a system should use Claude (paid/premium LLM)
 */
export declare function shouldUseClaude(system: string): boolean;
/**
 * Check if a system should use OpenAI
 */
export declare function shouldUseOpenAI(system: string): boolean;
//# sourceMappingURL=llmProviders.d.ts.map