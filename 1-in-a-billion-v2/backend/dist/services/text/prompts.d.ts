/**
 * HOOK READING PROMPTS
 *
 * PURPOSE: These readings are the HOOK of the app. They must make the user feel
 * so deeply SEEN that they NEED to explore more. Not generic astrology - a mirror.
 *
 * ARCHITECTURE:
 * - TypeScript defines voice/style directly (no MD file dependency)
 * - Hook readings are short (120-140 words) for phone screens
 *
 * TONE: Dark Soul Storytelling - condensed for phone screens.
 * NO WHITEWASH - obsession, compulsion, fixation, hunger, shadow.
 *
 * FORMAT:
 * - PREAMBLE: 40-50 words MAX. Direct, psychological opening.
 * - ANALYSIS: 80-90 words MAX. The HOOK that makes them gasp.
 * - TOTAL: 120-140 words. One phone screen.
 */
export type ReadingType = 'sun' | 'moon' | 'rising';
type DegreePosition = {
    sign: string;
    degree: number;
    minute: number;
};
type PlacementData = {
    sunSign: string;
    moonSign: string;
    risingSign: string;
    sunDegree?: DegreePosition & {
        decan?: 1 | 2 | 3;
    };
    moonDegree?: DegreePosition & {
        decan?: 1 | 2 | 3;
    };
    ascendantDegree?: DegreePosition & {
        decan?: 1 | 2 | 3;
    };
    sunHouse?: number;
    moonHouse?: number;
};
export type PromptContext = {
    type: ReadingType;
    sign: string;
    birthDate: string;
    birthTime: string;
    birthPlace?: string;
    intensity: number;
    mode: 'family' | 'sensual';
    placements?: PlacementData | undefined;
    subjectName?: string | undefined;
    isPartnerReading?: boolean | undefined;
    language?: string;
};
/**
 * Build the system prompt for hook readings.
 * Voice/style defined directly in TypeScript (no MD file dependency).
 */
export declare function getSystemPrompt(): string;
export declare const SYSTEM_PROMPT: string;
export declare function buildReadingPrompt(ctx: PromptContext): string;
export {};
//# sourceMappingURL=prompts.d.ts.map