/**
 * SURREAL METAPHOR ARCHITECTURE
 *
 * Templates for weaving surreal imagery throughout readings.
 * These teach the LLM the David Lynch visual language.
 *
 * Source: PROMPT_SPICY_SURREAL_Nuclear.txt
 */
export interface MetaphorTemplate {
    category: string;
    description: string;
    example: string;
}
export declare const SURREAL_METAPHORS: MetaphorTemplate[];
/**
 * Build the surreal metaphor instructions section
 */
export declare function buildSurrealMetaphorsSection(): string;
//# sourceMappingURL=surreal-metaphors.d.ts.map