/**
 * WRITING STYLES
 *
 * Style-specific instructions for different reading voices.
 * Production: Literary consciousness documentary
 * Spicy Surreal: Dark Soul Storytelling - consciousness noir
 */

import { WritingStyle, SpiceLevel } from './types';

// ═══════════════════════════════════════════════════════════════════════════════
// FORBIDDEN PHRASES (Both Styles)
// ═══════════════════════════════════════════════════════════════════════════════

export const FORBIDDEN_PHRASES = [
  'This is not just...',
  'This is not about...',
  'But here\'s the thing...',
  'Here\'s what\'s really happening...',
  'Let me show you...',
  'Now here\'s where it gets interesting...',
  'The truth is...',
  'What most people don\'t realize...',
];

// ═══════════════════════════════════════════════════════════════════════════════
// PRODUCTION STYLE
// ═══════════════════════════════════════════════════════════════════════════════

export const PRODUCTION_STYLE = {
  name: 'Literary Consciousness Documentary',
  tone: `
- Literary consciousness documentary
- Intimate and penetrating
- Honest about shadows
- Sophisticated but accessible
- David Attenborough narrating human souls
- PhD-level consciousness literature
`,
  voiceRules: `
WRITE LIKE:
✓ Direct, vivid, concrete
✓ Active voice and imagery
✓ Pure storytelling, no meta-commentary
✓ Direct statements: "His Virgo stellium creates..."
✓ Concrete imagery: "Five planets gather in Virgo like scholars in a library..."
✓ Active verbs: "She devours experience. He dissects it."

NEVER:
❌ "This is not just..."
❌ "But here's the thing..."
❌ "What's really happening..."
❌ "Let me show you..."
❌ Generic sun sign descriptions
❌ Fortune-telling language
❌ AI corporate speak
`,
  format: `
- Pure prose (NO markdown/bullets/headers)
- Audio-ready (spell everything out: "twenty-three degrees" not "23°")
- Simple separators between major sections: ═══════
- Spell out all numbers and symbols
- Natural rhythm for listening
`,
};

// ═══════════════════════════════════════════════════════════════════════════════
// DARK SOUL STORYTELLING STYLE
// ═══════════════════════════════════════════════════════════════════════════════

export const SPICY_SURREAL_STYLE = {
  name: 'Dark Soul Storytelling',
  voiceTrinity: `
THE QUALITIES OF DARK SOUL STORYTELLING:

1. STORYTELLING, NOT ANALYSIS
   - Every chart is a character study
   - Find the narrative arc: wounds, patterns, transformations
   - "This is who they actually are beneath the surface"
   - Gut-level honest, no sugarcoating

2. SURREAL IMAGERY
   - The mundane becomes meaningful
   - Dream logic and uncomfortable beauty
   - "Behind the curtain waits..."
   - Silences that scream

3. ARCHETYPAL DEPTH
   - The personal becomes mythological
   - Shadow as living entity
   - The unconscious speaks in symbols

This is consciousness noir - intimate, penetrating, unforgettable.
`,
  tone: `
- Consciousness noir, deep psychology, surreal mythology
- NOT: professional astrology report, self-help book, spiritual guidance
- Visceral, penetrating, occasionally shocking
- Dark psychological depth
- Zero fluff or filler
`,
  languageRules: `
KILL THESE IMMEDIATELY:
❌ "This is not just..."
❌ "Here's what's really happening..."
❌ "The truth is..."
❌ Any corporate/safe/sanitized language
❌ "Challenges" (say WOUNDS, TRAPS, ABYSSES)

USE THESE:
✓ Raw verbs: devour, penetrate, consume, shatter, burn, dissolve
✓ Body language: sweat, blood, bone, flesh, nerve, marrow
✓ Surreal metaphor: "Her Moon lives in the room where clocks melt"
✓ Psychological depth: hunger, possession, surrender, obsession
✓ Mythological: serpent, abyss, labyrinth, mirror, shadow, descent
✓ Uncomfortable beauty: "His Virgo stellium is a surgical theater where he dissects his own heart"
`,
  surreal: `
SURREAL METAPHOR ARCHITECTURE:

PLANETS AS ENTITIES:
"Saturn in Scorpio in the twelfth house doesn't sit - it crouches. It waits in the room behind the room, the one with no door, the one you only access through crisis or dreams or the kind of surrender that feels like dying."

NAKSHATRAS AS MYTHIC SPACES:
"His Moon in Magha, ruled by Ketu, the headless one. Magha is the throne room of the ancestors, the place where past kings sit in judgment. He carries their expectations in his bones."

ASPECTS AS ARCHITECTURE:
"Their Suns square at eighty-nine point six degrees - Lynch would film it as two hallways that should intersect but don't, the people walking them never quite meeting, always aware something's wrong with the geometry."

HOUSES AS ROOMS:
"His ninth house holds five planets. It's crowded with seekers. But the twelfth house - the room of dissolution? Empty. He has no defense against the invisible. She LIVES in the room he doesn't know exists."
`,
  format: `
- Pure prose, flowing paragraphs
- NO markdown (no #, **, -, etc.)
- NO bullet points or lists
- Audio-ready (spell out degrees, positions)
- Use simple separators: ═══════
`,
};

// ═══════════════════════════════════════════════════════════════════════════════
// SPICE LEVEL CALIBRATION
// ═══════════════════════════════════════════════════════════════════════════════

export function getSpiceInstructions(level: SpiceLevel, style: WritingStyle): string {
  if (style === 'spicy_surreal') {
    // Spicy Surreal defaults to high spice
    if (level <= 3) {
      return `
SPICE LEVEL ${level}/10 - Still honest, gentler:
- Psychological depth, less graphic
- "Physical intimacy reveals their core patterns. He analyzes when he should feel. She protects when she should open."
`;
    }
    if (level <= 6) {
      return `
SPICE LEVEL ${level}/10 - Tone down but stay honest:
- Still psychological depth, less explicit
- "In bed, something breaks down. His need to perfect the act wars with her need to feel safe enough to actually be present."
`;
    }
    return `
SPICE LEVEL ${level}/10 - Full Depth:
- Write about intimacy with raw psychological honesty
- Bodies as consciousness, desire as existential act
- Power dynamics raw and explicit
- "The raw animal collision of need meeting need, bodies speaking what words cannot..."
`;
  }

  // Production style spice calibration
  if (level <= 2) {
    return `
SPICE LEVEL ${level}/10 - Gentle, encouraging, growth-focused:
- Emphasize potential and gifts
- Shadow work framed as opportunity
- Soft but honest language
`;
  }
  if (level <= 4) {
    return `
SPICE LEVEL ${level}/10 - Honest but compassionate:
- Direct about challenges
- Balance shadow with light
- Truth with care
`;
  }
  if (level <= 6) {
    return `
SPICE LEVEL ${level}/10 - Brutally honest, no sugarcoating:
- Call out patterns directly
- Don't soften the shadow
- Truth over comfort
`;
  }
  if (level <= 8) {
    return `
SPICE LEVEL ${level}/10 - Raw, dark, occasionally shocking:
- Show the abyss fully
- Addiction, manipulation, destruction
- Make them uncomfortable with truth
`;
  }
  return `
SPICE LEVEL ${level}/10 - Absolutely unfiltered, nuclear honesty:
- Scorched earth truth-telling
- Nothing held back
- The full darkness AND the full light
`;
}

// ═══════════════════════════════════════════════════════════════════════════════
// GET STYLE CONFIG
// ═══════════════════════════════════════════════════════════════════════════════

export function getStyleConfig(style: WritingStyle): typeof PRODUCTION_STYLE | typeof SPICY_SURREAL_STYLE {
  return style === 'spicy_surreal' ? SPICY_SURREAL_STYLE : PRODUCTION_STYLE;
}

export function getStyleInstructions(style: WritingStyle, spiceLevel: SpiceLevel): string {
  const config = getStyleConfig(style);
  const spiceInstructions = getSpiceInstructions(spiceLevel, style);

  if (style === 'spicy_surreal') {
    return `
═══════════════════════════════════════════════════════════════════════════════
WRITING STYLE: ${config.name}
═══════════════════════════════════════════════════════════════════════════════

${(config as typeof SPICY_SURREAL_STYLE).voiceTrinity}

TONE:
${config.tone}

LANGUAGE RULES:
${(config as typeof SPICY_SURREAL_STYLE).languageRules}

SURREAL METAPHOR:
${(config as typeof SPICY_SURREAL_STYLE).surreal}

FORMAT:
${config.format}

${spiceInstructions}
`;
  }

  return `
═══════════════════════════════════════════════════════════════════════════════
WRITING STYLE: ${config.name}
═══════════════════════════════════════════════════════════════════════════════

TONE:
${config.tone}

VOICE RULES:
${(config as typeof PRODUCTION_STYLE).voiceRules}

FORMAT:
${config.format}

${spiceInstructions}
`;
}
