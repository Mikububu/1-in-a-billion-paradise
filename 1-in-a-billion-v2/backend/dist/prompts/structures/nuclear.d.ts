/**
 * NUCLEAR PACKAGE STRUCTURE
 *
 * 30,000 words | 2 people | ALL 5 systems | ~2.5 hours audio
 * Generated across 5 API calls (one per part)
 *
 * Source: PROMPT_PRODUCTION_Nuclear.txt, PROMPT_SPICY_SURREAL_Nuclear.txt
 */
export interface NuclearPart {
    number: 1 | 2 | 3 | 4 | 5;
    name: string;
    title: string;
    words: number;
    description: string;
    isShadow: boolean;
    promptHint: string;
}
export declare const NUCLEAR_PARTS: NuclearPart[];
export declare const NUCLEAR_STRUCTURE: {
    name: string;
    totalWords: number;
    audioMinutes: number;
    parts: NuclearPart[];
};
/**
 * Get a specific part configuration
 */
export declare function getNuclearPart(partNumber: 1 | 2 | 3 | 4 | 5): NuclearPart;
/**
 * Build structure overview for Nuclear reading
 */
export declare function buildNuclearStructure(person1Name: string, person2Name: string): string;
/**
 * Build instructions for a specific Nuclear part
 */
export declare function buildNuclearPartInstructions(partNumber: 1 | 2 | 3 | 4 | 5, person1Name: string, person2Name: string, previousPartSummary?: string): string;
//# sourceMappingURL=nuclear.d.ts.map