/**
 * GENE KEYS SYSTEM GUIDANCE
 * 
 * Expert instructions for Gene Keys analysis.
 * 
 * Source: Michael's gold prompt documents
 */

export const GENE_KEYS_SYSTEM = {
  name: 'Gene Keys',
  
  individualCoverage: `
GENE KEYS - INDIVIDUAL ANALYSIS:

Cover these elements in depth:

ACTIVATION SEQUENCE (PRIMARY):
- Life's Work (Personality Sun): Core purpose, what they're here to do
  → Shadow state: The fear-based expression
  → Gift state: The breakthrough expression
  → Siddhi state: The fully realized potential

- Evolution (Personality Earth): What they magnetize, evolutionary edge
  → Full Shadow/Gift/Siddhi journey

- Radiance (Design Sun): Unconscious emanation, how they shine
  → Full Shadow/Gift/Siddhi journey

- Purpose (Design Earth): Deepest calling, soul direction
  → Full Shadow/Gift/Siddhi journey

VENUS SEQUENCE (RELATIONSHIPS):
- Personality Venus: Conscious relationship patterns
- Design Venus: Unconscious attraction patterns

PEARL SEQUENCE (PROSPERITY):
- Personality Moon: Emotional/prosperity driver
- Design Moon: Unconscious foundation

FOR EACH KEY, EXPLORE ALL THREE FREQUENCIES:
- SHADOW: The fear-based, reactive, contracted expression
  → What fears drive it?
  → What behaviors emerge?
  → How does it sabotage?

- GIFT: The breakthrough, integrated, flowing expression
  → What unlocks it?
  → How does it manifest?
  → What becomes possible?

- SIDDHI: The fully realized, transcendent expression
  → What does mastery look like?
  → The ultimate potential
`,

  synastryAdditions: `
GENE KEYS SYNASTRY ADDITIONS:

For relationship analysis, also cover:
- How their Keys interact
  → Shadow triggering: Which shadows activate each other's wounds?
  → Gift activation: How can they unlock each other's gifts?
  
- Contemplation practices for their specific dynamic
- Consciousness evolution potential together
- Siddhi field they could create if both realized
- Where they might reinforce each other's shadows
- The alchemy possible between their frequencies
`,

  emphasis: 'Consciousness evolution, shadow work, awakening path, contemplation',
  
  avoid: `
AVOID:
- Treating Gene Keys like personality typing
- Spiritual bypassing
- Ignoring the shadow
- Using terms like "negative trait" (use SHADOW)
- Using terms like "positive trait" (use GIFT)
`,

  terminology: `
CRITICAL - USE GENE KEYS TERMINOLOGY:
✓ Shadow, Gift, Siddhi (NOT "negative/positive trait")
✓ Activation Sequence, Venus Sequence, Pearl Sequence
✓ Contemplation (the core practice)
✓ Frequency (the level of consciousness)
✓ Programming Partner, Design, Personality
✓ The Spectrum of Consciousness

Gene Keys is NOT personality typing. It's a map of consciousness evolution.
Every shadow contains a gift. Every gift opens to a siddhi.
The journey is from fear (shadow) through love (gift) to unity (siddhi).
`,
};

/**
 * Build Gene Keys system guidance section
 */
export function buildGeneKeysSection(isRelationship: boolean): string {
  let section = `
═══════════════════════════════════════════════════════════════════════════════
SYSTEM: ${GENE_KEYS_SYSTEM.name}
═══════════════════════════════════════════════════════════════════════════════

${GENE_KEYS_SYSTEM.individualCoverage}

${GENE_KEYS_SYSTEM.terminology}

EMPHASIS: ${GENE_KEYS_SYSTEM.emphasis}

${GENE_KEYS_SYSTEM.avoid}
`;

  if (isRelationship) {
    section += GENE_KEYS_SYSTEM.synastryAdditions;
  }

  return section;
}
