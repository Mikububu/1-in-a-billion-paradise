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
  return `
███████████████████████████████████████████████████████████████████████████████
██  MANDATORY LENGTH: ${STANDARD_READING.min}-${STANDARD_READING.max} WORDS (TARGET: ${STANDARD_READING.target})  ██
███████████████████████████████████████████████████████████████████████████████

THIS IS A PAID PREMIUM READING. The client expects ${STANDARD_READING.audioMinutes} MINUTES of audio.

FAILURE CONDITIONS (reading will be REJECTED and regenerated):
❌ Under ${STANDARD_READING.min} words = TOO SHORT = REJECTED
❌ Summarizing instead of expanding = REJECTED  
❌ Being concise = REJECTED
❌ Skipping depth for brevity = REJECTED

SUCCESS CONDITIONS:
✅ Write ${STANDARD_READING.target}+ words
✅ EXPAND every insight with examples, metaphors, and psychological depth
✅ Each section should be 400-600 words minimum
✅ Use flowing prose, not bullet points
✅ Go DEEP into shadow work, patterns, and transformation

YOU ARE BEING PAID FOR LENGTH AND DEPTH. DELIVER BOTH.
███████████████████████████████████████████████████████████████████████████████
`.trim();
}

// For validation (quality checks) - all reading types use same limits
export const WORD_COUNT_LIMITS = {
  min: STANDARD_READING.min,
  target: STANDARD_READING.target,
  max: STANDARD_READING.max,
};
