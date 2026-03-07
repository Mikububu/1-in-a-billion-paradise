/**
 * FORBIDDEN PHRASES
 *
 * These phrases MUST NEVER appear in any output.
 * They signal "AI slop" and break the literary voice.
 *
 * Source: Michael's gold prompt documents
 */
export declare const FORBIDDEN_PHRASES: string[];
/**
 * Additional forbidden phrases for Spicy Surreal style
 * These sanitize language that should be raw
 */
export declare const FORBIDDEN_PHRASES_SPICY: string[];
/**
 * Build the forbidden phrases section of a prompt
 */
export declare function buildForbiddenSection(style: 'production' | 'spicy_surreal'): string;
//# sourceMappingURL=forbidden.d.ts.map