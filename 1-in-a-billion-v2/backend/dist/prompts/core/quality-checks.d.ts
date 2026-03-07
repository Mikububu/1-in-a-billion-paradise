/**
 * QUALITY CHECKS
 *
 * Verification checklist appended to prompts.
 * Reminds the LLM what to verify before delivering.
 *
 * Source: Michael's gold prompt documents
 */
/**
 * Base quality checks for all outputs
 */
export declare const BASE_QUALITY_CHECKS: string[];
/**
 * Style-specific quality checks
 */
export declare const PRODUCTION_QUALITY_CHECKS: string[];
export declare const SPICY_SURREAL_QUALITY_CHECKS: string[];
/**
 * Reading type specific checks
 */
export declare const NUCLEAR_QUALITY_CHECKS: string[];
export declare const OVERLAY_QUALITY_CHECKS: string[];
export declare const INDIVIDUAL_QUALITY_CHECKS: string[];
/**
 * Word count checks by reading type - ALL use same standard
 */
export declare const WORD_COUNT_TARGETS: {
    individual: {
        min: number;
        target: number;
        max: number;
    };
    overlay: {
        min: number;
        target: number;
        max: number;
    };
    nuclear_part: {
        min: number;
        target: number;
        max: number;
    };
    verdict: {
        min: number;
        target: number;
        max: number;
    };
};
/**
 * Build quality verification section
 */
export declare function buildQualitySection(style: 'production' | 'spicy_surreal', readingType: 'individual' | 'overlay' | 'nuclear', partNumber?: number): string;
//# sourceMappingURL=quality-checks.d.ts.map