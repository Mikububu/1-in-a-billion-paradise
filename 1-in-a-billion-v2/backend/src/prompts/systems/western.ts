/**
 * WESTERN ASTROLOGY SYSTEM GUIDANCE
 * 
 * Expert instructions for Western/Tropical astrology analysis.
 * 
 * Source: Michael's gold prompt documents
 */

export const WESTERN_SYSTEM = {
  name: 'Western Astrology',
  
  individualCoverage: `
WESTERN ASTROLOGY - INDIVIDUAL ANALYSIS:

Cover these elements in depth:

PRIMARY TRIAD:
- Sun (identity, life force, purpose, ego needs)
- Moon (emotions, subconscious, needs, childhood patterns)
- Rising/Ascendant (mask, approach to life, first impression, defense mechanisms)

PERSONAL PLANETS:
- Mercury (mind, communication, thinking patterns)
- Venus (values, love, beauty, what they attract)
- Mars (drive, desire, anger, how they assert)

SOCIAL PLANETS:
- Jupiter (expansion, wisdom, where they grow)
- Saturn (structure, discipline, lessons, fears)

OUTER PLANETS (note personal house placements):
- Uranus (rebellion, innovation, where they're different)
- Neptune (dreams, illusion, spiritual connection)
- Pluto (transformation, power, what they hide)

PATTERNS:
- Major aspects (especially to personal planets)
- Stelliums or emphasized houses
- Chart patterns (T-square, Grand Trine, Grand Cross, Yod)
- Empty houses and their meaning
`,

  synastryAdditions: `
WESTERN SYNASTRY ADDITIONS:

For relationship analysis, also cover:
- Venus-Mars dynamics (attraction, desire, romantic chemistry)
- Mercury aspects (communication compatibility)
- Moon connections (emotional understanding, comfort)
- Sun-Moon interaspects (ego-emotion dynamics)
- Saturn aspects (commitment, lessons, restrictions)
- Pluto aspects (transformation, power dynamics, obsession potential)
- House overlays (where each person's planets land in other's houses)
- Composite chart themes (the relationship as its own entity)
`,

  emphasis: 'Psychological depth, growth edges, life themes, internal conflicts',
  
  avoid: `
AVOID:
- Generic sun sign horoscope descriptions
- Fortune-telling language ("you will meet someone")
- Overly positive interpretations without shadow
- Ignoring difficult aspects
`,
};

/**
 * Build Western system guidance section
 */
export function buildWesternSection(isRelationship: boolean): string {
  let section = `
═══════════════════════════════════════════════════════════════════════════════
SYSTEM: ${WESTERN_SYSTEM.name}
═══════════════════════════════════════════════════════════════════════════════

${WESTERN_SYSTEM.individualCoverage}

EMPHASIS: ${WESTERN_SYSTEM.emphasis}

${WESTERN_SYSTEM.avoid}
`;

  if (isRelationship) {
    section += WESTERN_SYSTEM.synastryAdditions;
  }

  return section;
}
