/**
 * KABBALISTIC ASTROLOGY SYSTEM GUIDANCE
 * 
 * Expert instructions for Kabbalistic/Tree of Life analysis.
 * 
 * CRITICAL: Do NOT use Western astrology terms!
 * 
 * Source: Michael's gold prompt documents
 */

export const KABBALAH_SYSTEM = {
  name: 'Kabbalistic Astrology',
  
  criticalWarning: `
═══════════════════════════════════════════════════════════════════════════════
⚠️ CRITICAL: THIS IS KABBALAH, NOT WESTERN ASTROLOGY
═══════════════════════════════════════════════════════════════════════════════

Kabbalah has its OWN cosmological system. NEVER use:
❌ "Sun sign", "Moon sign", "Ascendant"
❌ Zodiac signs described in Western way
❌ Planetary positions like Western astrology
❌ Houses in the Western sense

USE ONLY KABBALISTIC CONCEPTS:
✓ The 10 Sephiroth
✓ Tikkun (soul correction)
✓ Klipoth (shells/shadows)
✓ The 22 Paths (Hebrew letters)
✓ The 72 Names of God
✓ Gilgul (reincarnation)
✓ Mazal (spiritual influence from Hebrew month)
✓ The Four Worlds
✓ The Zohar teachings
`,

  individualCoverage: `
KABBALISTIC ASTROLOGY - INDIVIDUAL ANALYSIS:

Cover these elements in depth:

THE TREE OF LIFE MAPPING:
Based on birth data, which Sephiroth are emphasized?
Where does their soul sit on the Tree?
What path are they walking between Sephiroth?

TIKKUN (SOUL CORRECTION):
- What is their Tikkun, their soul homework for this lifetime?
- What patterns must they break?
- What did they come to correct from past lives?
- Their spiritual assignment

DOMINANT SEPHIROTIC ENERGY:
Which Sephirah dominates their expression?
- Keter: Divine will, transcendence
- Chokmah: Wisdom, flash of insight, masculine
- Binah: Understanding, form, feminine
- Chesed: Mercy, loving-kindness, expansion
- Gevurah: Severity, strength, judgment, boundaries
- Tiferet: Beauty, balance, heart center, harmony
- Netzach: Victory, eternity, passion, creativity
- Hod: Splendor, glory, intellect, communication
- Yesod: Foundation, connection, sexuality, dreams
- Malkuth: Kingdom, physical reality, manifestation

KLIPOTHIC PATTERNS (Shadow Shells):
- What Klipoth (shadow forces) are they susceptible to?
- What spiritual traps do they fall into?
- What patterns possess them when unconscious?
- The dark side of each emphasized Sephirah

THE FOUR WORLDS:
- Atziluth (Fire): Spiritual/archetypal level
- Beriah (Water): Creative/emotional level
- Yetzirah (Air): Formative/mental level
- Assiyah (Earth): Action/physical level
- Where is their balance? Where are they weak?

GILGUL (Reincarnation):
- Past life indicators
- What they're carrying forward
- Unfinished business from previous incarnations

THE 22 PATHS:
- Which Hebrew letters are significant?
- What paths on the Tree are they traversing?
- What lessons are encoded in their journey?

DIVINE CONNECTIONS:
- Hebrew month significance (Mazal)
- Relevant names of God
- Angelic connections
`,

  synastryAdditions: `
KABBALISTIC SYNASTRY ADDITIONS:

For relationship analysis, also cover:
- Sephiroth Combinations
  → How do their Trees interact?
  → What structure do they create together?
  → Balance or imbalance?

- Complementary or Conflicting Tikkunim
  → Do their soul corrections align?
  → Do they help each other's spiritual homework?
  → Or do they obstruct each other's path?

- Klipothic Interaction
  → What shadows do they activate in each other?
  → What darkness emerges when they combine?
  → What spiritual traps might they fall into together?

- Four Worlds Together
  → Combined elemental balance
  → Shared strengths and blind spots
  → What World do they both neglect?

- Gilgul Connections
  → Past life links between them
  → Old soul contracts
  → What karma are they resolving?

- Soul Contract
  → From Kabbalistic view, why did they meet?
  → What is the sacred purpose of this connection?
  → What are they meant to accomplish together?

- Mystical Practices for the Couple
  → Specific spiritual work for their dynamic
`,

  sephirothReference: `
THE 10 SEPHIROTH REFERENCE:

1. KETER (Crown)
   Divine will, transcendence, the point of origin
   
2. CHOKMAH (Wisdom)
   Masculine principle, flash of insight, father
   
3. BINAH (Understanding)
   Feminine principle, form and structure, mother
   
4. CHESED (Mercy/Loving-kindness)
   Expansion, generosity, grace, the right arm
   
5. GEVURAH (Severity/Strength)
   Contraction, boundaries, judgment, the left arm
   
6. TIFERET (Beauty)
   Heart center, balance, harmony, the son
   
7. NETZACH (Victory/Eternity)
   Passion, creativity, desire, the right leg
   
8. HOD (Splendor/Glory)
   Intellect, communication, form, the left leg
   
9. YESOD (Foundation)
   Connection, sexuality, dreams, the generative
   
10. MALKUTH (Kingdom)
    Physical reality, manifestation, the bride
`,

  emphasis: 'Soul purpose, mystical depth, sacred practice, Tikkun',
  
  avoid: `
AVOID:
- ANY Western astrology terminology
- Cultural appropriation
- Overly esoteric without grounding
- Treating Kabbalah as astrology (it's mysticism)
- Ignoring the practical Tikkun work
`,
};

/**
 * Build Kabbalah system guidance section
 */
export function buildKabbalahSection(isRelationship: boolean): string {
  let section = `
${KABBALAH_SYSTEM.criticalWarning}

═══════════════════════════════════════════════════════════════════════════════
SYSTEM: ${KABBALAH_SYSTEM.name}
═══════════════════════════════════════════════════════════════════════════════

${KABBALAH_SYSTEM.individualCoverage}

${KABBALAH_SYSTEM.sephirothReference}

EMPHASIS: ${KABBALAH_SYSTEM.emphasis}

${KABBALAH_SYSTEM.avoid}
`;

  if (isRelationship) {
    section += KABBALAH_SYSTEM.synastryAdditions;
  }

  return section;
}
