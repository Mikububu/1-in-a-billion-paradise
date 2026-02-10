/**
 * Gene Keys Calculator
 * 
 * Calculates Gene Keys Hologenetic Profile from planetary positions.
 * Uses the same 64-gate zodiacal wheel as Human Design.
 * 
 * Ported from frontend implementation.
 */

export interface GeneKeyData {
  shadow: string;
  gift: string;
  siddhi: string;
}

export interface GeneKeyPosition {
  geneKey: number;
  line: number;
  shadow: string;
  gift: string;
  siddhi: string;
}

export interface HologeneticProfile {
  lifesWork?: GeneKeyPosition;
  evolution?: GeneKeyPosition;
  radiance?: GeneKeyPosition;
  purpose?: GeneKeyPosition;
  attraction?: GeneKeyPosition;
  iq?: GeneKeyPosition;
  eq?: GeneKeyPosition;
  sq?: GeneKeyPosition;
  vocation?: GeneKeyPosition;
  culture?: GeneKeyPosition;
  pearl?: GeneKeyPosition;
}

// The 64 Gene Keys with Shadow, Gift, Siddhi
export const GENE_KEYS_DATA: Record<number, GeneKeyData> = {
  1: { shadow: "Entropy", gift: "Freshness", siddhi: "Beauty" },
  2: { shadow: "Dislocation", gift: "Orientation", siddhi: "Unity" },
  3: { shadow: "Chaos", gift: "Innovation", siddhi: "Innocence" },
  4: { shadow: "Intolerance", gift: "Understanding", siddhi: "Forgiveness" },
  5: { shadow: "Impatience", gift: "Patience", siddhi: "Timelessness" },
  6: { shadow: "Conflict", gift: "Diplomacy", siddhi: "Peace" },
  7: { shadow: "Division", gift: "Guidance", siddhi: "Virtue" },
  8: { shadow: "Mediocrity", gift: "Style", siddhi: "Exquisiteness" },
  9: { shadow: "Inertia", gift: "Determination", siddhi: "Invincibility" },
  10: { shadow: "Self-Obsession", gift: "Naturalness", siddhi: "Being" },
  11: { shadow: "Obscurity", gift: "Idealism", siddhi: "Light" },
  12: { shadow: "Vanity", gift: "Discrimination", siddhi: "Purity" },
  13: { shadow: "Discord", gift: "Discernment", siddhi: "Empathy" },
  14: { shadow: "Compromise", gift: "Competence", siddhi: "Bounteousness" },
  15: { shadow: "Dullness", gift: "Magnetism", siddhi: "Florescence" },
  16: { shadow: "Indifference", gift: "Versatility", siddhi: "Mastery" },
  17: { shadow: "Opinion", gift: "Far-Sightedness", siddhi: "Omniscience" },
  18: { shadow: "Judgment", gift: "Integrity", siddhi: "Perfection" },
  19: { shadow: "Co-Dependence", gift: "Sensitivity", siddhi: "Sacrifice" },
  20: { shadow: "Superficiality", gift: "Self-Assurance", siddhi: "Presence" },
  21: { shadow: "Control", gift: "Authority", siddhi: "Valour" },
  22: { shadow: "Dishonour", gift: "Graciousness", siddhi: "Grace" },
  23: { shadow: "Complexity", gift: "Simplicity", siddhi: "Quintessence" },
  24: { shadow: "Addiction", gift: "Invention", siddhi: "Silence" },
  25: { shadow: "Constriction", gift: "Acceptance", siddhi: "Universal Love" },
  26: { shadow: "Pride", gift: "Artfulness", siddhi: "Invisibility" },
  27: { shadow: "Selfishness", gift: "Altruism", siddhi: "Selflessness" },
  28: { shadow: "Purposelessness", gift: "Totality", siddhi: "Immortality" },
  29: { shadow: "Half-Heartedness", gift: "Commitment", siddhi: "Devotion" },
  30: { shadow: "Desire", gift: "Lightness", siddhi: "Rapture" },
  31: { shadow: "Arrogance", gift: "Leadership", siddhi: "Humility" },
  32: { shadow: "Failure", gift: "Preservation", siddhi: "Veneration" },
  33: { shadow: "Forgetting", gift: "Mindfulness", siddhi: "Revelation" },
  34: { shadow: "Force", gift: "Strength", siddhi: "Majesty" },
  35: { shadow: "Hunger", gift: "Adventure", siddhi: "Boundlessness" },
  36: { shadow: "Turbulence", gift: "Humanity", siddhi: "Compassion" },
  37: { shadow: "Weakness", gift: "Equality", siddhi: "Tenderness" },
  38: { shadow: "Struggle", gift: "Perseverance", siddhi: "Honour" },
  39: { shadow: "Provocation", gift: "Dynamism", siddhi: "Liberation" },
  40: { shadow: "Exhaustion", gift: "Resolve", siddhi: "Divine Will" },
  41: { shadow: "Fantasy", gift: "Anticipation", siddhi: "Emanation" },
  42: { shadow: "Expectation", gift: "Detachment", siddhi: "Celebration" },
  43: { shadow: "Deafness", gift: "Insight", siddhi: "Epiphany" },
  44: { shadow: "Interference", gift: "Teamwork", siddhi: "Synarchy" },
  45: { shadow: "Dominance", gift: "Synergy", siddhi: "Communion" },
  46: { shadow: "Seriousness", gift: "Delight", siddhi: "Ecstasy" },
  47: { shadow: "Oppression", gift: "Transmutation", siddhi: "Transfiguration" },
  48: { shadow: "Inadequacy", gift: "Resourcefulness", siddhi: "Wisdom" },
  49: { shadow: "Reaction", gift: "Revolution", siddhi: "Rebirth" },
  50: { shadow: "Corruption", gift: "Equilibrium", siddhi: "Harmony" },
  51: { shadow: "Agitation", gift: "Initiative", siddhi: "Awakening" },
  52: { shadow: "Stress", gift: "Restraint", siddhi: "Stillness" },
  53: { shadow: "Immaturity", gift: "Expansion", siddhi: "Superabundance" },
  54: { shadow: "Greed", gift: "Aspiration", siddhi: "Ascension" },
  55: { shadow: "Victimisation", gift: "Freedom", siddhi: "Freedom" },
  56: { shadow: "Distraction", gift: "Enrichment", siddhi: "Intoxication" },
  57: { shadow: "Unease", gift: "Intuition", siddhi: "Clarity" },
  58: { shadow: "Dissatisfaction", gift: "Vitality", siddhi: "Bliss" },
  59: { shadow: "Dishonesty", gift: "Intimacy", siddhi: "Transparency" },
  60: { shadow: "Limitation", gift: "Realism", siddhi: "Justice" },
  61: { shadow: "Psychosis", gift: "Inspiration", siddhi: "Sanctity" },
  62: { shadow: "Intellect", gift: "Precision", siddhi: "Impeccability" },
  63: { shadow: "Doubt", gift: "Inquiry", siddhi: "Truth" },
  64: { shadow: "Confusion", gift: "Imagination", siddhi: "Illumination" },
};

// Gate sequence on the HD/GK wheel (starting from Gate 41 at 2° Aquarius)
export const GATE_SEQUENCE = [
  41, 19, 13, 49, 30, 55, 37, 63, 22, 36, 25, 17, 21, 51, 42, 3,
  27, 24, 2, 23, 8, 20, 16, 35, 45, 12, 15, 52, 39, 53, 62, 56,
  31, 33, 7, 4, 29, 59, 40, 64, 47, 6, 46, 18, 48, 57, 32, 50,
  28, 44, 1, 43, 14, 34, 9, 5, 26, 11, 10, 58, 38, 54, 61, 60
];

/**
 * Convert tropical zodiac longitude to Gene Key number and line.
 * 
 * The Gene Keys wheel (identical to Human Design):
 * - Starts at Gate 41 at 2° Aquarius (302° tropical)
 * - Each Gene Key spans 5.625° (360/64)
 * - Each Line spans 0.9375° (5.625/6)
 * 
 * @param longitude Tropical zodiac longitude in degrees (0-360)
 * @returns {GeneKeyPosition} gene_key, line, shadow, gift, siddhi
 */
export function tropicalLongitudeToGeneKey(longitude: number): GeneKeyPosition {
  // HD/GK wheel offset - Gate 41 starts at 302° tropical (2° Aquarius)
  const HD_OFFSET = 302.0;
  const DEGREES_PER_KEY = 5.625; // 360/64
  const DEGREES_PER_LINE = 0.9375; // 5.625/6

  // Adjust longitude to the HD/GK wheel
  let adjusted = (longitude - HD_OFFSET) % 360;
  if (adjusted < 0) adjusted += 360;

  // Find the gate index (0-63)
  const gateIndex = Math.floor(adjusted / DEGREES_PER_KEY);

  // Find the line (1-6)
  const positionInKey = adjusted % DEGREES_PER_KEY;
  let line = Math.floor(positionInKey / DEGREES_PER_LINE) + 1;
  if (line > 6) line = 6; // Safety cap

  // Get the Gene Key number from the sequence
  const geneKey = GATE_SEQUENCE[gateIndex];

  // Get the Shadow/Gift/Siddhi data
  const keyData = GENE_KEYS_DATA[geneKey];

  return {
    geneKey,
    line,
    shadow: keyData.shadow,
    gift: keyData.gift,
    siddhi: keyData.siddhi
  };
}

export interface PlanetaryPositions {
  personality: {
    sun?: number;
    earth?: number;
    moon?: number;
    venus?: number;
    mars?: number;
    jupiter?: number;
    [key: string]: number | undefined;
  };
  design: {
    sun?: number;
    earth?: number;
    moon?: number;
    venus?: number;
    mars?: number;
    jupiter?: number;
    [key: string]: number | undefined;
  };
}

/**
 * Calculate the Hologenetic Profile spheres from planetary positions.
 * 
 * The Activation Sequence uses:
 * - Life's Work: Conscious Sun (personality)
 * - Evolution: Conscious Earth (opposite Sun)
 * - Radiance: Conscious Sun from Design (88 days prior)
 * - Purpose: Conscious Earth from Design
 * 
 * The Venus Sequence uses:
 * - Attraction: Venus
 * - IQ (Intelligence): Design Mars
 * - EQ (Emotional): Design Venus
 * - SQ (Spiritual): Conscious Moon
 * 
 * The Pearl Sequence uses:
 * - Vocation: Conscious Mars
 * - Culture: Design Jupiter
 * - Pearl: Conscious Sun (same as Life's Work)
 */
export function calculateGeneKeys(planetaryPositions: PlanetaryPositions): HologeneticProfile {
  const profile: HologeneticProfile = {};

  const p = planetaryPositions.personality;
  const d = planetaryPositions.design;

  // Activation Sequence (the core 4 Prime Gifts)
  if (typeof p.sun === 'number') {
    profile.lifesWork = tropicalLongitudeToGeneKey(p.sun);
    // Pearl is same as Life's Work (Sun)
    profile.pearl = profile.lifesWork;
  }
  if (typeof p.earth === 'number') {
    profile.evolution = tropicalLongitudeToGeneKey(p.earth);
  }
  if (typeof d.sun === 'number') {
    profile.radiance = tropicalLongitudeToGeneKey(d.sun);
  }
  if (typeof d.earth === 'number') {
    profile.purpose = tropicalLongitudeToGeneKey(d.earth);
  }

  // Venus Sequence
  if (typeof p.venus === 'number') {
    profile.attraction = tropicalLongitudeToGeneKey(p.venus);
  }
  if (typeof d.mars === 'number') {
    profile.iq = tropicalLongitudeToGeneKey(d.mars);
  }
  if (typeof d.venus === 'number') {
    profile.eq = tropicalLongitudeToGeneKey(d.venus);
  }
  if (typeof p.moon === 'number') {
    profile.sq = tropicalLongitudeToGeneKey(p.moon);
  }

  // Pearl Sequence
  if (typeof p.mars === 'number') {
    profile.vocation = tropicalLongitudeToGeneKey(p.mars);
  }
  if (typeof d.jupiter === 'number') {
    profile.culture = tropicalLongitudeToGeneKey(d.jupiter);
  }

  return profile;
}
