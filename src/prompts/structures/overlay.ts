/**
 * SINGLE OVERLAY READING STRUCTURE
 * 
 * 12,000 words | 2 people | 1 system | ~90 min audio
 * 
 * Source: PROMPT_PRODUCTION_SingleOverlay.txt
 */

export const OVERLAY_STRUCTURE = {
  name: 'Single System Overlay',
  totalWords: 12000,
  audioMinutes: 90,
  
  sections: [
    {
      name: 'Opening',
      words: 500,
      description: 'Set the scene, introduce both people briefly, establish what this system reveals',
    },
    {
      name: 'Person A Profile',
      words: 2500,
      description: 'Complete analysis through this system, key patterns and themes, shadow and gift states, independence before relationship',
    },
    {
      name: 'Person B Profile',
      words: 2500,
      description: 'Same depth as Person A, not yet comparing, independent analysis',
    },
    {
      name: 'The Dynamic',
      words: 4000,
      description: 'How they interact, attraction factors, friction points, sexual/intimate interplay, communication patterns, power dynamics',
    },
    {
      name: 'Shadow Work',
      words: 2000,
      description: 'What goes wrong when unconscious, manipulation patterns, triggers and projections, worst case scenarios, the damage they could do',
      isShadow: true,
    },
    {
      name: 'Gift Potential',
      words: 1500,
      description: 'What\'s possible if conscious, how they activate each other\'s gifts, growth opportunities, what they could create together',
    },
    {
      name: 'Closing',
      words: 500,
      description: 'Synthesis, is it worth it?, final truth, practical guidance specific to their dynamic',
    },
  ],
};

/**
 * Build structure instructions for Overlay reading
 */
export function buildOverlayStructure(person1Name: string, person2Name: string): string {
  const sections = OVERLAY_STRUCTURE.sections
    .map(s => {
      let name = s.name;
      if (name === 'Person A Profile') name = `${person1Name}'s Profile`;
      if (name === 'Person B Profile') name = `${person2Name}'s Profile`;
      return `**${name}** (${s.words} words)${s.isShadow ? ' ← SHADOW SECTION' : ''}
${s.description}`;
    })
    .join('\n\n');

  return `
═══════════════════════════════════════════════════════════════════════════════
STRUCTURE: ${OVERLAY_STRUCTURE.name}
${person1Name} & ${person2Name}
═══════════════════════════════════════════════════════════════════════════════

Total: ~${OVERLAY_STRUCTURE.totalWords} words (~${OVERLAY_STRUCTURE.audioMinutes} minutes audio)

The structure below is FOR YOUR GUIDANCE ONLY - do NOT include section headers in output.

⚠️ THIS IS SPOKEN AUDIO - every word will be heard aloud via TTS

OUTPUT RULES:
- Open with presence - an invocation, not a headline (up to 20 words that draw the listener in)
- Then ONE CONTINUOUS ESSAY - no section headers, no "The Dynamic" or "Shadow Work" labels
- Let the story unfold naturally - you are a storyteller, not an analyst
- Use both names in 3rd person (never "you/your")
- Pure prose ONLY - NO asterisks, NO markdown, NO bullets, NO formatting
- Audio-ready: spell out numbers ("twenty-three degrees" not "23°")
- NO em-dashes (—), use commas or periods

CONTENT GUIDANCE:
${sections}

NOTE: Analyze each person INDEPENDENTLY before examining the dynamic.
Shadow section should be 25-35% of total content.
State shadow fully BEFORE offering transformation potential.
`;
}
