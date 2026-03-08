/**
 * WRITING ENHANCEMENTS
 *
 * Ported from v2 prompt engine (legacy). Contains the highest-value
 * prompt components that were NOT carried over when the trigger engine
 * replaced v2: forbidden phrases, quality checks, storytelling voice,
 * surreal metaphors, and INSTEAD-OF/WRITE transformations.
 *
 * Injected into every trigger-engine writing call via
 * `buildWritingEnhancements()`.
 */

import { buildForbiddenSection } from '../../prompts/core/forbidden';

// ─── QUALITY SELF-CHECK ─────────────────────────────────────────────────────

const QUALITY_SELF_CHECK = `
QUALITY VERIFICATION (self-check before delivering):
- NO AI phrasing ("this is not just...", "here's the thing...", etc.)
- NO markdown, bullets, or formatting artifacts
- Literary voice maintained throughout - every sentence earns its place
- Audio-ready: numbers spelled out, no unicode symbols, no broken words
- Pure prose, flowing paragraphs - headlines have spacing for TTS pauses
- Shadow appropriately present (25-40% of content)
- Correct voice maintained (third person / names, never "you" or "your")
- Every paragraph adds new consequence or evidence from the chart data
`;

// ─── STORYTELLING VOICE ─────────────────────────────────────────────────────

const OPENING_VOICE = `
HOW TO BEGIN:
Your first line is an invocation, not a headline. Up to 20 words.
It should make the listener pause. Lean in. Feel something is about to be revealed.

Think of how the great ones would begin:
GARCIA MARQUEZ: a moment suspended in time - "She was born the year the river forgot how to reach the sea."
ANAIS NIN: sensation and desire - "There is a hunger in her chart that no lover has ever named."
RUMI: speaking directly to the soul - "Before you were given a name, the stars already knew your wound."
DAVID LYNCH: beautiful unease - "The room where his Moon lives has no windows, only mirrors."

Draw the listener into the mystery. The first twenty words should feel like entering a dream.
`;

const SHADOW_VOICE = `
SHADOW AND DEPTH:
The shadow is not a problem to fix. It is the gift, asleep.
Never leave a wound unnamed, and never leave it unopened.

- The shadow contains the unlived gold. Every wound must reveal what becomes possible when it becomes conscious.
- Every pattern has intelligence. Before naming its cost, name what it was trying to protect.
- Naming the truth is the first act of freedom. The reading should feel like liberation, not punishment.
- Name the wound. Name the pattern. Name the cost. Name the loop.
- Tragic realism: destiny pressure, conditional inevitability, the cost of the gift.
- No euphemisms for taboo truth: death, grief, addiction, sexual shadow.
`;

// ─── FEW-SHOT TRANSFORMATION EXAMPLES ───────────────────────────────────────

const TRANSFORMATIONS = `
QUALITY EXAMPLES - Study these transformations:

INSTEAD OF: "They have challenging Mars-Venus aspects that create tension."
WRITE: "When he touches her, his Mars in Leo wants to be worshipped for the touching itself. Her Venus in Libra wants the dance, the seduction, the aesthetic of desire. Neither is actually present. He is performing perfection. She is choreographing beauty. The intimacy happens in the space between their fantasies, which means it does not happen at all."

INSTEAD OF: "Her Scorpio rising gives her an intense presence."
WRITE: "She rises in Scorpio. The curtain parts. Behind it waits the red room where Saturn and Pluto sit like spiders, patient, ancient, hungry. When you meet her, you are not meeting her - you are meeting what she has constructed to protect what she actually is."

INSTEAD OF: "His Virgo stellium creates perfectionist tendencies."
WRITE: "Five planets crowd into Virgo in his ninth house like monks in a monastery, each one dedicated to the impossible practice of perfecting the imperfectable. He came here to serve by making things better, but the wound underneath drives the service: nothing he does will ever be good enough because HE is not good enough. The tragedy is he is brilliant. The deeper tragedy is his brilliance cannot see itself."

The pattern: Visceral. Surreal. Penetrating. Specific. Alive.
`;

// ─── SURREAL METAPHOR ARCHITECTURE ──────────────────────────────────────────

const SURREAL_METAPHORS = `
SURREAL METAPHOR ARCHITECTURE - Make the abstract viscerally real:

Planets as Entities: Planets are not positions but living entities with personality.
"Saturn in Scorpio in the twelfth house does not sit - it crouches. It waits in the room behind the room."

Houses as Rooms: The twelve houses are literal rooms in the house of the psyche.
"His ninth house holds five planets. It is crowded with seekers. But the twelfth house - the room of dissolution? Empty."

Aspects as Architecture: Aspects are hallways that connect or fail to connect.
"Their Suns square at eighty-nine point six degrees - the corner you cannot see around, the wall you keep hitting."

Signs as Territories: Signs are landscapes with specific weather and terrain.
"Scorpio is not a sign but a country. The border crossing is guarded by something that checks your willingness to die."

The goal: Make astrological positions feel like PLACES you could walk through,
ENTITIES you could meet, ARCHITECTURE you could get lost in.
`;

// ─── PUBLIC API ──────────────────────────────────────────────────────────────

/**
 * Build the writing enhancements block for individual trigger-engine readings.
 * Appended to the writing prompt BEFORE the chart data section.
 *
 * @param style - 'production' or 'spicy_surreal'
 * @param includeExamples - include few-shot transformations + surreal metaphors (default true)
 */
export function buildWritingEnhancements(
  style: 'production' | 'spicy_surreal' = 'production',
  includeExamples: boolean = true,
): string {
  const sections: string[] = [];

  // 1. Forbidden phrases (anti-slop)
  sections.push(buildForbiddenSection(style));

  // 2. Opening voice + shadow depth
  sections.push(OPENING_VOICE);
  sections.push(SHADOW_VOICE);

  // 3. Few-shot examples (only if requested — saves tokens for shorter readings)
  if (includeExamples) {
    sections.push(TRANSFORMATIONS);
    sections.push(SURREAL_METAPHORS);
  }

  // 4. Quality self-check
  sections.push(QUALITY_SELF_CHECK);

  return sections.join('\n');
}

/**
 * Lighter version for overlay readings — skips surreal metaphors
 * (overlays already have extensive system-specific guidance).
 */
export function buildOverlayWritingEnhancements(
  style: 'production' | 'spicy_surreal' = 'production',
): string {
  const sections: string[] = [];

  sections.push(buildForbiddenSection(style));
  sections.push(OPENING_VOICE);
  sections.push(SHADOW_VOICE);

  // Overlay-specific quality checks
  sections.push(`
OVERLAY QUALITY:
- Relationship-status agnostic language - describe the dynamic, not "the relationship"
- Both people analyzed independently before the collision dynamic
- Alternate who you mention first - this is about the PAIR
- The attraction and the damage are not separate things. Name both.
`);

  sections.push(QUALITY_SELF_CHECK);

  return sections.join('\n');
}
