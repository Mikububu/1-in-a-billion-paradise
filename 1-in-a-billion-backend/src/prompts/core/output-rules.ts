/**
 * OUTPUT RULES
 * 
 * Universal formatting and style rules for ALL outputs.
 * These ensure PDF compatibility and audio-readiness.
 * 
 * Source: Michael's gold prompt documents + AI_CONTEXT_COMPLETE.md
 */

/**
 * Core output formatting rules
 */
export const OUTPUT_FORMAT_RULES = `
OUTPUT FORMAT (CRITICAL - FOLLOW EXACTLY):

PROSE STYLE:
- Pure flowing prose paragraphs ONLY
- NO markdown syntax (no #, ##, **, __, -, etc.)
- NO bullet points or numbered lists
- NO section headers with symbols
- Clear paragraph breaks between sections
- Use ═══════ separators between MAJOR sections only

PUNCTUATION:
- Standard punctuation only: . , ; : ' " ? !
- NO em-dashes (—) - use commas or semicolons instead
- NO special symbols or unicode characters

AUDIO-READY:
- Spell out all numbers: "twenty-three degrees" not "23°"
- Spell out positions: "zero degrees Virgo" not "0° Virgo"  
- No abbreviations: "Human Design" not "HD"
- Natural rhythm for listening
- Varied sentence length creates musicality
`;

/**
 * Voice rules for deep dive readings (nuclear, extended, overlays)
 * CRITICAL: Always use 3rd person with NAME
 */
export const VOICE_RULES_DEEP_DIVE = `
VOICE (CRITICAL):
- ALWAYS use 3rd person with the person's NAME
- Write "Michael's Leo Moon reveals..." NOT "Your Leo Moon reveals..."
- Write "Charmaine carries this wound..." NOT "You carry this wound..."
- NEVER use "you" or "your" in deep dive readings
- The reading is ABOUT them, not TO them
`;

/**
 * Voice rules for individual readings (can be self or other)
 */
export function getVoiceRules(voiceMode: 'self' | 'other', personName: string): string {
  if (voiceMode === 'self') {
    return `
VOICE:
- Use "you/your" voice - speaking directly TO ${personName}
- Example: "Your Virgo Sun carries a particular burden..."
- Intimate, direct address
`;
  }
  
  return `
VOICE:
- Use "they/their/${personName}" voice - speaking ABOUT ${personName}
- Example: "${personName}'s Virgo Sun carries a particular burden..."
- Third person, documentary style
`;
}

/**
 * Relationship status language (never assume they're together)
 */
export const RELATIONSHIP_STATUS_RULES = `
RELATIONSHIP STATUS LANGUAGE:
- NEVER assume they are together
- Use potential-focused language:
  ✓ "If these two were to enter relationship..."
  ✓ "Should they choose to explore this dynamic..."
  ✓ "The potential between these souls..."
  ✓ "When these energies meet..."
- NOT: "They are..." or "Their relationship is..."
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
  
  // Add voice rules based on reading type
  if (readingType === 'individual' && voiceMode && personName) {
    rules += getVoiceRules(voiceMode, personName);
  } else {
    // Deep dive readings always use 3rd person
    rules += VOICE_RULES_DEEP_DIVE;
  }
  
  // Add relationship status rules for overlays/nuclear
  if (readingType === 'overlay' || readingType === 'nuclear') {
    rules += RELATIONSHIP_STATUS_RULES;
  }
  
  return rules;
}
