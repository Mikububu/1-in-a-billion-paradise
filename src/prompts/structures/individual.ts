/**
 * INDIVIDUAL READING STRUCTURE
 * 
 * Word count controlled by src/prompts/config/wordCounts.ts (STANDARD_READING)
 * 
 * Source: PROMPT_PRODUCTION_Individual.txt
 */

import { STANDARD_READING } from '../config/wordCounts';

export const INDIVIDUAL_STRUCTURE = {
  name: 'Individual Deep Dive',
  totalWords: 2800, // 600+700+800+400+300 = 2800 words (from b4 Cowork version)
  audioMinutes: '17-20',
  
  sections: [
    {
      name: 'Who They Fundamentally ARE',
      words: 600,
      description: 'Core identity, what makes them THEM, primary drives and motivations',
    },
    {
      name: 'How They Love, Attach, and Relate',
      words: 700,
      description: 'Emotional patterns, attachment style, what they need from partners, how they show love',
    },
    {
      name: 'Shadow - Wounds, Patterns, Self-Sabotage, Sexual Shadow',
      words: 800,
      description: 'Unconscious patterns, repeating loops, what they avoid, sexual psychology',
      isShadow: true,
    },
    {
      name: 'Gifts When Conscious',
      words: 400,
      description: 'Natural talents, how they shine when awake, their superpower',
    },
    {
      name: 'How to Love Them - and What Destroys Them',
      words: 300,
      description: 'Practical guidance for partners, triggers, what they need to feel safe',
    },
  ],
};

/**
 * Build structure instructions for Individual reading
 * Matches "b4 Cowork" version with personName interpolation
 */
export function buildIndividualStructure(personName: string): string {
  return `
═══════════════════════════════════════════════════════════════════════════════
OUTPUT REQUIREMENTS
═══════════════════════════════════════════════════════════════════════════════

**WORD COUNT: 2500-3000 WORDS MINIMUM. This becomes 15-20 minutes of audio.**

STRUCTURE (for your guidance only - do NOT include headers in output):
1. Who ${personName} fundamentally IS (600 words)
2. How ${personName} loves, attaches, and relates (700 words)
3. ${personName}'s shadow - wounds, patterns, self-sabotage, sexual shadow (800 words)
4. ${personName}'s gifts when conscious (400 words)
5. How to love ${personName} - and what destroys them (300 words)

FORMAT RULES (THIS IS SPOKEN AUDIO):
- OPENING: Begin like a fairytale for adults - an invocation that makes the listener pause (up to 20 words)
  Think: García Márquez, Anaïs Nin, Rumi, David Lynch. Draw them into the mystery.
- Then ONE CONTINUOUS ESSAY - no section headers, let the story unfold
- 3rd person with ${personName}'s name (never "you/your")
- Pure prose - NO asterisks, NO markdown, NO bullets
- Spell out numbers ("twenty-three degrees")
- NO em-dashes (—), use commas or periods
- NO AI phrases ("This is not just...", "Here's the thing...")

Tell ${personName}'s story now:
`;
}
