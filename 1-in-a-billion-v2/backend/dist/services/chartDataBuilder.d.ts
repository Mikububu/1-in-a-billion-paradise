/**
 * Chart data builder used by the V2 job pipeline.
 *
 * Purpose:
 * - Provide system-specific chart data to the LLM (Western/Vedic/HD/GeneKeys/Kabbalah).
 * - Avoid leaking the "other person" chart into individual readings.
 *
 * NOTE: This is intentionally a pure function. Any Swiss Ephemeris calls happen elsewhere.
 */
export declare function buildChartDataForSystem(system: string, person1Name: string, p1Placements: any, person2Name: string | null, p2Placements: any | null, p1BirthData: {
    birthDate: string;
    birthTime: string;
    timezone?: string;
    birthPlace?: string;
}, p2BirthData: {
    birthDate: string;
    birthTime: string;
    timezone?: string;
    birthPlace?: string;
} | null): string;
//# sourceMappingURL=chartDataBuilder.d.ts.map