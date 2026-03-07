/**
 * SEPARATE LLM SCORING CALL
 *
 * Generates compatibility scores as a dedicated 3rd LLM call AFTER the
 * reading prose is finalized. This keeps the reading text clean (no embedded
 * scores) so it can feed the audio pipeline, while producing structured
 * graphical data for the PDF compatibility snapshot page.
 *
 * 10 categories, each scored 0-100 with 2-3 sentences of reasoning.
 */
export type CompatibilityScore = {
    label: string;
    score: number;
    scoreTen: number;
    note: string;
};
export declare function generateCompatibilityScores(params: {
    person1Name: string;
    person2Name: string;
    readingText: string;
    chartData: string;
    label: string;
    isVerdict?: boolean;
}): Promise<CompatibilityScore[]>;
//# sourceMappingURL=compatibilityScoring.d.ts.map