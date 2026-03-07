"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.WORD_COUNT_TARGETS = exports.INDIVIDUAL_QUALITY_CHECKS = exports.OVERLAY_QUALITY_CHECKS = exports.NUCLEAR_QUALITY_CHECKS = exports.SPICY_SURREAL_QUALITY_CHECKS = exports.PRODUCTION_QUALITY_CHECKS = exports.BASE_QUALITY_CHECKS = void 0;
exports.buildQualitySection = buildQualitySection;
const wordCounts_1 = require("../config/wordCounts");
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
exports.BASE_QUALITY_CHECKS = [
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
exports.PRODUCTION_QUALITY_CHECKS = [
    ...exports.BASE_QUALITY_CHECKS,
    'Sophisticated but accessible tone',
    'David Attenborough narrating souls quality',
    'Shadow appropriately emphasized (25-35%)',
];
exports.SPICY_SURREAL_QUALITY_CHECKS = [
    ...exports.BASE_QUALITY_CHECKS,
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
exports.NUCLEAR_QUALITY_CHECKS = [
    'All 5 systems synthesized seamlessly (WOVEN, not listed)',
    'Each part flows into the next',
    'Word count per part maintained',
];
exports.OVERLAY_QUALITY_CHECKS = [
    'Relationship-status agnostic language',
    'Both people analyzed independently before dynamic',
];
exports.INDIVIDUAL_QUALITY_CHECKS = [
    'Correct voice (you vs they) maintained',
    'System expertise evident',
];
/**
 * Word count checks by reading type - ALL use same standard
 */
exports.WORD_COUNT_TARGETS = {
    individual: wordCounts_1.WORD_COUNT_LIMITS,
    overlay: wordCounts_1.WORD_COUNT_LIMITS,
    nuclear_part: wordCounts_1.WORD_COUNT_LIMITS,
    verdict: wordCounts_1.WORD_COUNT_LIMITS,
};
/**
 * Build quality verification section
 */
function buildQualitySection(style, readingType, partNumber) {
    // Get style-specific checks
    const styleChecks = style === 'spicy_surreal'
        ? exports.SPICY_SURREAL_QUALITY_CHECKS
        : exports.PRODUCTION_QUALITY_CHECKS;
    // Get reading-type specific checks
    let typeChecks = [];
    let wordCount = '';
    switch (readingType) {
        case 'individual':
            typeChecks = exports.INDIVIDUAL_QUALITY_CHECKS;
            wordCount = `${exports.WORD_COUNT_TARGETS.individual.min}-${exports.WORD_COUNT_TARGETS.individual.max} words`;
            break;
        case 'overlay':
            typeChecks = exports.OVERLAY_QUALITY_CHECKS;
            wordCount = `${exports.WORD_COUNT_TARGETS.overlay.min}-${exports.WORD_COUNT_TARGETS.overlay.max} words`;
            break;
        case 'nuclear':
            typeChecks = exports.NUCLEAR_QUALITY_CHECKS;
            if (partNumber) {
                wordCount = `Part ${partNumber}: ${exports.WORD_COUNT_TARGETS.nuclear_part.min}-${exports.WORD_COUNT_TARGETS.nuclear_part.max} words`;
            }
            else {
                wordCount = `Package: 16 readings × ~${wordCounts_1.STANDARD_READING.target} words = ~${16 * wordCounts_1.STANDARD_READING.target} words total`;
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
//# sourceMappingURL=quality-checks.js.map