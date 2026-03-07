export type BirthReference = {
    birthDate?: string;
    birthTime?: string;
    birthPlace?: string;
};
export declare function buildChartReferencePage(input: {
    chartData: string;
    personName: string;
    birth: BirthReference;
    generatedAt?: Date;
    compact?: boolean;
    system?: string;
}): string;
//# sourceMappingURL=chartReferencePage.d.ts.map