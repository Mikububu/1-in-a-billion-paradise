/**
 * CENTRALIZED WORD COUNT CONFIG
 * Single source of truth for ALL reading lengths
 * Change here → updates everywhere
 *
 * ALL readings (individual, overlay, nuclear parts, verdict) use the same length
 * Nuclear is just a package containing 16 standard readings
 */

export const STANDARD_READING = {
  min: 4200,
  target: 4500,
  max: 4800,
  audioMinutes: '28-32',
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
