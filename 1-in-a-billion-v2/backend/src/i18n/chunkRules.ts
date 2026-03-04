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
    maxChars: 300,            // Output length is robust for Turbo
    splitPattern: /[.!?]\s+/,
    minChars: 80,
  },
  de: {
    maxChars: 220,            // Reduced from 280 (Multilingual model is stricter)
    splitPattern: /[.!?]\s+/,
    minChars: 80,
  },
  es: {
    maxChars: 250,            // Reduced from 300 (Multilingual model is stricter)
    splitPattern: /[.!?]\s+/,
    minChars: 80,
  },
  fr: {
    maxChars: 250,            // Reduced from 300 (Multilingual model is stricter)
    splitPattern: /[.!?]\s+/,
    minChars: 80,
  },
  zh: {
    maxChars: 180,            // Reduced from 200
    splitPattern: /[。！？]\s*/,
    minChars: 50,
  },
  ja: {
    maxChars: 180,            // Logograms pack dense meaning
    splitPattern: /[。！？]\s*/,
    minChars: 50,
  },
  ko: {
    maxChars: 180,            // Hangul clusters are visually dense
    splitPattern: /[.!?]\s+/,
    minChars: 50,
  },
  hi: {
    maxChars: 220,            // Devanagari script
    splitPattern: /[।!?]\s+/, // Danda (।) is Hindi full stop
    minChars: 80,
  },
  pt: {
    maxChars: 250,            // Similar to ES/FR syntax
    splitPattern: /[.!?]\s+/,
    minChars: 80,
  },
  it: {
    maxChars: 250,            // Similar to ES/FR syntax
    splitPattern: /[.!?]\s+/,
    minChars: 80,
  },
};

/**
 * Get chunk config for a language.
 * Falls back to English if language not found.
 */
export function getChunkConfig(lang: OutputLanguage): ChunkConfig {
  return CHUNK_RULES[lang] || CHUNK_RULES.en;
}
