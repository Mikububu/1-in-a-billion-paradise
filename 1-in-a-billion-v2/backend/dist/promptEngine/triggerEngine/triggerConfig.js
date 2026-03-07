"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CORE_FAIRYTALE_SEED_OVERLAY = exports.CORE_FAIRYTALE_SEED = exports.NARRATIVE_TRIGGER_VARIATION_RULE = exports.RELATIONAL_TRIGGER_TITLE = exports.RELATIONAL_TRIGGER_LABEL = exports.NARRATIVE_TRIGGER_TITLE = exports.NARRATIVE_TRIGGER_LABEL = exports.NARRATIVE_TRIGGER_STYLE = exports.NARRATIVE_TRIGGER_TYPE = void 0;
function parseTriggerType(value) {
    if (value === 'wound' || value === 'core-conflict' || value === 'soul-knot')
        return value;
    return null;
}
function parseTriggerStyle(value) {
    if (value === 'single' || value === 'blended')
        return value;
    return null;
}
/**
 * Global trigger selector (single source of truth).
 * Override without code edits via env:
 * - NARRATIVE_TRIGGER_TYPE=wound|core-conflict|soul-knot
 * - NARRATIVE_TRIGGER_STYLE=single|blended
 */
exports.NARRATIVE_TRIGGER_TYPE = parseTriggerType(process.env.NARRATIVE_TRIGGER_TYPE?.trim()) ?? 'wound';
exports.NARRATIVE_TRIGGER_STYLE = parseTriggerStyle(process.env.NARRATIVE_TRIGGER_STYLE?.trim()) ?? 'blended';
const TRIGGER_LABELS = {
    wound: { singular: 'wound', title: 'WOUND' },
    'core-conflict': { singular: 'core conflict', title: 'CORE CONFLICT' },
    'soul-knot': { singular: 'soul knot', title: 'SOUL KNOT' },
};
const activeTrigger = TRIGGER_LABELS[exports.NARRATIVE_TRIGGER_TYPE];
exports.NARRATIVE_TRIGGER_LABEL = exports.NARRATIVE_TRIGGER_STYLE === 'single'
    ? activeTrigger.singular
    : 'core fracture';
exports.NARRATIVE_TRIGGER_TITLE = exports.NARRATIVE_TRIGGER_STYLE === 'single'
    ? activeTrigger.title
    : 'CORE FRACTURE';
exports.RELATIONAL_TRIGGER_LABEL = `relational ${exports.NARRATIVE_TRIGGER_LABEL}`;
exports.RELATIONAL_TRIGGER_TITLE = `RELATIONAL ${exports.NARRATIVE_TRIGGER_TITLE}`;
exports.NARRATIVE_TRIGGER_VARIATION_RULE = 'Vary trigger vocabulary naturally across the reading: wound, core conflict, soul knot, fracture, pressure point. Do not repeat one keyword as a refrain.';
exports.CORE_FAIRYTALE_SEED = [
    'Write this as a fairytale about a soul that came to Earth and is having a human experience.',
    `The narrative trigger is the ${exports.NARRATIVE_TRIGGER_LABEL}; serve it relentlessly.`,
    exports.NARRATIVE_TRIGGER_VARIATION_RULE,
    'Present tense. NEVER invent fictional characters - no named partners, friends, exes, or colleagues that do not appear in the chart data.',
].join(' ');
/**
 * Overlay-specific narrative seed.
 * Shared across all synastry/overlay writing prompts.
 */
exports.CORE_FAIRYTALE_SEED_OVERLAY = [
    'Write this as a fairytale about two souls who came to Earth and what happens when their energies collide.',
    `The narrative trigger is the ${exports.RELATIONAL_TRIGGER_LABEL}; serve it relentlessly.`,
    exports.NARRATIVE_TRIGGER_VARIATION_RULE,
    'Present tense. NEVER invent fictional characters - no named partners, friends, exes, or colleagues that do not appear in the chart data.',
].join(' ');
//# sourceMappingURL=triggerConfig.js.map