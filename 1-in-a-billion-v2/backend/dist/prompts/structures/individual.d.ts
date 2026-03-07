/**
 * INDIVIDUAL READING STRUCTURE
 *
 * Word count: Controlled SOLELY by src/prompts/config/wordCounts.ts (STANDARD_READING).
 * Do NOT hardcode word counts here - getWordTarget() is the single source of truth.
 * Section breakdowns below are proportional guides that sum to the STANDARD_READING.target (7000).
 *
 * Source: PROMPT_PRODUCTION_Individual.txt
 */
export declare const INDIVIDUAL_STRUCTURE: {
    name: string;
    readonly totalWords: number;
    readonly audioMinutes: string;
    sections: ({
        name: string;
        words: number;
        description: string;
        isShadow?: undefined;
    } | {
        name: string;
        words: number;
        description: string;
        isShadow: boolean;
    })[];
};
/**
 * Build structure instructions for Individual reading.
 *
 * IMPORTANT: Do NOT include a word count here - getWordTarget() in builder.ts
 * is the single source of truth and is injected separately.
 */
export declare function buildIndividualStructure(personName: string): string;
//# sourceMappingURL=individual.d.ts.map