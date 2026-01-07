/**
 * INDIVIDUAL READING STRUCTURE
 * 
 * 2,000 words | 1 person | 1 system | ~15 min audio
 * 
 * Source: PROMPT_PRODUCTION_Individual.txt
 */

export const INDIVIDUAL_STRUCTURE = {
  name: 'Individual Deep Dive',
  totalWords: 2000,
  audioMinutes: 15,
  
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

**CRITICAL: WRITE EXACTLY 2000 WORDS. Not less, not more.**

${sections}

RULES:
- Use 3RD PERSON with ${personName}'s name (never "you/your")
- Pure prose, NO markdown or bullets
- Audio-ready: spell out numbers ("twenty-three degrees" not "23°")
- NO em-dashes (—), use commas or periods
- Shadow Work = 25% of content. Be honest but not cruel.
`;
}
