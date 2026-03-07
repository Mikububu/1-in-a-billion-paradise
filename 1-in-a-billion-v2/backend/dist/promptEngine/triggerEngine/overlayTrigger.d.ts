export declare function stripWesternOverlayData(person1Raw: string, person2Raw: string): string;
export declare function stripVedicOverlayData(person1Raw: string, person2Raw: string): string;
export declare function stripHDOverlayData(person1Raw: string, person2Raw: string): string;
export declare function stripGeneKeysOverlayData(person1Raw: string, person2Raw: string): string;
export declare function stripKabbalahOverlayData(person1Raw: string, person2Raw: string): string;
export declare function buildWesternOverlayTriggerPrompt(params: {
    person1Name: string;
    person2Name: string;
    strippedChartData: string;
}): string;
export declare function buildVedicOverlayTriggerPrompt(params: {
    person1Name: string;
    person2Name: string;
    strippedChartData: string;
}): string;
export declare function buildHDOverlayTriggerPrompt(params: {
    person1Name: string;
    person2Name: string;
    strippedChartData: string;
}): string;
export declare function buildGeneKeysOverlayTriggerPrompt(params: {
    person1Name: string;
    person2Name: string;
    strippedChartData: string;
}): string;
export declare function buildKabbalahOverlayTriggerPrompt(params: {
    person1Name: string;
    person2Name: string;
    strippedChartData: string;
}): string;
export declare function buildWesternOverlayWritingPrompt(params: {
    person1Name: string;
    person2Name: string;
    narrativeTrigger: string;
    strippedChartData: string;
    targetWords: number;
}): string;
export declare function buildVedicOverlayWritingPrompt(params: {
    person1Name: string;
    person2Name: string;
    narrativeTrigger: string;
    strippedChartData: string;
    targetWords: number;
}): string;
export declare function buildHDOverlayWritingPrompt(params: {
    person1Name: string;
    person2Name: string;
    narrativeTrigger: string;
    strippedChartData: string;
    targetWords: number;
}): string;
export declare function buildGeneKeysOverlayWritingPrompt(params: {
    person1Name: string;
    person2Name: string;
    narrativeTrigger: string;
    strippedChartData: string;
    targetWords: number;
}): string;
export declare function buildKabbalahOverlayWritingPrompt(params: {
    person1Name: string;
    person2Name: string;
    narrativeTrigger: string;
    strippedChartData: string;
    targetWords: number;
}): string;
//# sourceMappingURL=overlayTrigger.d.ts.map