/**
 * TEXT CLEANUP UTILITY
 *
 * Cleans text to be TTS (Text-to-Speech) ready and audio-flawless.
 * Removes all symbols, unicode characters, markdown, and garbage text
 * that could cause issues with audio generation.
 *
 * Source: OUTPUT_FORMAT_RULES from prompts/core/output-rules.ts
 */
/**
 * Clean text for TTS audio generation
 *
 * Removes:
 * - All markdown syntax (#, ##, **, __, -, etc.)
 * - Special characters and unicode (♈, ♉, °, ', ", -, -, etc.)
 * - Emojis and symbols
 * - HTML tags and entities
 * - Broken words or unreadable text
 * - Em-dashes and en-dashes (replaces with commas/semicolons)
 *
 * Ensures:
 * - All text is readable and pronounceable
 * - No symbols that would confuse TTS
 */
export declare function cleanupTextForTTS(text: string, language?: string): string;
/**
 * Validate text is TTS-ready
 *
 * Checks for common issues that would cause TTS problems:
 * - Unreadable symbols
 * - Broken words
 * - Missing spaces after headlines
 */
export declare function validateTextForTTS(text: string): {
    isValid: boolean;
    issues: string[];
};
//# sourceMappingURL=textCleanup.d.ts.map