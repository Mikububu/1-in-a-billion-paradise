/**
 * Single source of truth for shared narrative-trigger language.
 * Change once here, affects all trigger-engine prompts across systems.
 */
export type TriggerType = 'wound' | 'core-conflict' | 'soul-knot';
export type TriggerStyle = 'single' | 'blended';

function parseTriggerType(value: string | undefined): TriggerType | null {
  if (value === 'wound' || value === 'core-conflict' || value === 'soul-knot') return value;
  return null;
}

function parseTriggerStyle(value: string | undefined): TriggerStyle | null {
  if (value === 'single' || value === 'blended') return value;
  return null;
}

/**
 * Global trigger selector (single source of truth).
 * Override without code edits via env:
 * - NARRATIVE_TRIGGER_TYPE=wound|core-conflict|soul-knot
 * - NARRATIVE_TRIGGER_STYLE=single|blended
 */
export const NARRATIVE_TRIGGER_TYPE: TriggerType =
  parseTriggerType(process.env.NARRATIVE_TRIGGER_TYPE?.trim()) ?? 'wound';
export const NARRATIVE_TRIGGER_STYLE: TriggerStyle =
  parseTriggerStyle(process.env.NARRATIVE_TRIGGER_STYLE?.trim()) ?? 'blended';

const TRIGGER_LABELS: Record<TriggerType, { singular: string; title: string }> = {
  wound: { singular: 'wound', title: 'WOUND' },
  'core-conflict': { singular: 'core conflict', title: 'CORE CONFLICT' },
  'soul-knot': { singular: 'soul knot', title: 'SOUL KNOT' },
};

const activeTrigger = TRIGGER_LABELS[NARRATIVE_TRIGGER_TYPE];

export const NARRATIVE_TRIGGER_LABEL =
  NARRATIVE_TRIGGER_STYLE === 'single'
    ? activeTrigger.singular
    : 'core fracture';
export const NARRATIVE_TRIGGER_TITLE =
  NARRATIVE_TRIGGER_STYLE === 'single'
    ? activeTrigger.title
    : 'CORE FRACTURE';
export const RELATIONAL_TRIGGER_LABEL = `relational ${NARRATIVE_TRIGGER_LABEL}`;
export const RELATIONAL_TRIGGER_TITLE = `RELATIONAL ${NARRATIVE_TRIGGER_TITLE}`;
export const NARRATIVE_TRIGGER_VARIATION_RULE =
  'Vary trigger vocabulary naturally across the reading: wound, core conflict, soul knot, fracture, pressure point. Do not repeat one keyword as a refrain.';

export const CORE_FAIRYTALE_SEED = [
  'Write this as a fairytale about a soul that came to Earth and is having a human experience.',
  `The narrative trigger is the ${NARRATIVE_TRIGGER_LABEL}; serve it relentlessly.`,
  NARRATIVE_TRIGGER_VARIATION_RULE,
  'Present tense. NEVER invent fictional characters — no named partners, friends, exes, or colleagues that do not appear in the chart data.',
].join(' ');

/**
 * Overlay-specific narrative seed.
 * Shared across all synastry/overlay writing prompts.
 */
export const CORE_FAIRYTALE_SEED_OVERLAY =
  [
    'Write this as a fairytale about two souls who came to Earth and what happens when their energies collide.',
    `The narrative trigger is the ${RELATIONAL_TRIGGER_LABEL}; serve it relentlessly.`,
    NARRATIVE_TRIGGER_VARIATION_RULE,
    'Present tense. NEVER invent fictional characters — no named partners, friends, exes, or colleagues that do not appear in the chart data.',
  ].join(' ');
