/**
 * GENE KEYS TRIGGER ENGINE
 *
 * Two-call architecture for individual Gene Keys readings.
 *
 * 1. stripGeneKeysChartData()        - light cleanup, keeps ALL sequences
 * 2. buildGeneKeysTriggerPrompt()    - trigger call → 80-120 word paragraph
 * 3. buildGeneKeysWritingPrompt()    - writing call → configurable word target
 */
/**
 * Gene Keys chart data is already concise.
 * Keeps: Activation Sequence, Venus Sequence, AND Pearl Sequence.
 * Only trims blank/duplicate lines - the LLM needs all three sequences
 * to produce a reading that covers the full spectrum of consciousness.
 */
export declare function stripGeneKeysChartData(raw: string): string;
export declare function buildGeneKeysTriggerPrompt(params: {
    personName: string;
    strippedChartData: string;
    spiceLevel?: number;
}): string;
export declare function buildGeneKeysWritingPrompt(params: {
    personName: string;
    narrativeTrigger: string;
    strippedChartData: string;
    targetWords: number;
}): string;
//# sourceMappingURL=geneKeysTrigger.d.ts.map