/**
 * WRITING STYLES
 * 
 * Defines the different voices/tones for readings.
 * Users can choose between:
 * - PRODUCTION: Literary, sophisticated, honest
 * - SPICY_SURREAL: Dark Soul Storytelling - raw, surreal, psychological depth
 */

import { WritingStyle, SpiceLevel } from './types';

// Forbidden phrases that make text sound "AI-generated"
export const FORBIDDEN_PHRASES = [
  'This is not just',
  'This is not about',
  "But here's the thing",
  "Here's what's really happening",
  'Let me show you',
  "Now here's where it gets interesting",
  'The truth is',
  "What most people don't realize",
  'In conclusion',
  'It goes without saying',
  'At the end of the day',
  'Moving forward',
];

// Style definitions
export interface StyleDefinition {
  name: string;
  description: string;
  tone: string[];
  voice: string;
  forbiddenPhrases: string[];
  requiredElements: string[];
  exampleTransformations: { bad: string; good: string }[];
}

export const STYLES: Record<WritingStyle, StyleDefinition> = {
  production: {
    name: 'Production',
    description: 'Literary consciousness documentary - PhD-level analysis with psychological depth',
    tone: [
      'Literary consciousness documentary',
      'Intimate and penetrating',
      'Honest about shadows',
      'Sophisticated but accessible',
      'David Attenborough narrating human souls',
    ],
    voice: `Write like a master analyst creating literary-quality consciousness analysis.
Direct, vivid, concrete language. Active voice and imagery.
Pure storytelling, no meta-commentary.
Psychological vocabulary (attachment, projection, defense mechanisms).
Weave systems together naturally - never list them separately.`,
    forbiddenPhrases: FORBIDDEN_PHRASES,
    requiredElements: [
      'Pure prose (NO markdown/bullets/headers)',
      'Audio-ready (spell everything out - "fifteen degrees" not "15°")',
      'Simple separators: ═══════ between major sections only',
      '25-35% shadow/darkness emphasis',
      'Specific to THIS person, not generic descriptions',
    ],
    exampleTransformations: [
      {
        bad: 'They have challenging Mars-Venus aspects that create tension.',
        good: 'His Mars in Leo demands worship for every touch. Her Venus in Libra choreographs desire into art. Neither fully arrives. He performs perfection while she stages beauty. The actual connection hovers between their fantasies, always almost, never quite.',
      },
      {
        bad: 'Her Scorpio rising gives her an intense presence.',
        good: 'She rises in Scorpio at twenty-five degrees, deep in the sign of death and transformation. When you meet her, you meet what she has constructed to protect what she actually is. And what she actually is will either destroy you or remake you. There is no third option.',
      },
    ],
  },

  spicy_surreal: {
    name: 'Dark Soul Storytelling',
    description: 'Consciousness noir - telling the story of a soul, not analyzing a chart',
    tone: [
      'Storytelling, not analysis',
      'Dark but beautiful prose',
      'Surreal imagery when it serves the story',
      'Gut-level honest, no sugarcoating',
      'Dream logic and uncomfortable beauty',
    ],
    voice: `You are telling the story of a soul - not analyzing a chart.

WRITE LIKE A NOVELIST, NOT AN ANALYST:
- Every chart is a character study
- Find the narrative arc: wounds, patterns, transformations
- Dark but beautiful prose
- Surreal imagery when it serves the story
- The unconscious speaks through symbols
- Shadow work is part of the journey, not a diagnosis

This is consciousness noir - intimate, penetrating, unforgettable.`,
    forbiddenPhrases: [
      ...FORBIDDEN_PHRASES,
      'challenges',          // Say WOUNDS, TRAPS, ABYSSES
      'growth opportunity',  // Say the danger directly
    ],
    requiredElements: [
      'Raw verbs: devour, penetrate, consume, shatter, burn',
      'Body language: sweat, blood, bone, flesh, nerve',
      'Surreal metaphor: "Her Moon lives in the room where clocks melt"',
      'Direct intimate truth when appropriate to spice level',
      'Mythological imagery: serpent, abyss, labyrinth, mirror, shadow',
      '40% shadow/darkness emphasis',
    ],
    exampleTransformations: [
      {
        bad: 'They have challenging Mars-Venus aspects that create tension.',
        good: `When they come together - the raw animal collision of need meeting need - his Mars in the eighth house wants to consume, to possess, to pull her inside himself until there's no boundary between them. But Mars in Leo also wants performance, wants to be told he's magnificent. So he's reaching for her while simultaneously watching himself reach, directing the film of their intimacy while starring in it. She feels this. Her Cancer Moon wants emotional merger, wants it to mean something beyond bodies colliding. But her Scorpio rising won't fully surrender. They're locked in a dance where both are faking the very authenticity they claim to want.`,
      },
      {
        bad: 'His Virgo stellium creates perfectionist tendencies.',
        good: `Five planets crowd into Virgo in his ninth house like monks in a monastery, each one dedicated to the impossible practice of perfecting the imperfectable. His Sun sits at zero degrees, the raw bleeding edge where Leo's fire crosses into Virgo's earth, still warm from creation but already feeling the pull toward analysis, dissection, refinement. He came here to serve by making things better, but the wound underneath drives the service: nothing he does will ever be good enough because HE is not good enough, was never good enough, will spend this entire life trying to prove his worth through usefulness. The tragedy? He's brilliant. The deeper tragedy? His brilliance can't see itself.`,
      },
    ],
  },
};

// Spice level descriptions
export const SPICE_LEVELS: Record<SpiceLevel, { description: string; guidance: string }> = {
  0: { description: 'Very Gentle', guidance: 'Encouraging, growth-focused, minimal shadow' },
  1: { description: 'Gentle', guidance: 'Warm, supportive, light shadow acknowledgment' },
  2: { description: 'Soft', guidance: 'Kind but honest, shadows mentioned gently' },
  3: { description: 'Balanced Light', guidance: 'Honest but compassionate' },
  4: { description: 'Balanced', guidance: 'Equal light and shadow, no sugarcoating' },
  5: { description: 'Direct', guidance: 'Brutally honest, psychological depth' },
  6: { description: 'Intense', guidance: 'Raw honesty, explicit about wounds' },
  7: { description: 'Raw', guidance: 'Dark, occasionally shocking, intimate content allowed' },
  8: { description: 'Very Raw', guidance: 'Unfiltered, explicit when relevant' },
  9: { description: 'Nuclear', guidance: 'Absolutely unfiltered, raw psychological depth' },
  10: { description: 'Maximum', guidance: 'No limits, full psychological excavation' },
};

// Get style prompt based on configuration
export function getStylePrompt(style: WritingStyle, spiceLevel: SpiceLevel): string {
  const styleDef = STYLES[style];
  const spiceDef = SPICE_LEVELS[spiceLevel];
  
  return `
═══════════════════════════════════════════════════════════════════════════════

WRITING STYLE: ${styleDef.name.toUpperCase()}

${styleDef.description}

VOICE:
${styleDef.voice}

TONE:
${styleDef.tone.map(t => `- ${t}`).join('\n')}

FORBIDDEN PHRASES (NEVER USE):
${styleDef.forbiddenPhrases.map(p => `❌ "${p}"`).join('\n')}

REQUIRED ELEMENTS:
${styleDef.requiredElements.map(e => `✓ ${e}`).join('\n')}

SPICE LEVEL: ${spiceLevel}/10 (${spiceDef.description})
${spiceDef.guidance}

═══════════════════════════════════════════════════════════════════════════════
`.trim();
}

// Get example transformations for the style
export function getStyleExamples(style: WritingStyle): string {
  const styleDef = STYLES[style];
  
  return styleDef.exampleTransformations.map((ex, i) => `
EXAMPLE ${i + 1}:

INSTEAD OF:
"${ex.bad}"

WRITE:
"${ex.good}"
`).join('\n');
}

