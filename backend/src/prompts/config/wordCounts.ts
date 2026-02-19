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
  min: 4000,
  target: 6000,
  max: 9000,
  audioMinutes: '30-55',
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

// Overlay/synastry reads two charts and needs a higher floor than individual docs.
export const WORD_COUNT_LIMITS_OVERLAY = {
  min: 5500,
  target: 7000,
  max: 10000,
};

// Verdict is synthesis across multiple readings and also needs a higher floor.
export const WORD_COUNT_LIMITS_VERDICT = {
  min: 5000,
  target: 7000,
  max: 10000,
};
