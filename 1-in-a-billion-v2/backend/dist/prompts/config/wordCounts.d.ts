/**
 * CENTRALIZED WORD COUNT CONFIG
 * Single source of truth for ALL reading lengths
 * Change here → updates everywhere
 *
 * ALL readings (individual, overlay, nuclear parts, verdict) use the same length
 * Nuclear is just a package containing 16 standard readings
 */
export declare const STANDARD_READING: {
    min: number;
    target: number;
    max: number;
    audioMinutes: string;
};
export declare function getWordTarget(): string;
export declare const WORD_COUNT_LIMITS: {
    min: number;
    target: number;
    max: number;
};
export declare const WORD_COUNT_LIMITS_OVERLAY: {
    min: number;
    target: number;
    max: number;
};
export declare const WORD_COUNT_LIMITS_VERDICT: {
    min: number;
    target: number;
    max: number;
};
//# sourceMappingURL=wordCounts.d.ts.map