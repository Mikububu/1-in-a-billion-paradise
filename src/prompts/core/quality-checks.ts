/**
 * QUALITY CHECKS
 * 
 * Verification checklist appended to prompts.
 * Reminds the LLM what to verify before delivering.
 * 
 * Source: Michael's gold prompt documents
 */

/**
 * Base quality checks for all outputs
 */
export const BASE_QUALITY_CHECKS = [
  'NO AI phrasing ("this is not just...", "here\'s the thing...", etc.)',
  'NO markdown or bullets',
  'Literary voice maintained throughout',
  'Audio-ready formatting (numbers spelled out)',
  'Pure prose, flowing paragraphs',
  'NO weird symbols, unicode, or garbage text (text must be flawless for TTS)',
  'Headlines/sections have proper spacing after them for TTS pauses',
  'All text is readable and pronounceable (no broken words)',
];

/**
 * Style-specific quality checks
 */
export const PRODUCTION_QUALITY_CHECKS = [
  ...BASE_QUALITY_CHECKS,
  'Sophisticated but accessible tone',
  'David Attenborough narrating souls quality',
  'Shadow appropriately emphasized (25-35%)',
];

export const SPICY_SURREAL_QUALITY_CHECKS = [
  ...BASE_QUALITY_CHECKS,
  'Raw psychological honesty',
  'Surreal metaphor woven throughout (Lynch level)',
  'Archetypal depth (Jung level)',
  'NO corporate safe language',
  'Shadow/darkness emphasis (40%)',
  'Visceral, penetrating, occasionally shocking',
];

/**
 * Reading type specific checks
 */
export const NUCLEAR_QUALITY_CHECKS = [
  'All 5 systems synthesized seamlessly (WOVEN, not listed)',
  'Each part flows into the next',
  'Word count per part maintained',
];

export const OVERLAY_QUALITY_CHECKS = [
  'Relationship-status agnostic language',
  'Both people analyzed independently before dynamic',
];

export const INDIVIDUAL_QUALITY_CHECKS = [
  'Correct voice (you vs they) maintained',
  'System expertise evident',
];

/**
 * Word count checks by reading type
 */
export const WORD_COUNT_TARGETS = {
  individual: { min: 7500, target: 8000, max: 8500 },
  overlay: { min: 11000, target: 12000, max: 13000 },
  nuclear_part: { min: 5000, target: 6000, max: 7000 },
  nuclear_total: { min: 28000, target: 30000, max: 32000 },
};

/**
 * Build quality verification section
 */
export function buildQualitySection(
  style: 'production' | 'spicy_surreal',
  readingType: 'individual' | 'overlay' | 'nuclear',
  partNumber?: number
): string {
  // Get style-specific checks
  const styleChecks = style === 'spicy_surreal' 
    ? SPICY_SURREAL_QUALITY_CHECKS 
    : PRODUCTION_QUALITY_CHECKS;
  
  // Get reading-type specific checks
  let typeChecks: string[] = [];
  let wordCount = '';
  
  switch (readingType) {
    case 'individual':
      typeChecks = INDIVIDUAL_QUALITY_CHECKS;
      wordCount = `${WORD_COUNT_TARGETS.individual.min}-${WORD_COUNT_TARGETS.individual.max} words`;
      break;
    case 'overlay':
      typeChecks = OVERLAY_QUALITY_CHECKS;
      wordCount = `${WORD_COUNT_TARGETS.overlay.min}-${WORD_COUNT_TARGETS.overlay.max} words`;
      break;
    case 'nuclear':
      typeChecks = NUCLEAR_QUALITY_CHECKS;
      if (partNumber) {
        wordCount = `Part ${partNumber}: ${WORD_COUNT_TARGETS.nuclear_part.min}-${WORD_COUNT_TARGETS.nuclear_part.max} words`;
      } else {
        wordCount = `Total: ${WORD_COUNT_TARGETS.nuclear_total.min}-${WORD_COUNT_TARGETS.nuclear_total.max} words`;
      }
      break;
  }
  
  const allChecks = [...styleChecks, ...typeChecks];
  const checkList = allChecks.map(c => `✓ ${c}`).join('\n');
  
  return `
═══════════════════════════════════════════════════════════════════════════════
QUALITY VERIFICATION (Check before delivering):
═══════════════════════════════════════════════════════════════════════════════

${checkList}
✓ Word count: ${wordCount}
`;
}
