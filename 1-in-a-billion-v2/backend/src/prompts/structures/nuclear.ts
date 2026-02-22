/**
 * NUCLEAR PACKAGE STRUCTURE
 * 
 * 30,000 words | 2 people | ALL 5 systems | ~2.5 hours audio
 * Generated across 5 API calls (one per part)
 * 
 * Source: PROMPT_PRODUCTION_Nuclear.txt, PROMPT_SPICY_SURREAL_Nuclear.txt
 */

export interface NuclearPart {
  number: 1 | 2 | 3 | 4 | 5;
  name: string;
  title: string;
  words: number;
  description: string;
  isShadow: boolean;
  promptHint: string;
}

export const NUCLEAR_PARTS: NuclearPart[] = [
  {
    number: 1,
    name: 'Part 1',
    title: 'PORTRAITS IN SHADOW',
    words: 7000,
    description: 'Complete profiles of both people through all 5 systems, plus first collision dynamics',
    isShadow: false,
    promptHint: 'Generate Part 1: Portraits in Shadow - complete profiles through all 5 systems',
  },
  {
    number: 2,
    name: 'Part 2',
    title: 'THE HUNGER',
    words: 6000,
    description: 'Sexual and power dynamics through all systems, what they\'re actually doing/would do, power plays',
    isShadow: false,
    promptHint: 'Continue with Part 2: The Hunger - sexual and power dynamics',
  },
  {
    number: 3,
    name: 'Part 3',
    title: 'THE ABYSS',
    words: 6000,
    description: 'THE RED ROOM - worst case scenarios, addiction, betrayal, psychological violence, shadow spirals',
    isShadow: true,
    promptHint: 'Continue with Part 3: The Abyss - go DARK, show worst case, no safety',
  },
  {
    number: 4,
    name: 'Part 4',
    title: 'THE LABYRINTH',
    words: 6000,
    description: 'Communication, dharma, soul contract revealed, past lives, what this meeting is FOR',
    isShadow: false,
    promptHint: 'Continue with Part 4: The Labyrinth - soul contract and purpose',
  },
  {
    number: 5,
    name: 'Part 5',
    title: 'THE MIRROR BREAKS',
    words: 5000,
    description: 'Transformation potential, practical guidance, ultimate truth, final synthesis',
    isShadow: false,
    promptHint: 'Continue with Part 5: The Mirror Breaks - synthesis and truth, end with power',
  },
];

export const NUCLEAR_STRUCTURE = {
  name: 'Nuclear Package',
  totalWords: 30000,
  audioMinutes: 150, // 2.5 hours
  parts: NUCLEAR_PARTS,
};

/**
 * Get a specific part configuration
 */
export function getNuclearPart(partNumber: 1 | 2 | 3 | 4 | 5): NuclearPart {
  return NUCLEAR_PARTS[partNumber - 1]!;
}

/**
 * Build structure overview for Nuclear reading
 */
export function buildNuclearStructure(person1Name: string, person2Name: string): string {
  const partsOverview = NUCLEAR_PARTS
    .map(p => `**${p.name}: ${p.title}** (${p.words} words)${p.isShadow ? ' ← THE RED ROOM' : ''}
${p.description}`)
    .join('\n\n');

  return `
═══════════════════════════════════════════════════════════════════════════════
STRUCTURE: ${NUCLEAR_STRUCTURE.name}
${person1Name} & ${person2Name} - All 5 Systems Synthesis
═══════════════════════════════════════════════════════════════════════════════

Total: ~${NUCLEAR_STRUCTURE.totalWords} words (~${NUCLEAR_STRUCTURE.audioMinutes} minutes audio)
Generated across 5 API calls, each part flows into the next.

${partsOverview}

CRITICAL: Each part must flow seamlessly into the next.
Part 3 (The Abyss) is 100% shadow - show the actual danger.
Part 5 should end with a paragraph that "lands like a bell in a dark room."
`;
}

/**
 * Build instructions for a specific Nuclear part
 */
export function buildNuclearPartInstructions(
  partNumber: 1 | 2 | 3 | 4 | 5,
  person1Name: string,
  person2Name: string,
  previousPartSummary?: string
): string {
  const part = getNuclearPart(partNumber);
  
  let continuityNote = '';
  if (partNumber > 1 && previousPartSummary) {
    continuityNote = `
═══════════════════════════════════════════════════════════════════════════════
CONTINUITY - Previous Part Summary:
═══════════════════════════════════════════════════════════════════════════════
${previousPartSummary}

Continue seamlessly from where Part ${partNumber - 1} ended.
Maintain the same voice, same depth, same energy.
`;
  }

  const partSpecificInstructions = getPartSpecificInstructions(part, person1Name, person2Name);

  return `
═══════════════════════════════════════════════════════════════════════════════
NOW GENERATING: ${part.name} - ${part.title}
${person1Name} & ${person2Name}
═══════════════════════════════════════════════════════════════════════════════

Target: ~${part.words} words
${part.isShadow ? '⚠️ THIS IS THE SHADOW SECTION - Go dark. Show the abyss. No safety.' : ''}

${partSpecificInstructions}
${continuityNote}

Begin ${part.name} now. No preamble - just start the content.
`;
}

/**
 * Get part-specific detailed instructions
 */
function getPartSpecificInstructions(part: NuclearPart, name1: string, name2: string): string {
  switch (part.number) {
    case 1:
      return `
PART 1 REQUIREMENTS: PORTRAITS IN SHADOW

Cover ${name1}:
- Complete profile through ALL 5 systems (Western, Vedic, Gene Keys, Human Design, Kabbalah)
- WEAVE systems together, don't list them separately
- Use surreal metaphor: "Their chart is a monastery where five monks practice impossible perfection"

Cover ${name2}:
- Same depth and structure as ${name1}
- Use noir imagery: "They rise through Scorpio's curtain with Saturn and Pluto waiting in the red room"

First Collision:
- What draws them together (if they meet)
- Conscious attraction vs unconscious magnetism
- "Two frequencies that shouldn't harmonize but do, dissonantly, like broken glass chimes"
`;

    case 2:
      return `
PART 2 REQUIREMENTS: THE HUNGER

Sexual and power dynamics through ALL 5 systems:
- What they're actually doing when they touch (or would be doing)
- Raw, explicit (calibrated to spice level), psychological
- Power plays, conscious and unconscious
- Mars-Venus-Pluto warfare

Cover:
- Western: Mars-Venus aspects, 8th house, Pluto
- Vedic: Yoni Kuta, Mars placements, Kuja Dosha
- Gene Keys: Venus Sequence interaction
- Human Design: Sacral connections, defined/undefined interplay
- Kabbalah: Gevurah-Netzach balance

"In bed, one is directing. The other is withholding. Both are starving."
`;

    case 3:
      return `
PART 3 REQUIREMENTS: THE ABYSS (THE RED ROOM)

⚠️ THIS IS 100% SHADOW TERRITORY

Where they go when unconscious:
- Worst case scenarios spelled out in detail
- Addiction potential (substances, sex, each other)
- Betrayal trajectories - how exactly it happens
- Emotional/psychological violence - subtle and overt
- Manipulation patterns - conscious and unconscious
- The moment it becomes irredeemable

Shadow spirals and mutual destruction:
- What triggers the descent
- How one's wound activates the other's weapon
- The death spiral fully mapped

"Her twelfth house planets seduce him toward dissolution. 
His eighth house Mars wants to possess what can't be possessed. 
They could destroy each other elegantly."

DO NOT soften with "but this is an opportunity..."
State the danger FULLY.
`;

    case 4:
      return `
PART 4 REQUIREMENTS: THE LABYRINTH

Communication (or failure thereof):
- How they talk to each other
- Where they fail to hear
- The arguments that loop forever

Soul contract revealed through all 5 systems:
- Vedic: Rahu-Ketu axis, past life connections
- Gene Keys: Purpose Keys alignment
- Kabbalah: Tikkun they do together
- What karma is being resolved or created

Are they meant for:
- Babies? (5th house, Jupiter, fertility indicators)
- Creative projects?
- Spiritual/healing work?
- Business/material success?
- Mutual annihilation?

"Two souls don't cross paths accidentally. But the purpose isn't always love."
`;

    case 5:
      return `
PART 5 REQUIREMENTS: THE MIRROR BREAKS

If they DO the work:
- Transformation potential
- Gift states across all systems
- Siddhi potential
- What they could create together

If they DON'T:
- How it ends
- The specific breaking point
- What each walks away with (or without)

Practical guidance for THIS SPECIFIC DYNAMIC:
- Not generic advice
- Based on their actual placements
- Communication strategies
- Shadow work practices
- When to give space vs come together

The ultimate truth synthesis:
- What all 5 systems agree on
- The core lesson of this connection
- Is it worth it? Answer honestly.

Final paragraph must land like a bell in a dark room.
End with power, not platitudes.
`;

    default:
      return '';
  }
}
