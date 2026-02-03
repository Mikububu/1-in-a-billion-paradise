/**
 * CENTRALIZED WORD COUNT CONFIG
 * Single source of truth for ALL reading lengths
 * Change here → updates everywhere
 * 
 * ALL readings (individual, overlay, nuclear parts, verdict) use the same length
 * Nuclear is just a package containing 16 standard readings
 */

export const STANDARD_READING = {
  min: 2500,
  target: 3000,
  max: 3500,
  audioMinutes: '17-23',
};

export function getWordTarget(): string {
  return `WORD TARGET: ${STANDARD_READING.min}-${STANDARD_READING.max} words (${STANDARD_READING.audioMinutes} minutes audio)`;
}

// For validation (quality checks) - all reading types use same limits
export const WORD_COUNT_LIMITS = {
  min: STANDARD_READING.min,
  target: STANDARD_READING.target,
  max: STANDARD_READING.max,
};
