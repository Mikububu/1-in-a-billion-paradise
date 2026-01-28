/**
 * OUTPUT RULES
 * 
 * Minimal output formatting rules for TTS compatibility.
 * Full rules are in the MD file (Part 14).
 */

/**
 * Core output formatting rules
 */
export const OUTPUT_FORMAT_RULES = `
OUTPUT FORMAT (THIS IS SPOKEN AUDIO):
- ONE CONTINUOUS FLOWING ESSAY - no headers in output
- ABSOLUTELY NO markdown syntax (no #, ##, *, **, etc.)
- NO bullet points or numbered lists
- Spell out all numbers: "twenty-three degrees" not "23°"
- NO em-dashes, use commas or semicolons
- 3rd person with person's NAME (never "you")
- Pure prose for TTS conversion
`;

/**
 * Voice rules for deep dive readings
 */
export const VOICE_RULES_DEEP_DIVE = `
VOICE (CRITICAL):
- ALWAYS use 3rd person with the person's NAME
- Write "Michael's Leo Moon reveals..." NOT "Your Leo Moon reveals..."
- NEVER use "you" or "your" in deep dive readings
`;

/**
 * Build complete output rules section
 */
export function buildOutputRulesSection(
  readingType: 'individual' | 'overlay' | 'nuclear',
  voiceMode?: 'self' | 'other',
  personName?: string
): string {
  let rules = OUTPUT_FORMAT_RULES;
  
  if (readingType === 'individual' && voiceMode === 'self' && personName) {
    rules += `\nVOICE: Use "you/your" voice - speaking directly TO ${personName}`;
  } else {
    rules += VOICE_RULES_DEEP_DIVE;
  }
  
  if (readingType === 'overlay' || readingType === 'nuclear') {
    rules += `
RELATIONSHIP STATUS:
- NEVER assume they are together
- Use: "If these two were to enter relationship..."
`;
  }
  
  return rules;
}
