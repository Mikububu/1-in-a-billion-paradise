/**
 * CENTRALIZED WORD COUNT CONFIG
 * Single source of truth for ALL reading lengths
 * Change here → updates everywhere
 * 
 * ALL readings (individual, overlay, nuclear parts, verdict) use the same length
 * Nuclear is just a package containing 16 standard readings
 */

export const STANDARD_READING = {
  // Product baseline: deep, mystical, listener-focused readings.
  min: 5000,
  target: 7000,
  max: 10000,
  audioMinutes: '35-60',
};

export function getWordTarget(): string {
  return `
**WORD COUNT: ${STANDARD_READING.min}-${STANDARD_READING.max} words (${STANDARD_READING.audioMinutes} minutes audio)**
`.trim();
}

// For validation (quality checks) - all reading types use same limits
export const WORD_COUNT_LIMITS = {
  min: STANDARD_READING.min,
  target: STANDARD_READING.target,
  max: STANDARD_READING.max,
};

// Keep all document types on the same baseline for predictable generation behavior.
export const WORD_COUNT_LIMITS_OVERLAY = {
  min: STANDARD_READING.min,
  target: STANDARD_READING.target,
  max: STANDARD_READING.max,
};

// Verdict follows the same baseline.
export const WORD_COUNT_LIMITS_VERDICT = {
  min: STANDARD_READING.min,
  target: STANDARD_READING.target,
  max: STANDARD_READING.max,
};
