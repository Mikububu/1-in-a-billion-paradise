"use strict";
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
Object.defineProperty(exports, "__esModule", { value: true });
exports.wrapForLanguage = wrapForLanguage;
exports.getLanguageLabel = getLanguageLabel;
const languages_1 = require("../config/languages");
/**
 * Wrap an English prompt with language output instructions.
 * Returns the prompt unchanged for English.
 */
function wrapForLanguage(prompt, lang) {
    if (lang === 'en')
        return prompt;
    const instruction = (0, languages_1.getLanguageInstruction)(lang);
    if (!instruction)
        return prompt;
    return `${prompt}\n${instruction}`;
}
/**
 * Get the language name for spoken intros and display.
 * Returns empty string for English (no language label needed).
 */
function getLanguageLabel(lang) {
    if (lang === 'en')
        return '';
    return languages_1.LANGUAGE_CONFIG[lang]?.name || '';
}
//# sourceMappingURL=promptWrapper.js.map