/**
 * WESTERN TRIGGER ENGINE
 *
 * Two-call architecture for individual Western readings.
 *
 * 1. stripWesternChartData()  - pure code, no LLM, ~40 lines out
 * 2. buildWesternTriggerPrompt() - 20-line trigger call → 80-120 word trigger paragraph
 * 3. buildWesternWritingPrompt() - 60-line writing call → configurable word target
 *
 * No digest. No expansion passes. No compliance rewrites.
 */
/**
 * Reduces raw Western chart data from ~150 lines to ~40 highest-signal lines.
 * Keeps: Big 3, personal planets, Saturn, Pluto, Nodes, angular cusps,
 *        tight aspects (orb ≤ 3°), profection block, top 6 transit aspects.
 * Drops: Uranus, Neptune, Jupiter (unless tight aspect), all 12 house cusps,
 *        transit planet list.
 */
export declare function stripWesternChartData(raw: string): string;
/**
 * 20-line trigger call.
 * Output: one paragraph, 80-120 words, naming the central narrative trigger.
 * Not themes. Not placements described. The specific thing.
 */
export declare function buildWesternTriggerPrompt(params: {
    personName: string;
    strippedChartData: string;
    spiceLevel?: number;
}): string;
/**
 * 60-line writing call.
 * Receives trigger paragraph as spine.
 * Output: configurable length, third person, one complete pass, no expansion.
 */
export declare function buildWesternWritingPrompt(params: {
    personName: string;
    narrativeTrigger: string;
    strippedChartData: string;
    targetWords: number;
}): string;
//# sourceMappingURL=westernTrigger.d.ts.map