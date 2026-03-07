/**
 * KABBALAH TRIGGER ENGINE
 *
 * Two-call architecture for individual Kabbalah readings.
 *
 * 1. stripKabbalahChartData()      - pure code, ~35 highest-signal lines
 * 2. buildKabbalahTriggerPrompt()    - trigger call → 80-120 word paragraph
 * 3. buildKabbalahWritingPrompt()  - writing call → configurable word target
 */
/**
 * Reduces Kabbalah profile to highest-signal lines.
 * Keeps: Tikkun (soul correction), Dominant strong Sefirot (top 3),
 *        Void Sefirot, Four Worlds dominant + void, Primary Shadow Axis.
 * Drops: Moderate/weak sefirot details, letter signature detail,
 *        transit weather, modality, balance lines, policy note.
 */
export declare function stripKabbalahChartData(raw: string): string;
export declare function buildKabbalahTriggerPrompt(params: {
    personName: string;
    strippedChartData: string;
    spiceLevel?: number;
}): string;
export declare function buildKabbalahWritingPrompt(params: {
    personName: string;
    narrativeTrigger: string;
    strippedChartData: string;
    targetWords: number;
}): string;
//# sourceMappingURL=kabbalahTrigger.d.ts.map