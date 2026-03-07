/**
 * TRANSFORMATIONS - THE GOLD
 *
 * "INSTEAD OF → WRITE" examples that teach the LLM
 * how to transform generic astrology into literary depth.
 *
 * These are the MOST VALUABLE prompt components.
 *
 * Source: PROMPT_SPICY_SURREAL_Nuclear.txt
 */
export interface Transformation {
    topic: string;
    bad: string;
    good: string;
}
export declare const TRANSFORMATIONS: Transformation[];
/**
 * Build the transformations section for prompts
 * Shows LLM the quality difference between generic and literary
 */
export declare function buildTransformationsSection(maxExamples?: number): string;
//# sourceMappingURL=transformations.d.ts.map