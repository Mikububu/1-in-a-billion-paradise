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
  'You are telling the story of a soul, not analyzing a chart.',
  'This is consciousness noir: a dark fairytale for adults, intimate, penetrating, unforgettable.',
  'Every chart is a character study. Every placement is a chapter of desire and shadow.',
  'Stay grounded in the provided chart evidence. Prefer patterns and lived consequences over invented scenes.',
  `The narrative trigger is the ${NARRATIVE_TRIGGER_LABEL}; serve it relentlessly.`,
  NARRATIVE_TRIGGER_VARIATION_RULE,
].join(' ');

/**
 * Overlay-specific narrative seed.
 * Shared across all synastry/overlay writing prompts.
 */
export const CORE_FAIRYTALE_SEED_OVERLAY =
  [
    'You are telling the story of two souls colliding, not comparing two charts.',
    'This is consciousness noir: a dark fairytale for adults, intimate, penetrating, unforgettable.',
    'Stay grounded in the provided chart evidence. Prefer relational patterns and consequences over invented scenes.',
    `The narrative trigger is the ${RELATIONAL_TRIGGER_LABEL}; serve it relentlessly.`,
    NARRATIVE_TRIGGER_VARIATION_RULE,
  ].join(' ');

/**
 * Psychological provocations — forces the model to think deeply before writing.
 * Restored from the original builder.ts provocations that made April readings compelling.
 */
export function buildTriggerProvocations(personName: string): string {
  return [
    `BEFORE YOU WRITE, CONTEMPLATE THESE ABOUT ${personName.toUpperCase()}:`,
    '',
    'FEAR & SHADOW:',
    `1. What is ${personName} actually terrified of — the fear they have never admitted?`,
    `2. What do they do to avoid feeling that terror? What patterns numb it?`,
    `3. What loop have they repeated in every relationship, and why can they not stop?`,
    '',
    'LONGING & DESIRE:',
    `4. What does ${personName} secretly long for that they would never admit?`,
    `5. What need have they buried so deep they have forgotten it exists?`,
    `6. What hunger lives in them that they hide, maybe even from themselves?`,
    '',
    'TRUTH & SACRIFICE:',
    `7. What truth about ${personName} would make them weep if spoken aloud?`,
    `8. What must they sacrifice to become who they were born to be?`,
    '',
    `YOUR TASK: Tell ${personName}'s story. Not the chart — the PERSON inside the chart.`,
  ].join('\n');
}

export function buildOverlayProvocations(person1Name: string, person2Name: string): string {
  return [
    `BEFORE YOU WRITE, CONTEMPLATE THESE ABOUT ${person1Name.toUpperCase()} AND ${person2Name.toUpperCase()}:`,
    '',
    `1. What does ${person1Name} need from ${person2Name} that they cannot ask for?`,
    `2. What does ${person2Name} need from ${person1Name} that they cannot ask for?`,
    '3. Where do their wounds hook into each other — the place where one person\'s damage activates the other\'s?',
    '4. What would the sex between them reveal about their psychology?',
    '5. What truth about this dynamic would make both of them flinch?',
    '6. Is this a doorway to liberation or a trapdoor to mutual destruction?',
    '',
    'YOUR TASK: Tell the story of what happens when these two souls collide. Not chart comparison — collision.',
  ].join('\n');
}

/**
 * Shared trigger/writing constraints across all systems.
 * Keep these centralized so tone/shape changes are single-edit.
 */
export const TRIGGER_WORD_RULE = 'Write one paragraph. 120-180 words.';
export const WRITING_CONTRAST_RULE =
  'Allow emotional contrast: brief moments of warmth, humor, relief, or tenderness are allowed when earned.';
export const WRITING_ENDING_RULE =
  'No forced uplift. Do not add a motivational ending; if tenderness appears, keep it brief and earned.';
export const WRITING_NON_FABRICATION_RULE =
  'Do not invent concrete biographical facts, dialogue, named third parties, jobs, timelines, or events not present in CHART DATA or explicit user context. If uncertain, write tendencies, not claims.';
export const WRITING_REALISM_RULE =
  'When claiming specific life events, use grounded language (can, tends to, often) unless a fact is explicitly present in CHART DATA. But when describing psychological patterns, be direct and unflinching.';
export const WRITING_CLARITY_RULE =
  'Write with intensity and precision. Surreal metaphor is welcome when it sharpens truth. Avoid vague theatrics that obscure meaning.';
export const WRITING_shadow_RULE =
  'Forty percent of this reading lives in shadow territory. Name the addiction potential, the manipulation patterns, the self-sabotage loops, the thing they do that destroys what they love.';
