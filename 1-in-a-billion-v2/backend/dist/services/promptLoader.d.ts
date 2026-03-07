/**
 * PROMPT LOADER
 *
 * Loads the master prompt MD file as the SINGLE SOURCE OF TRUTH
 * for all reading voice, style, and instructions.
 *
 * ARCHITECTURE:
 * - One English "perfume" file defines all voice/style/approach
 * - Language parameter adds instruction for non-English output
 * - LLM internalizes English examples, generates natively in target language
 *
 * TypeScript handles ONLY:
 * - Loading the MD file
 * - Data interpolation (names, birth data, chart data)
 * - Language instruction injection
 * - Reading type routing (hook vs deep, which LLM)
 *
 * The MD file handles:
 * - Voice/tone ("the perfume")
 * - Forbidden phrases
 * - Quality examples
 * - Structure guidelines
 * - All creative direction
 */
import { OutputLanguage } from '../config/languages';
/**
 * Load the master prompt MD file.
 * Returns the full content as a string.
 *
 * NOTE: This is always the English "perfume" file.
 * Language-specific output is achieved via instruction injection, not separate files.
 */
export declare function loadMasterPrompt(): string;
/**
 * Extract a specific section from the MD file by part number.
 * Parts are delimited by "## PART X:" headers.
 */
export declare function extractSection(partNumber: number): string;
/**
 * Extract the forbidden phrases section for quick reference.
 */
export declare function getForbiddenPhrases(): string;
/**
 * Extract the voice lock section (quality calibration).
 */
export declare function getVoiceLock(): string;
/**
 * Extract the output format rules.
 */
export declare function getOutputFormat(): string;
/**
 * Get condensed voice guidance for hook readings.
 * Extracts the essential "perfume" without the full length.
 */
export declare function getCondensedVoice(): string;
/**
 * Build the full prompt for deep readings.
 * Combines MD file content with interpolated data and language instruction.
 */
export declare function buildDeepReadingPrompt(params: {
    person1Name: string;
    person2Name?: string;
    person1Data?: {
        birthDate: string;
        birthTime: string;
        birthPlace: string;
    };
    person2Data?: {
        birthDate: string;
        birthTime: string;
        birthPlace: string;
    };
    chartData: string;
    spiceLevel: number;
    readingType: 'individual' | 'overlay' | 'verdict';
    systemName?: string;
    wordTarget?: number;
    outputLanguage?: OutputLanguage;
}): string;
//# sourceMappingURL=promptLoader.d.ts.map