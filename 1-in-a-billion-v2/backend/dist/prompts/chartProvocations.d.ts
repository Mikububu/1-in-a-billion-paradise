/**
 * CHART-AWARE PROVOCATIONS
 *
 * Anchors the LLM to specific placements parsed from chart data.
 * Combines system-specific templates with dynamic chart data injection
 * so the LLM cannot drift into generic territory.
 *
 * Falls back to generic provocations if parsing fails.
 */
export declare function buildChartAwareProvocations(personName: string, system: string, chartData: string, spiceLevel: number): string;
//# sourceMappingURL=chartProvocations.d.ts.map