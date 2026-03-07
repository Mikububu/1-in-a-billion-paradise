/**
 * OVERLAY READING STRUCTURE
 *
 * Word count: Controlled SOLELY by src/prompts/config/wordCounts.ts (STANDARD_READING).
 * Do NOT hardcode word counts here - getWordTarget() in builder.ts is the single source of truth.
 * Section breakdowns below are proportional guides that sum to STANDARD_READING.target (7000).
 *
 * CANONICAL PATH: builder.ts → buildOverlayStructure() → getWordTarget()
 * The trigger engine overlay prompts (overlayTrigger.ts) handle strip + trigger + writing
 * but word counts come from the centralized config.
 */
/**
 * Build structure instructions for Overlay reading.
 *
 * IMPORTANT: Do NOT include a word count here - getWordTarget() in builder.ts
 * is the single source of truth and is injected separately.
 */
export declare function buildOverlayStructure(person1Name: string, person2Name: string): string;
//# sourceMappingURL=overlay.d.ts.map