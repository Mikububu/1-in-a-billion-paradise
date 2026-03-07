/**
 * VEDIC TRIGGER ENGINE
 *
 * Two-call architecture for individual Vedic readings.
 *
 * 1. stripVedicChartData()   - pure code, ~35 highest-signal lines
 * 2. buildVedicTriggerPrompt() - trigger call → 80-120 word paragraph
 * 3. buildVedicWritingPrompt() - writing call → configurable word target
 */
/**
 * Reduces full Vedic chart output to ~35 highest-signal lines.
 * Keeps: Lagna, Lagna Lord, Chandra rashi + nakshatra, personal grahas (Sun/Moon/Mars/Saturn/Rahu/Ketu),
 *        current Mahadasha + Antardasha, Navamsha Lagna.
 * Drops: Full graha list (Jupiter/Venus/Mercury unless in key houses), full dasha sequence,
 *        detailed bhava occupancy, pressurized bhavas, 7th bhava detail, empty angulars.
 */
export declare function stripVedicChartData(raw: string): string;
export declare function buildVedicTriggerPrompt(params: {
    personName: string;
    strippedChartData: string;
    spiceLevel?: number;
}): string;
export declare function buildVedicWritingPrompt(params: {
    personName: string;
    narrativeTrigger: string;
    strippedChartData: string;
    targetWords: number;
}): string;
//# sourceMappingURL=vedicTrigger.d.ts.map