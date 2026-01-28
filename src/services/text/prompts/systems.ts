/**
 * SYSTEM-SPECIFIC GUIDANCE
 *
 * Deep expertise instructions for each astrological system.
 * These ensure Claude writes authentically for each tradition.
 */

import { AstroSystem } from './types';

interface SystemGuidance {
  name: string;
  coverPoints: string;
  emphasis: string;
  avoid: string;
  synastry?: string;
  nakshatraNote?: string;
  keyNote?: string;
  typeNote?: string;
  critical?: string;
  sephirothMap?: string;
}

// ═══════════════════════════════════════════════════════════════════════════════
// WESTERN ASTROLOGY
// ═══════════════════════════════════════════════════════════════════════════════

export const WESTERN_GUIDANCE: SystemGuidance = {
  name: 'Western Astrology',
  coverPoints: `
COVER THESE ELEMENTS:
- Sun (identity, life force, purpose)
- Moon (emotions, subconscious, needs)
- Rising/Ascendant (mask, approach to life)
- Mercury (mind, communication)
- Venus (values, love, beauty)
- Mars (drive, desire, anger)
- Jupiter (expansion, wisdom)
- Saturn (structure, discipline, lessons)
- Outer planets (Uranus, Neptune, Pluto - note personal house placements)
- Major aspects (especially to personal planets)
- Stelliums or emphasized houses
- Chart patterns (T-square, Grand Trine, etc. if present)
`,
  emphasis: 'Psychological depth, growth edges, life themes',
  avoid: 'Generic sun sign descriptions, fortune-telling',
  synastry: `
FOR RELATIONSHIP ANALYSIS:
- Venus-Mars dynamics (attraction/desire)
- Mercury aspects (communication)
- Moon connections (emotional compatibility)
- Outer planets (transformation potential)
- Major aspects between charts (conjunctions, squares, trines, oppositions with orbs)
- House overlays (where each person's planets land in other's houses)
- Composite chart themes
`,
};

// ═══════════════════════════════════════════════════════════════════════════════
// VEDIC ASTROLOGY (Jyotish)
// ═══════════════════════════════════════════════════════════════════════════════

export const VEDIC_GUIDANCE: SystemGuidance = {
  name: 'Vedic Astrology (Jyotish)',
  coverPoints: `
COVER THESE ELEMENTS:
- Lagna (Rising) and Lagna lord
- Sun and Moon in SIDEREAL zodiac (not tropical!)
- Moon Nakshatra (MOST IMPORTANT!) - deity, qualities, pada
- Planetary strengths (exaltation, debilitation, own sign)
- Key house lords (especially 1st, 4th, 7th, 9th, 10th)
- Vimshottari Dasha system (current period and upcoming)
- Yogas (Raja Yoga, Dhana Yoga, difficult yogas if present)
- Karmic indicators (Rahu/Ketu axis, 8th/12th houses)
- Tikkun and dharma
- Remedial measures (mantras, gemstones, charitable acts)
`,
  emphasis: 'Karma, timing, spiritual purpose, practical remedies',
  avoid: 'Overly fatalistic language, ignoring free will',
  synastry: `
FOR RELATIONSHIP ANALYSIS:
- Ashtakuta scoring (all 8 kutas if data provided)
- Kuja Dosha analysis (Mars placement implications)
- 7th house and lord (marriage indicators)
- Dasha compatibility (timing and life phases)
- Rahu-Ketu axis (karmic connections)
- Past life indicators
- Dharmic purpose of union
- Yoni Kuta (sexual/physical compatibility)
- Graha Maitri (mental/intellectual compatibility)
`,
  nakshatraNote: `
NAKSHATRAS ARE CENTRAL TO VEDIC:
The 27 lunar mansions are the soul of Jyotish. Each has:
- A ruling deity (reveals psychological archetype)
- A planetary ruler (links to dasha system)
- 4 padas (quarters, each with different flavor)
- Animal symbol (instinctual nature)
- Guna quality (sattva/rajas/tamas)

The Moon's nakshatra is MORE IMPORTANT than Moon sign in Vedic.
`,
};

// ═══════════════════════════════════════════════════════════════════════════════
// GENE KEYS
// ═══════════════════════════════════════════════════════════════════════════════

export const GENE_KEYS_GUIDANCE: SystemGuidance = {
  name: 'Gene Keys',
  coverPoints: `
COVER THESE ELEMENTS:

ACTIVATION SEQUENCE (Primary):
- Life's Work (Personality Sun) - Shadow/Gift/Siddhi
- Evolution (Personality Earth) - what they magnetize
- Radiance (Design Sun) - unconscious emanation
- Purpose (Design Earth) - deepest calling

VENUS SEQUENCE (Relationships):
- Personality Venus - conscious relationship patterns
- Design Venus - unconscious attraction

PEARL SEQUENCE (Prosperity):
- Personality Moon - emotional/prosperity driver
- Design Moon - unconscious foundation

For each Key, cover ALL THREE FREQUENCIES:
- Shadow: The fear-based expression
- Gift: The breakthrough state
- Siddhi: The fully realized potential
`,
  emphasis: 'Consciousness evolution, shadow work, awakening path',
  avoid: 'Treating it like personality typing, spiritual bypassing',
  synastry: `
FOR RELATIONSHIP ANALYSIS:
- How their Keys interact (shadow triggering vs gift activation)
- Which shadows in Person A trigger Person B's shadows
- Which gifts in Person A activate Person B's gifts
- Contemplation practices for their specific dynamic
- Consciousness evolution potential together
- Siddhi field they could create
`,
  keyNote: `
GENE KEYS PHILOSOPHY:
Gene Keys is NOT personality typing. It's a map of consciousness evolution.
Every shadow contains a gift. Every gift opens to a siddhi.
The journey is from fear (shadow) through love (gift) to unity (siddhi).

CRITICAL: Use Gene Keys terminology:
- Shadow, Gift, Siddhi (NOT "negative trait" or "positive trait")
- Activation Sequence, Venus Sequence, Pearl Sequence
- Contemplation (the core practice)
- Frequency (the level of consciousness)
`,
};

// ═══════════════════════════════════════════════════════════════════════════════
// HUMAN DESIGN
// ═══════════════════════════════════════════════════════════════════════════════

export const HUMAN_DESIGN_GUIDANCE: SystemGuidance = {
  name: 'Human Design',
  coverPoints: `
COVER THESE ELEMENTS:
- Type (Generator, Manifesting Generator, Projector, Manifestor, Reflector)
- Strategy (how to engage with life correctly)
- Authority (decision-making mechanism)
- Profile (life purpose framework - conscious/unconscious lines)
- Definition (energy flow pattern: Single, Split, Triple Split, Quadruple Split, No Definition)
- All 9 Centers (defined vs open)
- Not-self conditioning in open centers
- Wisdom potential in open centers
- Key Channels (if any) - life force themes
- Incarnation Cross (specific purpose)
- Circuitry (Individual, Tribal, Collective)
- 7-year deconditioning journey
`,
  emphasis: 'Mechanics, practical living, deconditioning, correct operation',
  avoid: 'Making it too mechanical without human depth',
  synastry: `
FOR RELATIONSHIP ANALYSIS:
- Type interaction dynamics (Generator/Projector, etc.)
- Electromagnetic connections (defined to undefined centers)
- Channels and Gates they create together (compromise channels)
- Aura mechanics and energetic compatibility
- How their Strategies interact
- How their Authorities might clash or complement
- Deconditioning challenges together
- Not-self themes when together
- Signature vs Not-self states in relationship
`,
  typeNote: `
HUMAN DESIGN TYPES:
- Generator (70%): Wait to respond, satisfaction/frustration
- Manifesting Generator: Wait to respond + inform, satisfaction/frustration
- Projector (20%): Wait for invitation, success/bitterness
- Manifestor (9%): Inform then act, peace/anger
- Reflector (1%): Wait lunar cycle, surprise/disappointment

AUTHORITIES (Decision Making):
- Emotional: Wait for clarity through emotional wave
- Sacral: Gut response (uh-huh or uhn-uhn)
- Splenic: Instant intuitive knowing
- Ego: Willpower and heart truth
- Self-Projected: Speak to hear truth
- Mental/Environmental: External sounding board
- Lunar: Full moon cycle for major decisions
`,
};

// ═══════════════════════════════════════════════════════════════════════════════
// KABBALISTIC ASTROLOGY
// ═══════════════════════════════════════════════════════════════════════════════

export const KABBALAH_GUIDANCE: SystemGuidance = {
  name: 'Kabbalistic Astrology',
  coverPoints: `
COVER THESE ELEMENTS:
- Primary Sephiroth connections (via Sun, Moon, planets)
- Soul's Tikkun (correction/purpose) - what they came to fix
- Four Worlds balance (Atziluth/Beriah/Yetzirah/Assiyah - Fire/Water/Air/Earth)
- Gilgul (reincarnation) indicators
- Past life themes
- Tree of Life pathworking relevant to chart
- Divine names and angels connected to their birth
- Hebrew zodiac connections (Mazalot)
- Klipot (shells/shadows) - the dark side of each placement
- Spiritual practices for their specific soul work
`,
  emphasis: 'Soul purpose, mystical depth, sacred practice',
  avoid: 'Cultural appropriation, overly esoteric without grounding, WESTERN ASTROLOGY TERMS',
  critical: `
CRITICAL: DO NOT USE WESTERN ASTROLOGY TERMS!

Kabbalah has its OWN system. NEVER say:
❌ "Ascendant", "Moon sign", "Sun sign"
❌ Zodiac signs in Western way
❌ Planetary positions like Western astrology

USE ONLY KABBALISTIC CONCEPTS:
✓ The 10 Sephiroth: Keter, Chokmah, Binah, Chesed, Gevurah, Tiferet, Netzach, Hod, Yesod, Malkuth
✓ Tikkun (soul correction)
✓ Klipot (shells/shadows)
✓ The 22 Paths (Hebrew letters)
✓ The 72 Names of God
✓ Gilgul (reincarnation)
✓ Mazal (spiritual influence from Hebrew month)
✓ The Zohar teachings
`,
  synastry: `
FOR RELATIONSHIP ANALYSIS:
- Sephiroth combinations (how their Trees interact)
- Complementary Tikkunim (do their corrections align?)
- Klipot that trigger each other
- Four Worlds balance together
- Past life/Gilgul connections
- Divine names and angels relevant to union
- Soul contract from Kabbalistic view
- Sacred purpose of meeting
- Mystical practices for the couple
`,
  sephirothMap: `
THE 10 SEPHIROTH:
1. Keter (Crown) - Divine will, transcendence
2. Chokmah (Wisdom) - Masculine principle, flash of insight
3. Binah (Understanding) - Feminine principle, form and structure
4. Chesed (Mercy/Loving-kindness) - Expansion, generosity
5. Gevurah (Severity/Strength) - Contraction, boundaries, judgment
6. Tiferet (Beauty) - Heart center, balance, harmony
7. Netzach (Victory/Eternity) - Passion, creativity, desire
8. Hod (Splendor/Glory) - Intellect, communication, form
9. Yesod (Foundation) - Connection, sexuality, dreams
10. Malkuth (Kingdom) - Physical reality, manifestation
`,
};

// ═══════════════════════════════════════════════════════════════════════════════
// GET SYSTEM GUIDANCE
// ═══════════════════════════════════════════════════════════════════════════════

export function getSystemGuidance(system: AstroSystem): SystemGuidance {
  const guidance: Record<AstroSystem, SystemGuidance> = {
    western: WESTERN_GUIDANCE,
    vedic: VEDIC_GUIDANCE,
    gene_keys: GENE_KEYS_GUIDANCE,
    human_design: HUMAN_DESIGN_GUIDANCE,
    kabbalah: KABBALAH_GUIDANCE,
  };
  return guidance[system];
}

export function getSystemPromptSection(system: AstroSystem, isRelationship: boolean): string {
  const g = getSystemGuidance(system);

  let prompt = `
═══════════════════════════════════════════════════════════════════════════════
SYSTEM: ${g.name}
═══════════════════════════════════════════════════════════════════════════════

${g.coverPoints}

EMPHASIS: ${g.emphasis}

AVOID: ${g.avoid}
`;

  if (isRelationship && g.synastry) {
    prompt += `\n${g.synastry}\n`;
  }

  // Add special notes for certain systems
  if (system === 'vedic' && g.nakshatraNote) {
    prompt += `\n${g.nakshatraNote}\n`;
  }
  if (system === 'gene_keys' && g.keyNote) {
    prompt += `\n${g.keyNote}\n`;
  }
  if (system === 'human_design' && g.typeNote) {
    prompt += `\n${g.typeNote}\n`;
  }
  if (system === 'kabbalah' && g.critical) {
    prompt += `\n${g.critical}\n`;
  }
  if (system === 'kabbalah' && g.sephirothMap) {
    prompt += `\n${g.sephirothMap}\n`;
  }

  return prompt;
}
