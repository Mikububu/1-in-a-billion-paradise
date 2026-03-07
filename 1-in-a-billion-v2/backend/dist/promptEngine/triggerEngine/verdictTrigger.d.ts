/**
 * Keep the verdict input compact and stable.
 * We keep section headers + first N non-empty lines per section.
 */
export declare function stripVerdictChartData(raw: string): string;
export declare function buildVerdictTriggerPrompt(params: {
    person1Name: string;
    person2Name: string;
    strippedChartData: string;
}): string;
/**
 * @deprecated Script-path-only fallback. The production worker uses
 * paidReadingPrompts.buildVerdictPrompt() which has richer structure,
 * compatibility scores, system guidance, and full style/spice/forbidden sections.
 * Kept for backward compatibility with v2_generate_* scripts only.
 * Do NOT route new verdict logic here.
 */
export declare function buildVerdictWritingPrompt(params: {
    person1Name: string;
    person2Name: string;
    narrativeTrigger: string;
    strippedChartData: string;
    spiceLevel?: number;
    targetWords: number;
}): string;
//# sourceMappingURL=verdictTrigger.d.ts.map