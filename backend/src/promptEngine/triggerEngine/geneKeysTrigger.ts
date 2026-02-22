import {
  CORE_FAIRYTALE_SEED,
  NARRATIVE_TRIGGER_LABEL,
  NARRATIVE_TRIGGER_TITLE,
  TRIGGER_WORD_RULE,
  WRITING_CONTRAST_RULE,
  WRITING_ENDING_RULE,
  WRITING_NON_FABRICATION_RULE,
  WRITING_REALISM_RULE,
  WRITING_CLARITY_RULE,
  WRITING_shadow_RULE,
  buildTriggerProvocations,
} from './triggerConfig';

/**
 * GENE KEYS TRIGGER ENGINE
 *
 * Two-call architecture for individual Gene Keys readings.
 *
 * 1. stripGeneKeysChartData()      — pure code, ~25 highest-signal lines
 * 2. buildGeneKeysTriggerPrompt()    — trigger call → 80-120 word paragraph
 * 3. buildGeneKeysWritingPrompt()  — writing call → configurable word target
 */

// ─── 1. STRIP ────────────────────────────────────────────────────────────────

/**
 * Gene Keys chart data is already concise.
 * Keep the full profile (Activation, Venus, Pearl) to maximize grounding.
 */
export function stripGeneKeysChartData(raw: string): string {
  return String(raw || '')
    .split('\n')
    .map((line) => line.trimEnd())
    .filter((line) => line.trim().length > 0)
    .join('\n')
    .trim();
}

// ─── 2. TRIGGER PROMPT ───────────────────────────────────────────────────────

export function buildGeneKeysTriggerPrompt(params: {
  personName: string;
  strippedChartData: string;
}): string {
  const { personName, strippedChartData } = params;
  const trigger = NARRATIVE_TRIGGER_LABEL;

  return [
    `You are reading ${personName}'s Gene Keys hologenetic profile to find the central ${trigger}.`,
    '',
    `In Gene Keys, the ${trigger} lives in the Shadow frequency.`,
    'The Shadow of Life\'s Work is what this person compulsively does instead of their purpose.',
    'The Shadow of Evolution is the developmental trap they keep falling into.',
    'Together they form the specific flavor of unconscious self-sabotage.',
    '',
    `The ${trigger} is not a shadow name. It is not a key number.`,
    'It is the lived behavior pattern that the shadow frequencies produce in this specific person.',
    'The thing they apologize for, perform around, or cannot see in themselves.',
    '',
    TRIGGER_WORD_RULE,
    'Third person. Use selective Gene Keys language (key, Shadow, Gift, Siddhi) only when needed, and explain each term in plain words immediately.',
    'No repair instructions. Avoid generic reassurance.',
    'Specific enough that no other profile produces this exact sentence.',
    'It must cost something to read.',
    '',
    'Do not describe the system as a manual. Do not list keys or spheres mechanically.',
    'Do not offer Gift or Siddhi as instant consolation.',
    `Name the ${trigger}. Stop.`,
    '',
    'CHART DATA:',
    strippedChartData,
    '',
    `Write the ${trigger} paragraph now:`,
  ].join('\n');
}

// ─── 3. WRITING PROMPT ───────────────────────────────────────────────────────

export function buildGeneKeysWritingPrompt(params: {
  personName: string;
  narrativeTrigger: string;
  strippedChartData: string;
  targetWords: number;
}): string {
  const { personName, narrativeTrigger, strippedChartData, targetWords } = params;
  const trigger = NARRATIVE_TRIGGER_LABEL;
  const triggerTitle = NARRATIVE_TRIGGER_TITLE;

  return [
    'You are a novelist who is interested in the gap between potential and what people actually do.',
    CORE_FAIRYTALE_SEED,
    WRITING_CLARITY_RULE,
    'You think in codon sequences, frequency shifts, DNA memory.',
    'You have read Carlos Castaneda, Rainer Maria Rilke, and Ursula Le Guin.',
    'You are telling the story of a consciousness learning to inhabit itself. Not writing a Gene Keys report.',
    '',
    '══════════════════════════════════════════════════════════',
    'PSYCHOLOGICAL PROVOCATIONS — THINK BEFORE YOU WRITE',
    '══════════════════════════════════════════════════════════',
    buildTriggerProvocations(personName),
    '',
    '══════════════════════════════════════════════════════════',
    `${triggerTitle} — THIS IS THE SPINE OF EVERYTHING YOU WRITE:`,
    narrativeTrigger,
    `Every paragraph must connect to this ${trigger} or deepen it.`,
    `If a paragraph does not serve the ${trigger}, it does not belong here.`,
    '══════════════════════════════════════════════════════════',
    '',
    'NARRATOR:',
    '- Third person only. Never "you" or "your". Use the name.',
    `- Shadow frequencies are not villains — they are the form the ${trigger} takes in daily life.`,
    '- The body carries the frequency. The nervous system is the site of the story.',
    `- ${WRITING_NON_FABRICATION_RULE}`,
    `- ${WRITING_REALISM_RULE}`,
    '',
    'SHADOW & DEPTH:',
    `- ${WRITING_shadow_RULE}`,
    '- The Shadow frequency is where they live most of the time. Name what that costs.',
    '- Do not moralize. Do not offer repair instructions. Just name what is true.',
    '',
    'STRUCTURE:',
    '- One continuous layered essay in paragraphs. No section titles or standalone headline lines.',
    '- Move from shadow (the problem) toward the specific gap (what is not yet available to them).',
    '- The ending does not resolve. It leaves the frequency question open.',
    `- ${WRITING_CONTRAST_RULE}`,
    '',
    'ANTI-SURVEY:',
    `- Do not explain Gene Keys. Serve the ${trigger}.`,
    '- Do not dump spheres/keys/frequencies as technical lists without explanation.',
    '- Do not invent scenes ("one night", "at dinner", "on Tuesday") unless explicitly provided in user context.',
    '- Explain Gene Keys terms in plain language the first time they appear.',
    '- Every paragraph must add new consequence or evidence.',
    '',
    `LENGTH: ${targetWords.toLocaleString('en-US')} words. Write until the ${trigger} is fully present. Then stop.`,
    WRITING_ENDING_RULE,
    '',
    'CHART DATA (authoritative — do not invent or contradict):',
    strippedChartData,
    '',
    `Write ${personName}'s reading now:`,
  ].join('\n');
}
