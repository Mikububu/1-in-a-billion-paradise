/**
 * INDIVIDUAL READING STRUCTURE
 *
 * Word count: Controlled SOLELY by src/prompts/config/wordCounts.ts (STANDARD_READING).
 * Do NOT hardcode word counts here — getWordTarget() is the single source of truth.
 * Section breakdowns below are proportional guides that sum to the STANDARD_READING.target (7000).
 *
 * Source: PROMPT_PRODUCTION_Individual.txt
 */

import { STANDARD_READING } from '../config/wordCounts';

export const INDIVIDUAL_STRUCTURE = {
  name: 'Individual Deep Dive',
  get totalWords() { return STANDARD_READING.target; },
  get audioMinutes() { return STANDARD_READING.audioMinutes; },

  sections: [
    {
      name: 'Who They Fundamentally ARE',
      words: 1400,
      description: 'Core identity, what makes them THEM, primary drives and motivations, the soul beneath the surface',
    },
    {
      name: 'How They Love, Attach, and Relate',
      words: 1400,
      description: 'Emotional patterns, attachment style, what they need from partners, how they show love, intimacy patterns',
    },
    {
      name: 'Shadow - Wounds, Patterns, Self-Sabotage, Sexual Shadow',
      words: 2000,
      description: 'Unconscious patterns, repeating loops, what they avoid, sexual psychology, the abyss, addiction potential',
      isShadow: true,
    },
    {
      name: 'Gifts When Conscious',
      words: 1200,
      description: 'Natural talents, how they shine when awake, their superpower, what they become when evolved',
    },
    {
      name: 'How to Love Them - and What Destroys Them',
      words: 1000,
      description: 'Practical guidance for partners, triggers, what they need to feel safe, what breaks them',
    },
  ],
};

/**
 * Build structure instructions for Individual reading.
 *
 * IMPORTANT: Do NOT include a word count here — getWordTarget() in builder.ts
 * is the single source of truth and is injected separately.
 */
export function buildIndividualStructure(personName: string): string {
  return `
═══════════════════════════════════════════════════════════════════════════════
OUTPUT REQUIREMENTS
═══════════════════════════════════════════════════════════════════════════════

STRUCTURE (for your guidance only - do NOT include headers in output):
1. Who ${personName} fundamentally IS - the soul beneath the surface (1400 words)
2. How ${personName} loves, attaches, and relates - intimacy patterns (1400 words)
3. ${personName}'s shadow - wounds, patterns, self-sabotage, sexual shadow, the abyss (2000 words)
4. ${personName}'s gifts when conscious - what they become when evolved (1200 words)
5. How to love ${personName} - and what destroys them (1000 words)

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
