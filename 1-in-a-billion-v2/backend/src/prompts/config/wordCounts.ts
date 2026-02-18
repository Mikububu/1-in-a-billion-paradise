/**
 * CENTRALIZED WORD COUNT CONFIG
 * Single source of truth for ALL reading lengths
 * Change here → updates everywhere
 * 
 * ALL readings (individual, overlay, nuclear parts, verdict) use the same length
 * Nuclear is just a package containing 16 standard readings
 */

export const STANDARD_READING = {
  // Longer by default to avoid the "great opening then it ends too soon" feel.
  // This also gives the model more room to stay cinematic without collapsing into lecture mode.
  min: 6500,
  target: 8500,
  max: 10000,
  audioMinutes: '45-60',
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
