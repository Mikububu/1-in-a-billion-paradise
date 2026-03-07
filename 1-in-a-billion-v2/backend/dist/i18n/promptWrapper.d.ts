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
import { OutputLanguage } from '../config/languages';
/**
 * Wrap an English prompt with language output instructions.
 * Returns the prompt unchanged for English.
 */
export declare function wrapForLanguage(prompt: string, lang: OutputLanguage): string;
/**
 * Get the language name for spoken intros and display.
 * Returns empty string for English (no language label needed).
 */
export declare function getLanguageLabel(lang: OutputLanguage): string;
//# sourceMappingURL=promptWrapper.d.ts.map