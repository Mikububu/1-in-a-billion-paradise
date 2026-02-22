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

export type ReadingSystem = 
  | 'western'
  | 'vedic'
  | 'human_design'
  | 'gene_keys'
  | 'kabbalah'
  | 'verdict';

/**
 * System to provider mapping
 * 
 * Current config: All systems use 'claude' (actual LLM configured in env.ts)
 */
export const SYSTEM_LLM_PROVIDERS: Record<ReadingSystem, LLMProviderName> = {
  western: 'claude',
  vedic: 'claude',
  human_design: 'claude',
  gene_keys: 'claude',
  kabbalah: 'claude',
  verdict: 'claude',
};

/**
 * Get the LLM provider for a given system
 */
export function getProviderForSystem(system: string): LLMProviderName {
  const normalized = system.toLowerCase().replace(/-/g, '_') as ReadingSystem;
  return SYSTEM_LLM_PROVIDERS[normalized] || 'deepseek'; // Fallback to deepseek
}

/**
 * Check if a system should use Claude (paid/premium LLM)
 */
export function shouldUseClaude(system: string): boolean {
  return getProviderForSystem(system) === 'claude';
}

/**
 * Check if a system should use OpenAI
 */
export function shouldUseOpenAI(system: string): boolean {
  return getProviderForSystem(system) === 'openai';
}
