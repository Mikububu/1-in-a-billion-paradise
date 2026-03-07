/**
 * HUMAN DESIGN TRIGGER ENGINE
 *
 * Two-call architecture for individual Human Design readings.
 *
 * 1. stripHDChartData()      - pure code, ~30 highest-signal lines
 * 2. buildHDTriggerPrompt()    - trigger call → 80-120 word paragraph
 * 3. buildHDWritingPrompt()  - writing call → configurable word target
 */
/**
 * Reduces HD chart data to highest-signal lines.
 * Keeps: Type, Strategy, Authority, Profile, Definition, Incarnation Cross,
 *        Defined Centers, Open Centers, Active Channels,
 *        Key planetary activations (Sun, Earth, Moon, Nodes, Mercury, Venus, Mars),
 *        Compressed active gates list (gate numbers only, for channel completion detection).
 * Drops: Outer planet activations (Jupiter, Saturn, Uranus, Neptune, Pluto) from
 *        personality/design sections - these contribute gates but rarely drive the narrative.
 */
export declare function stripHDChartData(raw: string): string;
export declare function buildHDTriggerPrompt(params: {
    personName: string;
    strippedChartData: string;
    spiceLevel?: number;
}): string;
export declare function buildHDWritingPrompt(params: {
    personName: string;
    narrativeTrigger: string;
    strippedChartData: string;
    targetWords: number;
}): string;
//# sourceMappingURL=humanDesignTrigger.d.ts.map