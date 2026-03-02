/**
 * CHUNK RULES — Language Boundary #3
 *
 * Language-specific text chunking rules for TTS.
 * Different languages have different optimal chunk sizes
 * and sentence boundary patterns.
 *
 * OVERLAY PRINCIPLE:
 *   Changing the English chunk size only affects the 'en' entry.
 *   Each language has its own config. The audio pipeline calls
 *   getChunkConfig(language) instead of using hardcoded values.
 */

import { OutputLanguage } from '../config/languages';

export interface ChunkConfig {
  /** Maximum characters per TTS chunk */
  maxChars: number;
  /** Regex for sentence boundary splitting */
  splitPattern: RegExp;
  /** Minimum chunk size (don't split below this) */
  minChars: number;
}

/**
 * Language-specific chunking rules.
 *
 * Rationale for differences:
 *   - Chinese packs more meaning per character -> shorter chunks
 *   - German has compound words -> slightly shorter than English
 *   - Spanish/French sentence structure is similar to English
 */
const CHUNK_RULES: Record<OutputLanguage, ChunkConfig> = {
  en: {
    maxChars: 300,            // Current English value (intentional, don't change)
    splitPattern: /[.!?]\s+/,
    minChars: 80,
  },
  de: {
    maxChars: 280,            // German compound words = longer tokens
    splitPattern: /[.!?]\s+/,
    minChars: 80,
  },
  es: {
    maxChars: 300,            // Similar structure to English
    splitPattern: /[.!?]\s+/,
    minChars: 80,
  },
  fr: {
    maxChars: 300,            // Similar structure to English
    splitPattern: /[.!?]\s+/,
    minChars: 80,
  },
  zh: {
    maxChars: 200,            // Chinese characters pack more meaning
    splitPattern: /[。！？]\s*/,
    minChars: 50,
  },
};

/**
 * Get chunk config for a language.
 * Falls back to English if language not found.
 */
export function getChunkConfig(lang: OutputLanguage): ChunkConfig {
  return CHUNK_RULES[lang] || CHUNK_RULES.en;
}
