/**
 * LANGUAGE CONFIGURATION
 *
 * Central source of truth for all language-related settings.
 *
 * ARCHITECTURE:
 * - OutputLanguage: The language readings are generated in
 * - LLM generates NATIVELY in each target language (no translation step)
 * - Each language has a prompt instruction block appended to the system prompt
 *
 * LAUNCH LANGUAGES: en, de, es, fr, zh (5 total)
 * Adding a language: add entry here + frontend JSON + voice registry entry
 */
/**
 * Supported output languages for reading generation.
 * Add new languages here when ready to support them.
 */
export declare const OUTPUT_LANGUAGES: readonly ["en", "de", "es", "fr", "zh", "ja", "ko", "hi", "pt", "it"];
export type OutputLanguage = typeof OUTPUT_LANGUAGES[number];
/**
 * Default output language for all readings.
 */
export declare const DEFAULT_OUTPUT_LANGUAGE: OutputLanguage;
/**
 * Language metadata for UI, prompts, and TTS.
 */
export declare const LANGUAGE_CONFIG: Record<OutputLanguage, {
    name: string;
    nativeName: string;
    locale: string;
    promptInstruction: string;
}>;
/**
 * Check if a language is supported.
 */
export declare function isValidLanguage(lang: string): lang is OutputLanguage;
/**
 * Get language instruction for LLM prompt.
 * Returns empty string for English (no instruction needed).
 */
export declare function getLanguageInstruction(lang: OutputLanguage): string;
/**
 * Get BCP-47 locale for a language.
 */
export declare function getLocale(lang: OutputLanguage): string;
/**
 * Safely parse language from unknown input.
 * Returns default if invalid.
 */
export declare function parseLanguage(input: unknown): OutputLanguage;
//# sourceMappingURL=languages.d.ts.map