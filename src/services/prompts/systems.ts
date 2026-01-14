/**
 * SYSTEM-SPECIFIC GUIDANCE
 * 
 * Defines what to cover for each of the 5 astrological systems.
 * Each system has its own vocabulary, concepts, and emphasis.
 */

import { AstroSystem } from './types';

export interface SystemGuidance {
  name: string;
  coveragePoints: string[];
  emphasis: string;
  avoid: string[];
  vocabulary: string[];
}

export const SYSTEM_GUIDANCE: Record<AstroSystem, SystemGuidance> = {
  western: {
    name: 'Western Astrology',
    coveragePoints: [
      'Sun (identity, life force, purpose)',
      'Moon (emotions, subconscious, needs)',
      'Rising/Ascendant (mask, approach to life)',
      'Mercury (mind, communication)',
      'Venus (values, love, beauty)',
      'Mars (drive, sexuality, anger)',
      'Jupiter (expansion, wisdom)',
      'Saturn (structure, discipline, lessons)',
      'Outer planets (Uranus, Neptune, Pluto - generational but note personal house placements)',
      'Major aspects (especially to personal planets)',
      'Stelliums or emphasized houses',
      'Chart patterns (T-square, Grand Trine, etc. if present)',
    ],
    emphasis: 'Psychological depth, growth edges, life themes',
    avoid: [
      'Generic sun sign descriptions',
      'Fortune-telling',
      'Newspaper horoscope language',
    ],
    vocabulary: [
      'aspect', 'house', 'stellium', 'conjunction', 'opposition',
      'trine', 'square', 'sextile', 'orb', 'cusps', 'angles',
      'personal planets', 'outer planets', 'retrograde',
    ],
  },

  vedic: {
    name: 'Vedic Astrology (Jyotish)',
    coveragePoints: [
      'Lagna (Rising) and Lagna lord',
      'Sun and Moon in sidereal zodiac',
      'Moon Nakshatra (most important!) - deity, qualities, pada',
      'Planetary strengths (exaltation, debilitation, own sign)',
      'Key house lords (especially 1st, 4th, 7th, 9th, 10th)',
      'Vimshottari Dasha system (current period and upcoming)',
      'Yogas (Raja Yoga, Dhana Yoga, difficult yogas if present)',
      'Karmic indicators (Rahu/Ketu, 8th/12th houses)',
      'Tikkun and dharma',
      'Remedial measures (mantras, gemstones, charitable acts)',
    ],
    emphasis: 'Karma, timing, spiritual purpose, practical remedies',
    avoid: [
      'Overly fatalistic language',
      'Ignoring free will',
      'Western astrology terminology when Vedic terms exist',
    ],
    vocabulary: [
      'Nakshatra', 'Dasha', 'Bhukti', 'Rahu', 'Ketu', 'Lagna',
      'Yoga', 'Ayanamsa', 'Mahadasha', 'Antardasha', 'Pada',
      'Graha', 'Bhava', 'Karaka', 'Dharma', 'Karma', 'Moksha',
    ],
  },

  gene_keys: {
    name: 'Gene Keys',
    coveragePoints: [
      "Life's Work (Personality Sun) - Shadow/Gift/Siddhi",
      'Evolution (Personality Earth) - what they magnetize',
      'Radiance (Design Sun) - unconscious emanation',
      'Purpose (Design Earth) - deepest calling',
      'Personality Venus - conscious relationship patterns',
      'Design Venus - unconscious attraction',
      'Personality Moon - emotional/prosperity driver',
      'Design Moon - unconscious foundation',
      'How the four prime gifts work together',
      'Shadow-to-Gift journey guidance',
      'Contemplation practices',
    ],
    emphasis: 'Consciousness evolution, shadow work, awakening path',
    avoid: [
      'Treating it like personality typing',
      'Spiritual bypassing',
      'Western astrology terminology (no "Sun sign", "Moon sign")',
      'Generic descriptions that could apply to anyone',
    ],
    vocabulary: [
      'Gene Key', 'Shadow', 'Gift', 'Siddhi', 'Activation Sequence',
      'Venus Sequence', 'Pearl Sequence', 'Contemplation', 'Frequency',
      'Codon Ring', 'Programming Partner', 'Hologenetic Profile',
    ],
  },

  human_design: {
    name: 'Human Design',
    coveragePoints: [
      'Type (Generator, Projector, Manifestor, Reflector)',
      'Strategy (how to engage with life correctly)',
      'Authority (decision-making mechanism)',
      'Profile (life purpose framework)',
      'Definition (energy flow pattern)',
      'All 9 Centers (defined vs open)',
      'Not-self conditioning in open centers',
      'Wisdom potential in open centers',
      'Key Channels (if any) - life force themes',
      'Incarnation Cross (specific purpose)',
      'Circuitry (Individual, Tribal, Collective)',
      '7-year deconditioning journey',
    ],
    emphasis: 'Mechanics, practical living, deconditioning, correct operation',
    avoid: [
      'Making it too mechanical without human depth',
      'Western astrology language',
      'Generic type descriptions',
    ],
    vocabulary: [
      'Type', 'Strategy', 'Authority', 'Profile', 'Definition',
      'Center', 'Channel', 'Gate', 'Not-self', 'Signature',
      'Sacral response', 'Emotional wave', 'Splenic intuition',
      'Incarnation Cross', 'Deconditioning', 'Conditioning',
    ],
  },

  kabbalah: {
    name: 'Kabbalistic Astrology',
    coveragePoints: [
      'Primary Sephiroth connections (via Sun, Moon, planets)',
      "Soul's Tikkun (correction/purpose)",
      'Four Worlds balance (Fire/Earth/Air/Water emphasis)',
      'Gilgul (reincarnation) indicators',
      'Past life themes',
      'Tree of Life pathworking relevant to chart',
      'Divine names and angels',
      'Hebrew zodiac connections',
      'The 72 Names of God and their spiritual qualities',
      'Specific spiritual practices for their soul work',
    ],
    emphasis: 'Soul purpose, mystical depth, sacred practice, Tikkun',
    avoid: [
      'Cultural appropriation',
      'Overly esoteric without grounding',
      'Western astrology terms (NO "Ascendant", "Sun sign", "Moon sign")',
      'Zodiac signs and planetary positions from Western astrology',
    ],
    vocabulary: [
      'Sephirah', 'Sephiroth', 'Tikkun', 'Klipot', 'Gilgul',
      'Keter', 'Chokmah', 'Binah', 'Chesed', 'Gevurah', 'Tiferet',
      'Netzach', 'Hod', 'Yesod', 'Malkuth', 'Ein Sof', 'Zohar',
      'Tree of Life', 'Path', 'Hebrew letter', 'Divine name',
    ],
  },
};

// Get system prompt for a specific system
export function getSystemPrompt(system: AstroSystem): string {
  const guide = SYSTEM_GUIDANCE[system];
  
  return `
═══════════════════════════════════════════════════════════════════════════════

SYSTEM: ${guide.name.toUpperCase()}

COVER THESE ELEMENTS:
${guide.coveragePoints.map(p => `- ${p}`).join('\n')}

EMPHASIS: ${guide.emphasis}

AVOID:
${guide.avoid.map(a => `❌ ${a}`).join('\n')}

USE THIS VOCABULARY:
${guide.vocabulary.join(', ')}

═══════════════════════════════════════════════════════════════════════════════
`.trim();
}

// Get combined prompt for all 5 systems (nuclear version)
export function getAllSystemsPrompt(): string {
  return `
═══════════════════════════════════════════════════════════════════════════════

SYNTHESIZE ALL 5 SYSTEMS INTO ONE FLOWING NARRATIVE

DO NOT write sections like:
"In Western astrology, his Sun is... In Vedic astrology, his Sun is..."

INSTEAD, weave systems together naturally:

EXAMPLE:
"His Sun crosses into Virgo at zero degrees - that cusp moment between Leo's fire and Virgo's earth. Western astrology calls this the perfectionist's placement. But shift to the Vedic lens, where the sidereal zodiac accounts for precession, and his Sun sits at seven degrees Leo - still royal, still creative. Both are true simultaneously. In the Gene Keys system, this solar position encodes what Richard Rudd calls the sixteenth frequency - Versatility in Gift, Indifference in Shadow. Human Design sees this as his Life's Work channel. And Kabbalah connects his solar energy to Tiphareth, the heart center on the Tree of Life.

All five systems point to the same truth from different angles."

═══════════════════════════════════════════════════════════════════════════════

${Object.entries(SYSTEM_GUIDANCE).map(([key, guide]) => `
${guide.name.toUpperCase()}:
Cover: ${guide.coveragePoints.slice(0, 5).join(', ')}
Vocabulary: ${guide.vocabulary.slice(0, 8).join(', ')}
`).join('\n')}
`.trim();
}

