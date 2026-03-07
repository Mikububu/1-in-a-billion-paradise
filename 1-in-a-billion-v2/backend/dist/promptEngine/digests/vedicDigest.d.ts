export type VedicDigestValidation = {
    ok: boolean;
    reason?: string;
};
export declare function buildVedicChartDigestPrompt(params: {
    personName: string;
    chartData: string;
}): string;
export declare function validateVedicDigest(params: {
    digest: string;
    chartData: string;
}): VedicDigestValidation;
export declare function validateVedicDigestAgainstChartData(params: {
    digest: string;
    chartData?: string;
}): VedicDigestValidation;
//# sourceMappingURL=vedicDigest.d.ts.map