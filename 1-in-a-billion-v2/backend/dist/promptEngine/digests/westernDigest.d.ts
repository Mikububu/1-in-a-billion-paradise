export type WesternDigestValidation = {
    ok: boolean;
    evidenceLines: string[];
    reason?: string;
};
export declare function compactWesternChartDataForDigest(chartData: string): string;
export declare function buildWesternChartDigestPrompt(params: {
    personName: string;
    chartData: string;
}): string;
export declare function extractEvidenceLinesFromDigest(digest: string): string[];
export declare function validateWesternDigestAgainstChartData(params: {
    digest: string;
    chartData: string;
}): WesternDigestValidation;
export declare function extractWoundFromDigest(digest: string): string | null;
//# sourceMappingURL=westernDigest.d.ts.map