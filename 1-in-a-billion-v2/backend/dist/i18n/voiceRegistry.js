"use strict";
/**
 * VOICE REGISTRY - Replicate/Chatterbox Fallback Configuration
 *
 * ⚠️  DORMANT: Only used when active_tts_provider = 'replicate' in api_keys table.
 *     MiniMax is the default/active TTS provider (see apiKeysHelper.ts).
 *
 * Maps language -> Replicate Chatterbox model + voice configuration:
 *   - English → chatterbox-turbo (fastest)
 *   - All others → chatterbox-multilingual (language_id param)
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.getVoiceConfig = getVoiceConfig;
exports.hasVoiceSupport = hasVoiceSupport;
/**
 * Replicate voice registry (dormant fallback).
 * Only active when provider is switched to 'replicate'.
 */
const VOICE_REGISTRY = {
    en: {
        provider: 'chatterbox',
        modelId: 'resemble-ai/chatterbox-turbo',
        languageId: 'en',
        label: 'English (Chatterbox Turbo)',
        supportsCloning: true,
    },
    de: {
        provider: 'chatterbox-multilingual',
        modelId: 'resemble-ai/chatterbox-multilingual',
        languageId: 'de',
        label: 'German (Chatterbox Multilingual)',
        supportsCloning: true,
    },
    es: {
        provider: 'chatterbox-multilingual',
        modelId: 'resemble-ai/chatterbox-multilingual',
        languageId: 'es',
        label: 'Spanish (Chatterbox Multilingual)',
        supportsCloning: true,
    },
    fr: {
        provider: 'chatterbox-multilingual',
        modelId: 'resemble-ai/chatterbox-multilingual',
        languageId: 'fr',
        label: 'French (Chatterbox Multilingual)',
        supportsCloning: true,
    },
    zh: {
        provider: 'chatterbox-multilingual',
        modelId: 'resemble-ai/chatterbox-multilingual',
        languageId: 'zh',
        label: 'Chinese (Chatterbox Multilingual)',
        supportsCloning: true,
    },
    ja: {
        provider: 'chatterbox-multilingual',
        modelId: 'resemble-ai/chatterbox-multilingual',
        languageId: 'ja',
        label: 'Japanese (Chatterbox Multilingual)',
        supportsCloning: true,
    },
    ko: {
        provider: 'chatterbox-multilingual',
        modelId: 'resemble-ai/chatterbox-multilingual',
        languageId: 'ko',
        label: 'Korean (Chatterbox Multilingual)',
        supportsCloning: true,
    },
    hi: {
        provider: 'chatterbox-multilingual',
        modelId: 'resemble-ai/chatterbox-multilingual',
        languageId: 'hi',
        label: 'Hindi (Chatterbox Multilingual)',
        supportsCloning: true,
    },
    pt: {
        provider: 'chatterbox-multilingual',
        modelId: 'resemble-ai/chatterbox-multilingual',
        languageId: 'pt',
        label: 'Portuguese (Chatterbox Multilingual)',
        supportsCloning: true,
    },
    it: {
        provider: 'chatterbox-multilingual',
        modelId: 'resemble-ai/chatterbox-multilingual',
        languageId: 'it',
        label: 'Italian (Chatterbox Multilingual)',
        supportsCloning: true,
    },
};
/**
 * Get voice config for a language.
 * Falls back to English if language not found.
 */
function getVoiceConfig(lang) {
    return VOICE_REGISTRY[lang] || VOICE_REGISTRY.en;
}
/**
 * Check if a language has voice support configured.
 * Now returns true for all 5 launch languages since
 * Chatterbox Multilingual supports them all.
 */
function hasVoiceSupport(lang) {
    return lang in VOICE_REGISTRY;
}
//# sourceMappingURL=voiceRegistry.js.map