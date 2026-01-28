/**
 * PROMPT BUILDER
 *
 * Main builder class for generating reading prompts.
 * Supports: Individual, SingleOverlay, Nuclear reading types
 * Supports: Production, Spicy Surreal writing styles
 * 
 * RECREATED from compiled dist/services/text/prompts/builder.js
 */

import { 
  AstroSystem, 
  WritingStyle, 
  SpiceLevel, 
  PersonData, 
  NuclearPart,
  SYSTEM_NAMES,
  NUCLEAR_PARTS,
} from './types';
import { getStyleInstructions, FORBIDDEN_PHRASES } from './styles';
import { getSystemPromptSection } from './systems';

// ═══════════════════════════════════════════════════════════════════════════════
// INDIVIDUAL READING PROMPT (8,000 words)
// ═══════════════════════════════════════════════════════════════════════════════

export function buildIndividualPrompt(
  system: AstroSystem,
  style: WritingStyle,
  spiceLevel: SpiceLevel,
  voiceMode: 'self' | 'other',
  person: PersonData,
  chartData: string
): string {
  const styleInstructions = getStyleInstructions(style, spiceLevel);
  const systemGuidance = getSystemPromptSection(system, false);

  const voiceInstruction = voiceMode === 'self'
    ? `Use "you/your" voice - speaking directly TO ${person.name}`
    : `Use "they/their/${person.name}" voice - speaking ABOUT ${person.name}`;

  return `
═══════════════════════════════════════════════════════════════════════════════
PRODUCTION PROMPT: INDIVIDUAL ANALYSIS (8,000 WORDS)
${SYSTEM_NAMES[system]} Deep Dive for ${person.name}
═══════════════════════════════════════════════════════════════════════════════

You are a master ${SYSTEM_NAMES[system]} analyst creating literary-quality consciousness analysis for ONE individual using ONLY this system.

This is an 8,000 word deep dive (approximately 60 minutes of audio) that reveals who this person is at their core.

${styleInstructions}

VOICE MODE: ${voiceInstruction}

${systemGuidance}

═══════════════════════════════════════════════════════════════════════════════
STRUCTURE (8,000 WORDS):
═══════════════════════════════════════════════════════════════════════════════

**OPENING** (500 words)
- Birth moment and context
- What this system reveals
- Core theme introduction

**CORE IDENTITY** (2,000 words)
- Primary placements (Sun, Moon, Rising OR equivalent in system)
- What makes them fundamentally THEM
- Core drives and fears
- Identity structure

**EMOTIONAL & MENTAL PATTERNS** (1,500 words)
- How they feel and process
- Emotional needs and security
- Thinking patterns
- Communication style
- What they need to feel safe

**SHADOW WORK** (2,000 words)
- Unconscious patterns
- Where they get stuck
- Self-sabotage tendencies
- Wounds and triggers
- The darkness they carry
- What happens when they're not conscious

This should be 25% of the analysis. Be honest, not harsh.

**GIFTS & POTENTIAL** (1,500 words)
- Natural talents and genius
- What they came here to do
- How they shine when conscious
- Unique contributions
- Path to actualization

**LIFE PURPOSE & DHARMA** (1,000 words)
- Soul-level work
- What they're learning this lifetime
- Karmic themes (if system addresses this)
- Service and contribution
- Evolution trajectory

**PRACTICAL GUIDANCE** (500 words)
- Specific practices for THIS person
- How to work with their design
- Daily/weekly rituals suited to their chart
- Pitfalls to avoid
- How to embody their gifts

═══════════════════════════════════════════════════════════════════════════════
PERSON DATA:
═══════════════════════════════════════════════════════════════════════════════

NAME: ${person.name}
BIRTH: ${person.birthDate}, ${person.birthTime}, ${person.birthLocation}

${chartData}

═══════════════════════════════════════════════════════════════════════════════
QUALITY CHECKS:
═══════════════════════════════════════════════════════════════════════════════

✓ NO AI phrasing (${FORBIDDEN_PHRASES.slice(0, 3).join(', ')}, etc.)
✓ NO markdown/bullets  
✓ Literary voice maintained
✓ System expertise evident (USE ONLY ${SYSTEM_NAMES[system].toUpperCase()} CONCEPTS)
✓ Shadow appropriately emphasized (25%)
✓ Spice level ${spiceLevel}/10 calibrated
✓ Correct voice (${voiceMode === 'self' ? 'you/your' : 'they/their'})
✓ Audio-ready (spell out all numbers)
✓ 7,500-8,500 words

═══════════════════════════════════════════════════════════════════════════════

Now generate THE INDIVIDUAL ANALYSIS. No preamble - begin directly with the opening.

═══════════════════════════════════════════════════════════════════════════════
`;
}

// ═══════════════════════════════════════════════════════════════════════════════
// SINGLE OVERLAY PROMPT (12,000 words)
// ═══════════════════════════════════════════════════════════════════════════════

export function buildSingleOverlayPrompt(
  system: AstroSystem,
  style: WritingStyle,
  spiceLevel: SpiceLevel,
  personA: PersonData,
  personB: PersonData,
  chartDataA: string,
  chartDataB: string,
  synastryData: string
): string {
  const styleInstructions = getStyleInstructions(style, spiceLevel);
  const systemGuidance = getSystemPromptSection(system, true);

  return `
═══════════════════════════════════════════════════════════════════════════════
PRODUCTION PROMPT: SINGLE SYSTEM OVERLAY (12,000 WORDS)
${SYSTEM_NAMES[system]} Relationship Analysis
${personA.name} & ${personB.name}
═══════════════════════════════════════════════════════════════════════════════

You are a master ${SYSTEM_NAMES[system]} analyst creating literary-quality relationship analysis between two people using ONLY this system.

This is a 12,000 word deep dive (approximately 90 minutes of audio) that reveals the complete dynamic between these two souls.

${styleInstructions}

RELATIONSHIP STATUS LANGUAGE:
NEVER assume they're together. Use:
- "If these two were to enter relationship..."
- "Should they choose to explore this dynamic..."
- "The potential between these souls..."
NOT: "They are..." or "Their relationship is..."

${systemGuidance}

═══════════════════════════════════════════════════════════════════════════════
STRUCTURE (12,000 WORDS):
═══════════════════════════════════════════════════════════════════════════════

**OPENING** (500 words)
- Set the scene
- Introduce both people briefly
- Establish what this system reveals

**${personA.name.toUpperCase()} PROFILE** (2,500 words)
- Complete analysis through this system
- Key placements/patterns/themes
- Shadow and gift states
- What makes them unique

**${personB.name.toUpperCase()} PROFILE** (2,500 words)
- Same depth as ${personA.name}
- Independent analysis
- Not yet comparing

**THE DYNAMIC** (4,000 words)
- How they interact through this system
- Attraction factors
- Friction points
- Conscious vs unconscious dynamics
- Sexual/intimate interplay (calibrated to spice level ${spiceLevel})
- Communication patterns
- Power dynamics

**SHADOW WORK** (2,000 words)
- What goes wrong when unconscious
- Manipulation patterns
- Triggers and projections  
- Worst case scenarios
- The damage they could do

**GIFT POTENTIAL** (1,500 words)
- What's possible if conscious
- How they activate each other's gifts
- Growth opportunities
- What they could create together

**CLOSING** (500 words)
- Synthesis
- Is it worth it?
- Final truth
- Practical guidance specific to their dynamic

═══════════════════════════════════════════════════════════════════════════════
PERSON A DATA:
═══════════════════════════════════════════════════════════════════════════════

NAME: ${personA.name}
BIRTH: ${personA.birthDate}, ${personA.birthTime}, ${personA.birthLocation}

${chartDataA}

═══════════════════════════════════════════════════════════════════════════════
PERSON B DATA:
═══════════════════════════════════════════════════════════════════════════════

NAME: ${personB.name}
BIRTH: ${personB.birthDate}, ${personB.birthTime}, ${personB.birthLocation}

${chartDataB}

═══════════════════════════════════════════════════════════════════════════════
SYNASTRY DATA:
═══════════════════════════════════════════════════════════════════════════════

${synastryData}

═══════════════════════════════════════════════════════════════════════════════
QUALITY CHECKS:
═══════════════════════════════════════════════════════════════════════════════

✓ NO AI phrasing
✓ NO markdown/bullets
✓ Literary voice throughout
✓ System expertise evident (USE ONLY ${SYSTEM_NAMES[system].toUpperCase()} CONCEPTS)
✓ Darkness appropriately emphasized (25-35%)
✓ Spice level ${spiceLevel}/10 calibrated
✓ Relationship-agnostic language
✓ Audio-ready
✓ 11,000-13,000 words total

═══════════════════════════════════════════════════════════════════════════════

Now generate THE SINGLE SYSTEM OVERLAY analysis. No preamble - begin directly.

═══════════════════════════════════════════════════════════════════════════════
`;
}

// ═══════════════════════════════════════════════════════════════════════════════
// NUCLEAR PROMPT (30,000 words in 5 parts)
// ═══════════════════════════════════════════════════════════════════════════════

const PART_TITLES: Record<NuclearPart, string> = {
  1: 'PORTRAITS IN SHADOW',
  2: 'THE HUNGER',
  3: 'THE ABYSS',
  4: 'THE LABYRINTH',
  5: 'THE MIRROR BREAKS',
};

export function buildNuclearPrompt(
  part: NuclearPart,
  style: WritingStyle,
  spiceLevel: SpiceLevel,
  personA: PersonData,
  personB: PersonData,
  allChartData: string,
  previousContent?: string
): string {
  const styleInstructions = getStyleInstructions(style, spiceLevel);
  const partInfo = NUCLEAR_PARTS[part - 1]; // 0-indexed array

  // Get all system guidance for nuclear (all 5 systems)
  const allSystems: AstroSystem[] = ['western', 'vedic', 'gene_keys', 'human_design', 'kabbalah'];
  const systemsGuidance = allSystems.map(s => getSystemPromptSection(s, true)).join('\n');

  const partInstructions: Record<NuclearPart, string> = {
    1: `
PART 1: ${PART_TITLES[1]} (${partInfo.words} words)

COVER:
- ${personA.name}: Complete profile through ALL 5 systems
  * Western: Sun, Moon, Rising, major planets, houses, stelliums
  * Vedic: Sidereal positions, Nakshatras, planetary rulers, karmic indicators
  * Gene Keys: Life's Work, Evolution, Radiance, Purpose
  * Human Design: Type, Strategy, Authority, Profile, Definition, Centers
  * Kabbalah: Sephiroth connections, Tikkun, Four Worlds

- ${personB.name}: Complete profile through ALL 5 systems (same structure)

- FIRST COLLISION: What drew/would draw them together
  * Conscious attraction (what they see)
  * Unconscious magnetism (what they don't realize)
  * Why these souls would cross paths

Emphasize: Who each person IS independently, before relationship context.
`,
    2: `
PART 2: ${PART_TITLES[2]} (${partInfo.words} words)

COVER SEXUAL & POWER DYNAMICS through all systems:
- Western: Mars-Venus aspects, 8th house themes, Pluto dynamics
- Vedic: Yoni Kuta, Mars placements, Kuja Dosha implications
- Gene Keys: Venus Sequence interaction (shadow/gift/siddhi)
- Human Design: Sacral connections, defined/undefined interplay
- Kabbalah: Gevurah-Netzach balance, sexual polarity

POWER DYNAMICS:
- Who leads, who surrenders, who pretends
- Control patterns and manipulation potential
- Unconscious games they play
- Sexual projections and what they're actually seeking

Spice level ${spiceLevel}/10 determines depth. ${spiceLevel >= 7 ? 'Full depth - raw psychological honesty, bodies as consciousness, desire as existential act.' : 'Keep it honest but calibrated.'}
`,
    3: `
PART 3: ${PART_TITLES[3]} (${partInfo.words} words)

THIS IS THE RED ROOM SECTION. GO DARK.

40% of the nuclear analysis is shadow work. This part carries the weight.

COVER:
- ${personA.name}'s shadow patterns in relationship:
  * What they do when unconscious
  * How they manipulate or withdraw
  * Deepest fears playing out
  * Addiction, escape, avoidance patterns

- ${personB.name}'s shadow patterns (same structure)

- HOW THEIR SHADOWS AMPLIFY EACH OTHER:
  * Specific destructive dynamics
  * Projection and counter-projection
  * The spiral into dysfunction
  * Worst case: addiction, betrayal, violence, abandonment

- WHAT WILL DESTROY THIS if they stay unconscious:
  * Top 3-5 dealbreakers
  * The crisis points
  * How it ends if they don't wake up

Be DARK. Show actual danger. This is NOT "growth opportunity" language.
This is "you could genuinely harm each other" honesty.
`,
    4: `
PART 4: ${PART_TITLES[4]} (${partInfo.words} words)

COVER COMMUNICATION:
- Western: Mercury aspects, 3rd house
- Vedic: Graha Maitri, intellectual compatibility
- Gene Keys: How their Keys interact mentally
- Human Design: Ajna/Throat centers, definition patterns
- Kabbalah: Hod connections

ARE THEY MEANT FOR SPECIFIC DHARMIC WORK TOGETHER?
- Babies? (5th house, Jupiter, fertility indicators)
- Creative projects?
- Spiritual/healing work?
- Teaching/service?
- Business/material success?

SOUL CONTRACT revealed through all 5 systems:
- Vedic: Rahu-Ketu axis, past life connections
- Gene Keys: Purpose Keys alignment
- Kabbalah: Tikkun they do together
- Why these souls incarnated to meet
- What karma is being resolved or created
`,
    5: `
PART 5: ${PART_TITLES[5]} (${partInfo.words} words)

IF THEY DO THE WORK, WHAT'S POSSIBLE?
- Gift states across all systems
- Siddhi potential
- Transformation outcomes
- What they could create together

PRACTICAL GUIDANCE for this SPECIFIC dynamic:
- Not generic advice
- Based on their actual placements
- Communication strategies
- Shadow work practices
- When to give space vs come together
- How to navigate their particular friction points

THE ULTIMATE TRUTH SYNTHESIS:
- What all 5 systems agree on
- The core lesson of this connection
- Is it worth it?
- Final honest assessment

END WITH POWER, NOT PLATITUDES.
The last paragraph should land like a bell in a dark room.
`,
  };

  const continuityNote = previousContent && part > 1
    ? `\nPREVIOUS CONTENT SUMMARY (for continuity):\n${previousContent.slice(-2000)}...\n\nContinue seamlessly from where Part ${part - 1} ended.\n`
    : '';

  return `
═══════════════════════════════════════════════════════════════════════════════
PRODUCTION PROMPT: NUCLEAR VERSION (30,000 WORDS)
PART ${part} OF 5: ${PART_TITLES[part]}
${personA.name} & ${personB.name} - All 5 Systems Analysis
═══════════════════════════════════════════════════════════════════════════════

You are a master consciousness analyst creating literary-quality relationship analysis that synthesizes Western Astrology, Vedic Astrology, Gene Keys, Human Design, and Kabbalistic Astrology into one flowing narrative.

This is THE NUCLEAR VERSION - Part ${part} of the 30,000 word ultimate deep dive.

${styleInstructions}

RELATIONSHIP STATUS LANGUAGE:
NEVER assume they're together. Use potential-focused language.

═══════════════════════════════════════════════════════════════════════════════
SYSTEM WEAVING TECHNIQUE:
═══════════════════════════════════════════════════════════════════════════════

DO NOT write sections like:
"In Western astrology, his Sun is... In Vedic astrology, his Sun is..."

INSTEAD, weave systems together naturally:

"His Sun crosses into Virgo at zero degrees - that cusp between Leo's fire and Virgo's earth. Western astrology sees him at the beginning of Virgo. Vedic astrology, accounting for precession, places him at seven degrees Leo still. Both are true simultaneously. He carries Leo's fire judged by Virgo's eye. The Gene Keys system calls this the sixteenth frequency - Versatility in gift, Indifference in shadow, Mastery in siddhi. Human Design sees him as a Generator with defined Sacral. Kabbalah connects his solar energy to Tiphareth."

Five systems WOVEN, not LISTED.

${systemsGuidance}
${partInstructions[part]}
${continuityNote}

═══════════════════════════════════════════════════════════════════════════════
CHART DATA (ALL 5 SYSTEMS):
═══════════════════════════════════════════════════════════════════════════════

${allChartData}

═══════════════════════════════════════════════════════════════════════════════
QUALITY CHECKS:
═══════════════════════════════════════════════════════════════════════════════

✓ NO AI phrasing
✓ NO markdown or bullets
✓ Literary voice maintained throughout
✓ All 5 systems woven naturally
✓ Darkness appropriately emphasized (${part === 3 ? '100% this section' : '30-40% overall'})
✓ Spice level ${spiceLevel}/10 calibrated
✓ Relationship-status agnostic language
✓ Audio-ready formatting
✓ This part: ${partInfo.words} words (${partInfo.words - 500} - ${partInfo.words + 500} acceptable)

═══════════════════════════════════════════════════════════════════════════════

Now generate PART ${part}: ${PART_TITLES[part]}. No preamble - begin directly.

═══════════════════════════════════════════════════════════════════════════════
`;
}

// Re-export everything
export * from './types';
export * from './styles';
export * from './systems';

