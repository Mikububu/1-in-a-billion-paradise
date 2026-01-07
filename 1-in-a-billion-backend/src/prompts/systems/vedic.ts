/**
 * VEDIC ASTROLOGY (JYOTISH) SYSTEM GUIDANCE
 * 
 * Expert instructions for Vedic/Sidereal astrology analysis.
 * 
 * Source: Michael's gold prompt documents
 */

export const VEDIC_SYSTEM = {
  name: 'Vedic Astrology (Jyotish)',

  individualCoverage: `
VEDIC JYOTISH - INDIVIDUAL ANALYSIS:

Cover these elements in depth:

CRITICAL - SIDEREAL ZODIAC:
- All positions use SIDEREAL (not Tropical!)
- Ayanamsa shifts everything ~24 degrees from Western

PRIMARY INDICATORS:
- Lagna (Rising/Ascendant) and Lagna lord
- Sun position (sidereal) and its condition
- Moon position (sidereal) - the MIND itself

NAKSHATRA (MOST IMPORTANT):
- Moon Nakshatra is MORE important than Moon sign
- Cover: ruling deity, planetary ruler, pada (quarter), qualities
- Animal symbol (instinctual nature)
- Guna quality (sattva/rajas/tamas)

PLANETARY ANALYSIS:
- Planetary strengths: exaltation, debilitation, own sign, friend/enemy
- Key house lords: 1st, 4th, 7th, 9th, 10th
- Benefic vs malefic nature for this specific Lagna

TIMING:
- Vimshottari Dasha system
- Current Mahadasha and Antardasha
- Upcoming periods and their implications

YOGAS (Planetary Combinations):
- Raja Yoga (power, success)
- Dhana Yoga (wealth)
- Difficult yogas if present (Kemadruma, etc.)

KARMIC INDICATORS:
- Rahu-Ketu axis (past life patterns, current lessons)
- 8th and 12th house themes
- Atmakaraka (soul significator)
`,

  synastryAdditions: `
VEDIC SYNASTRY ADDITIONS:

For relationship analysis, also cover:
- Ashtakuta scoring (all 8 kutas if data provided)
  - Varna (spiritual compatibility)
  - Vashya (mutual attraction)
  - Tara (health/longevity)
  - Yoni (sexual/physical compatibility) - be specific
  - Graha Maitri (mental compatibility)
  - Gana (temperament match)
  - Bhakoot (family welfare)
  - Nadi (genetic compatibility, health of progeny, vitality)
    * CRITICAL: If Nadi Dosha present (same Nadi = 0 points), MUST explain at least 2 of 4 traditional consequences:
      1. Emotional clashes/marital discord (stubbornness, arguments, potential separation)
      2. Financial instability (wealth-building challenges, conflicting money management)
      3. Progeny problems (conception difficulties, genetic issues, offspring health)
      4. Weakened vitality (mutual energy drain, chronic health issues, difficulty sustaining partnership)
    * Check for cancellation (high Guna score 28+, strong Graha Maitri, remedial measures)
    * If cancelled, state clearly with justification
    * If not cancelled, must affect final recommendation
    * Frame neutrally, not sensationally

- Kuja Dosha (Manglik/Mars) analysis
  - Is Mars in 1st, 4th, 7th, 8th, or 12th?
  - Mutual cancellation if both have it
  - Severity and implications

- 7th House Cross-Analysis
  - Each person's 7th house and lord
  - How they interact with partner's chart

- Dasha Compatibility
  - Are their timing cycles aligned?
  - Will major periods support or challenge union?

- Rahu-Ketu Axis Interaction
  - Karmic connections between charts
  - Past life indicators
  - Is this karma to complete or karma to create?

- At Spice Level 7+: MARAKA ANALYSIS
  - 2nd and 7th houses as Maraka (death-dealing)
  - Maraka lords and their activation
  - Classical spouse longevity indicators
  - Be direct about what patterns suggest
`,

  emphasis: 'Karma, timing, spiritual purpose, practical remedies, dharma',

  avoid: `
AVOID:
- Overly fatalistic language ("you are doomed")
- Ignoring free will
- Western astrology terminology
- Tropical positions (use SIDEREAL only)
`,

  specialNote: `
SPECIAL NOTE ON NAKSHATRAS:
The 27 lunar mansions are the SOUL of Jyotish. Each has:
- A ruling deity (reveals psychological archetype)
- A planetary ruler (links to dasha system)
- 4 padas (quarters, each with different flavor)
- Animal symbol (instinctual nature)
- Guna quality (sattva/rajas/tamas)

The Moon's nakshatra is MORE IMPORTANT than Moon sign in Vedic.
Always give it significant attention.
`,
};

/**
 * Get Vedic interpretation guidance based on user's spice level preference
 */
function getVedicInterpretationGuidance(spiceLevel: number): string {
  if (spiceLevel <= 3) {
    return `
INTERPRETATION TONE (User Preference: Safe/Gentle - Level ${spiceLevel}/10):
- Frame Nadi Dosha consequences as "areas requiring conscious effort" not "serious problems"
- Emphasize growth potential and remedial measures prominently
- Use encouraging, supportive language for challenges
- Focus on compatibility strengths first, then gently introduce challenges
- Present difficult patterns as opportunities for mutual evolution
- Minimize harsh language; prefer "tendencies" over "problems"
`;
  } else if (spiceLevel <= 6) {
    return `
INTERPRETATION TONE (User Preference: Balanced - Level ${spiceLevel}/10):
- Present Nadi Dosha consequences honestly but compassionately
- Balance challenges with strengths equally
- Mention remedies alongside concerns
- Use neutral, analytical language
- Acknowledge difficulties without dramatizing
- Provide context for why patterns matter
`;
  } else {
    return `
INTERPRETATION TONE (User Preference: Spicy/Direct - Level ${spiceLevel}/10):
- State Nadi Dosha consequences directly without softening language
- Lead with challenges and incompatibilities, then strengths
- Be explicit about emotional discord, financial instability, progeny risks, reduced vitality
- Use direct, unfiltered language - call problems what they are
- Minimize remedial framing unless specifically requested
- Prioritize brutal honesty over comfort
- At level 7+: Include Maraka analysis for spouse longevity indicators
`;
  }
}

/**
 * Build Vedic system guidance section
 */
export function buildVedicSection(isRelationship: boolean, spiceLevel: number): string {
  // Get spice-based interpretation guidance
  const interpretationGuidance = getVedicInterpretationGuidance(spiceLevel);

  let section = `
═══════════════════════════════════════════════════════════════════════════════
SYSTEM: ${VEDIC_SYSTEM.name}
═══════════════════════════════════════════════════════════════════════════════

${VEDIC_SYSTEM.individualCoverage}

${VEDIC_SYSTEM.specialNote}

EMPHASIS: ${VEDIC_SYSTEM.emphasis}

${VEDIC_SYSTEM.avoid}

${interpretationGuidance}
`;

  if (isRelationship) {
    // Include Maraka analysis guidance only at high spice levels
    let synastry = VEDIC_SYSTEM.synastryAdditions;
    if (spiceLevel < 7) {
      synastry = synastry.replace(/- At Spice Level 7\+:[\s\S]*?suggest\n/, '');
    }
    section += synastry;
  }

  return section;
}
