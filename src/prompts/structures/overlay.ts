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
 * Matches "b4 Cowork" version with personName interpolation
 */
export function buildOverlayStructure(person1Name: string, person2Name: string): string {
  return `
═══════════════════════════════════════════════════════════════════════════════
OUTPUT REQUIREMENTS
═══════════════════════════════════════════════════════════════════════════════

**WORD COUNT: 3000 WORDS. This becomes 18-20 minutes of audio.**

STRUCTURE (for your guidance only - do NOT include headers in output):
1. The Attraction - what draws ${person1Name} and ${person2Name} together magnetically (700 words)
2. The Friction - where they clash and what drives them crazy (600 words)
3. Sex & Power - who dominates, who surrenders, bedroom as battlefield and sanctuary (700 words)
4. The Shadow Dance - how they wound each other, destruction potential (700 words)
5. The Gift - what they could become together if conscious (300 words)

FORMAT RULES (THIS IS SPOKEN AUDIO):
- OPENING: Begin like a mystery theater of longing - an invocation that draws two souls into focus (up to 20 words)
  Think: García Márquez, Anaïs Nin, Rumi, David Lynch. Set the atmosphere.
- Then ONE CONTINUOUS ESSAY - no section headers, let the story of these two souls unfold
- Use both names (never "you/your")
- Pure prose - NO asterisks, NO markdown, NO bullets
- Spell out all numbers
- NO em-dashes, NO AI phrases

Tell the story of these two souls now:
`;
}
