"use strict";
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
Object.defineProperty(exports, "__esModule", { value: true });
exports.SYSTEM_LLM_PROVIDERS = void 0;
exports.getProviderForSystem = getProviderForSystem;
exports.shouldUseClaude = shouldUseClaude;
exports.shouldUseOpenAI = shouldUseOpenAI;
/**
 * System to provider mapping
 *
 * Current config: All systems use 'claude' (actual LLM configured in env.ts)
 */
exports.SYSTEM_LLM_PROVIDERS = {
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
function getProviderForSystem(system) {
    const normalized = system.toLowerCase().replace(/-/g, '_');
    return exports.SYSTEM_LLM_PROVIDERS[normalized] || 'deepseek'; // Fallback to deepseek
}
/**
 * Check if a system should use Claude (paid/premium LLM)
 */
function shouldUseClaude(system) {
    return getProviderForSystem(system) === 'claude';
}
/**
 * Check if a system should use OpenAI
 */
function shouldUseOpenAI(system) {
    return getProviderForSystem(system) === 'openai';
}
//# sourceMappingURL=llmProviders.js.map