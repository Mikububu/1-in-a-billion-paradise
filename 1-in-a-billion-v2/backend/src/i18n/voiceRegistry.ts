/**
 * VOICE REGISTRY - Language Boundary #2
 *
 * Maps language -> TTS provider + voice configuration.
 *
 * All 5 launch languages use Chatterbox on Replicate:
 *   - English → chatterbox-turbo (existing pipeline, zero change)
 *   - DE/ES/FR/ZH → chatterbox-multilingual (language_id param)
 *
 * OVERLAY PRINCIPLE:
 *   The audio worker calls getVoiceConfig(language) instead of
 *   hardcoding a single model. For English, nothing changes.
 *   Adding a new language = adding a new registry entry.
 */

import { OutputLanguage } from '../config/languages';

export type TTSProvider = 'chatterbox' | 'chatterbox-multilingual';

export interface VoiceConfig {
  provider: TTSProvider;
  /** Replicate model identifier */
  modelId: string;
  /** Language ID for chatterbox-multilingual (ISO 639-1) */
  languageId: string;
  /** Human-readable label for logs/debug */
  label: string;
  /** Whether this voice supports voice cloning / reference audio */
  supportsCloning: boolean;
}

/**
 * Voice registry.
 *
 * English keeps chatterbox-turbo (battle-tested, fastest).
 * All other languages use chatterbox-multilingual with language_id.
 *
 * To add a new language:
 *   1. Check it's in Chatterbox Multilingual's 23-language list
 *   2. Add the entry here with the correct languageId
 *   3. Done - the audio worker routes automatically
 */
const VOICE_REGISTRY: Record<OutputLanguage, VoiceConfig> = {
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
export function getVoiceConfig(lang: OutputLanguage): VoiceConfig {
  return VOICE_REGISTRY[lang] || VOICE_REGISTRY.en;
}

/**
 * Check if a language has voice support configured.
 * Now returns true for all 5 launch languages since
 * Chatterbox Multilingual supports them all.
 */
export function hasVoiceSupport(lang: OutputLanguage): boolean {
  return lang in VOICE_REGISTRY;
}
