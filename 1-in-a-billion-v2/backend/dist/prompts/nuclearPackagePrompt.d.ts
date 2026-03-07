/**
 * NUCLEAR PACKAGE PROMPT
 * One massive Claude call → 30+ pages of reading
 *
 * This prompt must be PERFECT - it generates the entire product in one shot.
 */
export interface NuclearPromptParams {
    person1: {
        name: string;
        sunSign: string;
        moonSign: string;
        risingSign: string;
        sunDegree?: string;
        moonDegree?: string;
        risingDegree?: string;
    };
    person2: {
        name: string;
        sunSign: string;
        moonSign: string;
        risingSign: string;
        sunDegree?: string;
        moonDegree?: string;
        risingDegree?: string;
    };
    intensity: 'safe' | 'spicy';
}
export declare function buildNuclearPrompt(params: NuclearPromptParams): string;
//# sourceMappingURL=nuclearPackagePrompt.d.ts.map