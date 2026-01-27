/**
 * LANGUAGE CONFIGURATION
 * 
 * Central source of truth for all language-related settings.
 * 
 * ARCHITECTURE:
 * - OutputLanguage: The language readings are generated in
 * - Currently only 'en' is active
 * - Infrastructure ready for 'es', 'zh' when needed
 * 
 * GENERATION STRATEGY (to be decided):
 * - Option A: LLM generates directly in target language
 * - Option B: Generate English → translate with Hunyuan-MT
 * - Decision point exists in workers, defaults to English for now
 */

/**
 * Supported output languages for reading generation.
 * Add new languages here when ready to support them.
 */
export const OUTPUT_LANGUAGES = ['en', 'es', 'zh'] as const;
export type OutputLanguage = typeof OUTPUT_LANGUAGES[number];

/**
 * Default output language for all readings.
 */
export const DEFAULT_OUTPUT_LANGUAGE: OutputLanguage = 'en';

/**
 * Language metadata for UI and prompts.
 */
export const LANGUAGE_CONFIG: Record<OutputLanguage, {
  name: string;
  nativeName: string;
  promptInstruction: string;
}> = {
  en: {
    name: 'English',
    nativeName: 'English',
    promptInstruction: '', // No instruction needed for English
  },
  es: {
    name: 'Spanish',
    nativeName: 'Español',
    promptInstruction: `
═══════════════════════════════════════════════════════════════════════════════
OUTPUT LANGUAGE: Spanish (Español)
═══════════════════════════════════════════════════════════════════════════════

CRITICAL: Generate NATIVELY in Spanish.
- Internalize the voice, style, and psychological depth from the English examples above
- Write as a native Spanish-speaking psychoanalyst would write
- Do NOT translate English phrases - CREATE in Spanish
- Apply the same shadow percentages, forbidden pattern concepts, and quality standards
- The output should feel NATIVE to a Spanish speaker, not translated
- Avoid Spanish filler phrases and clichés equivalent to the English forbidden phrases
`,
  },
  zh: {
    name: 'Chinese',
    nativeName: '中文',
    promptInstruction: `
═══════════════════════════════════════════════════════════════════════════════
OUTPUT LANGUAGE: Chinese (中文)
═══════════════════════════════════════════════════════════════════════════════

CRITICAL: Generate NATIVELY in Simplified Chinese.
- Internalize the voice, style, and psychological depth from the English examples above
- Write as a native Chinese-speaking psychoanalyst would write
- Do NOT translate English phrases - CREATE in Chinese
- Apply the same shadow percentages, forbidden pattern concepts, and quality standards
- The output should feel NATIVE to a Chinese speaker, not translated
- Avoid Chinese filler phrases and clichés equivalent to the English forbidden phrases
- Use appropriate Chinese psychological vocabulary and metaphors
`,
  },
};

/**
 * Check if a language is supported.
 */
export function isValidLanguage(lang: string): lang is OutputLanguage {
  return OUTPUT_LANGUAGES.includes(lang as OutputLanguage);
}

/**
 * Get language instruction for LLM prompt.
 * Returns empty string for English (no instruction needed).
 */
export function getLanguageInstruction(lang: OutputLanguage): string {
  return LANGUAGE_CONFIG[lang]?.promptInstruction || '';
}

/**
 * Safely parse language from unknown input.
 * Returns default if invalid.
 */
export function parseLanguage(input: unknown): OutputLanguage {
  if (typeof input === 'string' && isValidLanguage(input)) {
    return input;
  }
  return DEFAULT_OUTPUT_LANGUAGE;
}
