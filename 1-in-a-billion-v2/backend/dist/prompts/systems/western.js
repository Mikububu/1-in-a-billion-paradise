"use strict";
/**
 * WESTERN ASTROLOGY SYSTEM GUIDANCE
 *
 * Expert instructions for Western/Tropical astrology analysis.
 *
 * Source: Michael's gold prompt documents
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.WESTERN_SYSTEM = void 0;
exports.buildWesternSection = buildWesternSection;
exports.WESTERN_SYSTEM = {
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
function buildWesternSection(isRelationship) {
    let section = `
═══════════════════════════════════════════════════════════════════════════════
SYSTEM: ${exports.WESTERN_SYSTEM.name}
═══════════════════════════════════════════════════════════════════════════════

${exports.WESTERN_SYSTEM.individualCoverage}

EMPHASIS: ${exports.WESTERN_SYSTEM.emphasis}

${exports.WESTERN_SYSTEM.avoid}
`;
    if (isRelationship) {
        section += exports.WESTERN_SYSTEM.synastryAdditions;
    }
    return section;
}
//# sourceMappingURL=western.js.map