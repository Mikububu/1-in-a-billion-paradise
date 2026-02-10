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
  totalWords: 4500, // 1000+1000+1400+600+500 = 4500 words (~30 min audio)
  audioMinutes: '28-32',

  sections: [
    {
      name: 'Who They Fundamentally ARE',
      words: 1000,
      description: 'Core identity, what makes them THEM, primary drives and motivations, the soul beneath the surface',
    },
    {
      name: 'How They Love, Attach, and Relate',
      words: 1000,
      description: 'Emotional patterns, attachment style, what they need from partners, how they show love, intimacy patterns',
    },
    {
      name: 'Shadow - Wounds, Patterns, Self-Sabotage, Sexual Shadow',
      words: 1400,
      description: 'Unconscious patterns, repeating loops, what they avoid, sexual psychology, the abyss, addiction potential',
      isShadow: true,
    },
    {
      name: 'Gifts When Conscious',
      words: 600,
      description: 'Natural talents, how they shine when awake, their superpower, what they become when evolved',
    },
    {
      name: 'How to Love Them - and What Destroys Them',
      words: 500,
      description: 'Practical guidance for partners, triggers, what they need to feel safe, what breaks them',
    },
  ],
};

/**
 * Build structure instructions for Individual reading
 * Updated for ~30 minute readings (4500 words)
 */
export function buildIndividualStructure(personName: string): string {
  return `
═══════════════════════════════════════════════════════════════════════════════
OUTPUT REQUIREMENTS
═══════════════════════════════════════════════════════════════════════════════

**WORD COUNT: 4500 WORDS. This becomes 28-32 minutes of audio.**

STRUCTURE (for your guidance only - do NOT include headers in output):
1. Who ${personName} fundamentally IS - the soul beneath the surface (1000 words)
2. How ${personName} loves, attaches, and relates - intimacy patterns (1000 words)
3. ${personName}'s shadow - wounds, patterns, self-sabotage, sexual shadow, the abyss (1400 words)
4. ${personName}'s gifts when conscious - what they become when evolved (600 words)
5. How to love ${personName} - and what destroys them (500 words)

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
