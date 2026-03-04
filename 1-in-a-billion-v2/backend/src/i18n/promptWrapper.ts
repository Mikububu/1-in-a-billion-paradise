/**
 * PROMPT WRAPPER - Language Boundary #1
 *
 * Wraps any English prompt with language-specific output instructions.
 * For English, returns the prompt unchanged (zero overhead).
 *
 * OVERLAY PRINCIPLE:
 *   The core app writes prompts in English. This wrapper appends
 *   a language directive. If you change the English prompt, the
 *   wrapper still works - it just appends to whatever the prompt is.
 *   The LLM receives full English creative direction + language output.
 */

import { OutputLanguage, LANGUAGE_CONFIG, getLanguageInstruction } from '../config/languages';

/**
 * Wrap an English prompt with language output instructions.
 * Returns the prompt unchanged for English.
 */
export function wrapForLanguage(prompt: string, lang: OutputLanguage): string {
  if (lang === 'en') return prompt;

  const instruction = getLanguageInstruction(lang);
  if (!instruction) return prompt;

  return `${prompt}\n${instruction}`;
}

/**
 * Get the language name for spoken intros and display.
 * Returns empty string for English (no language label needed).
 */
export function getLanguageLabel(lang: OutputLanguage): string {
  if (lang === 'en') return '';
  return LANGUAGE_CONFIG[lang]?.name || '';
}
