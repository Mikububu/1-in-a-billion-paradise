"use strict";
/**
 * CENTRALIZED WORD COUNT CONFIG
 * Single source of truth for ALL reading lengths
 * Change here → updates everywhere
 *
 * ALL readings (individual, overlay, nuclear parts, verdict) use the same length
 * Nuclear is just a package containing 16 standard readings
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.WORD_COUNT_LIMITS_VERDICT = exports.WORD_COUNT_LIMITS_OVERLAY = exports.WORD_COUNT_LIMITS = exports.STANDARD_READING = void 0;
exports.getWordTarget = getWordTarget;
exports.STANDARD_READING = {
    // Product baseline: deep, mystical, listener-focused readings.
    min: 5000,
    target: 7000,
    max: 10000,
    audioMinutes: '35-60',
};
function getWordTarget() {
    return `
**WORD COUNT: ${exports.STANDARD_READING.min}-${exports.STANDARD_READING.max} words (${exports.STANDARD_READING.audioMinutes} minutes audio)**
`.trim();
}
// For validation (quality checks) - all reading types use same limits
exports.WORD_COUNT_LIMITS = {
    min: exports.STANDARD_READING.min,
    target: exports.STANDARD_READING.target,
    max: exports.STANDARD_READING.max,
};
// Keep all document types on the same baseline for predictable generation behavior.
exports.WORD_COUNT_LIMITS_OVERLAY = {
    min: exports.STANDARD_READING.min,
    target: exports.STANDARD_READING.target,
    max: exports.STANDARD_READING.max,
};
// Verdict follows the same baseline.
exports.WORD_COUNT_LIMITS_VERDICT = {
    min: exports.STANDARD_READING.min,
    target: exports.STANDARD_READING.target,
    max: exports.STANDARD_READING.max,
};
//# sourceMappingURL=wordCounts.js.map