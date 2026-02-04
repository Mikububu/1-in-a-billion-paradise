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
═══════════════════════════════════════════════════════════════════════════════
⚠️ CRITICAL WORD COUNT REQUIREMENT - NON-NEGOTIABLE ⚠️
═══════════════════════════════════════════════════════════════════════════════
You MUST write EXACTLY ${STANDARD_READING.target} words (minimum ${STANDARD_READING.min}, maximum ${STANDARD_READING.max}).
This produces ${STANDARD_READING.audioMinutes} minutes of audio narration.

DO NOT write less than ${STANDARD_READING.min} words. The reading will be REJECTED if too short.
DO NOT summarize. DO NOT be concise. EXPAND every insight with examples and depth.
Each section should be THOROUGH and COMPREHENSIVE.

COUNT YOUR WORDS. If you're under ${STANDARD_READING.min}, ADD MORE CONTENT.
═══════════════════════════════════════════════════════════════════════════════
`.trim();
}

// For validation (quality checks) - all reading types use same limits
export const WORD_COUNT_LIMITS = {
  min: STANDARD_READING.min,
  target: STANDARD_READING.target,
  max: STANDARD_READING.max,
};
