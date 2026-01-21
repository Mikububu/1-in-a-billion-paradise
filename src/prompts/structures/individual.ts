/**
 * INDIVIDUAL READING STRUCTURE
 * 
 * 2,000 words | 1 person | 1 system | ~15 min audio
 * 
 * Source: PROMPT_PRODUCTION_Individual.txt
 */

export const INDIVIDUAL_STRUCTURE = {
  name: 'Individual Deep Dive',
  totalWords: 2800,
  audioMinutes: 18,
  
  sections: [
    {
      name: 'Opening',
      words: 150,
      description: 'Birth moment and context, what this system reveals',
    },
    {
      name: 'Core Identity',
      words: 500,
      description: 'Primary placements, what makes them fundamentally THEM, core drives',
    },
    {
      name: 'Emotional & Relational Patterns',
      words: 400,
      description: 'How they feel and process, emotional needs, what they need from partners',
    },
    {
      name: 'Shadow Work',
      words: 500,
      description: 'Unconscious patterns, self-sabotage tendencies, where they get stuck',
      isShadow: true,
    },
    {
      name: 'Gifts & Potential',
      words: 300,
      description: 'Natural talents, how they shine when conscious',
    },
    {
      name: 'Practical Guidance',
      words: 150,
      description: 'How to love them, what triggers them, what they need to feel safe',
    },
  ],
};

/**
 * Build structure instructions for Individual reading
 */
export function buildIndividualStructure(personName: string): string {
  const sections = INDIVIDUAL_STRUCTURE.sections
    .map(s => `**${s.name}** (${s.words} words)${s.isShadow ? ' ← SHADOW SECTION' : ''}
${s.description}`)
    .join('\n\n');

  return `
═══════════════════════════════════════════════════════════════════════════════
STRUCTURE: ${INDIVIDUAL_STRUCTURE.name} for ${personName}
═══════════════════════════════════════════════════════════════════════════════

**CRITICAL: WRITE 2500-3000 WORDS. This must be 15-20 minutes of audio.**

The structure above is FOR YOUR GUIDANCE ONLY - do NOT include section headers in output.

⚠️ THIS IS SPOKEN AUDIO - every word will be heard aloud via TTS

OUTPUT RULES:
- Open with presence - an invocation, not a headline (up to 20 words that draw the listener in)
- Then ONE CONTINUOUS ESSAY - no section headers, no "Core Identity" or "Shadow Work" labels
- Let the story unfold naturally - you are a storyteller, not an analyst
- Use 3RD PERSON with ${personName}'s name (never "you/your")
- Pure prose ONLY - NO asterisks, NO markdown, NO bullets, NO formatting
- Audio-ready: spell out numbers ("twenty-three degrees" not "23°")
- NO em-dashes (—), use commas or periods
- Shadow Work = 25% of content. Be honest but not cruel.
`;
}
