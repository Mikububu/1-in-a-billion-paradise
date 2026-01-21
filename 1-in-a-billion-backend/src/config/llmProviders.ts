/**
 * LLM PROVIDER CONFIGURATION
 * 
 * Maps each reading system to its LLM provider.
 * 
 * Providers:
 * - 'claude' = Claude Sonnet 4 (unhinged, no censorship)
 * - 'deepseek' = DeepSeek (fast, cheap, but vanilla/censored)
 * - 'openai' = OpenAI GPT-4o (balanced)
 * 
 * Change these values and redeploy to switch providers.
 * Future: Runtime config via admin panel (Option C)
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
 * Current config (Jan 2026):
 * - Claude Sonnet 4 for ALL systems (unhinged, no censorship, long-form capable)
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
