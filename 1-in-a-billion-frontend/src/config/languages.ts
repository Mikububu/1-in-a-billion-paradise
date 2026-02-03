/**
 * LANGUAGE CONFIGURATION (FRONTEND)
 * 
 * Mirrors backend language config for type safety.
 * 
 * NOTE: This is for OUTPUT LANGUAGE (what language readings are generated in)
 * NOT to be confused with the languages.ts in /data which is for user's
 * spoken language preferences.
 */

/**
 * Supported output languages for reading generation.
 */
export const OUTPUT_LANGUAGES = ['en', 'es', 'zh'] as const;
export type OutputLanguage = typeof OUTPUT_LANGUAGES[number];

/**
 * Default output language.
 */
export const DEFAULT_OUTPUT_LANGUAGE: OutputLanguage = 'en';

/**
 * Language display names.
 */
export const LANGUAGE_NAMES: Record<OutputLanguage, string> = {
  en: 'English',
  es: 'Español',
  zh: '中文',
};

/**
 * Check if a language code is valid.
 */
export function isValidOutputLanguage(lang: string): lang is OutputLanguage {
  return OUTPUT_LANGUAGES.includes(lang as OutputLanguage);
}
