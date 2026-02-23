import {
  RELATIONAL_TRIGGER_LABEL,
  RELATIONAL_TRIGGER_TITLE,
} from './triggerConfig';

/**
 * VERDICT TRIGGER ENGINE
 *
 * Script-path-only verdict engine (used by v2_generate_* scripts via
 * scripts/shared/generateReading.ts). The worker path intentionally uses
 * accumulated prior narrativeTrigger outputs + buildVerdictPrompt() instead.
 *
 * Two-call architecture for script verdict generation.
 *
 * 1) stripVerdictChartData()   -> deterministic compression of multi-system chart data
 * 2) buildVerdictTriggerPrompt() -> one focused relational trigger paragraph
 * 3) buildVerdictWritingPrompt() -> long-form synthesis + score block
 */

function isSystemHeader(line: string): boolean {
  return /^===\s+[A-Z_ ]+\s+(PERSON 1|PERSON 2|OVERLAY)\s+===\s*$/.test(line.trim());
}

/**
 * Keep the verdict input compact and stable.
 * We keep section headers + first N non-empty lines per section.
 */
export function stripVerdictChartData(raw: string): string {
  const lines = String(raw || '').split('\n');
  const out: string[] = [];
  let inSection = false;
  let keptInSection = 0;
  const MAX_LINES_PER_SECTION = 36;

  for (const line of lines) {
    const t = line.trim();

    if (isSystemHeader(line)) {
      if (out.length > 0 && out[out.length - 1] !== '') out.push('');
      out.push(t);
      inSection = true;
      keptInSection = 0;
      continue;
    }

    if (!inSection) continue;
    if (!t) continue;
    if (keptInSection >= MAX_LINES_PER_SECTION) continue;

    out.push(line);
    keptInSection += 1;
  }

  return out.join('\n').trim();
}

export function buildVerdictTriggerPrompt(params: {
  person1Name: string;
  person2Name: string;
  strippedChartData: string;
}): string {
  const { person1Name, person2Name, strippedChartData } = params;
  const relationalTrigger = RELATIONAL_TRIGGER_LABEL;

  return [
    `You are deriving the central ${relationalTrigger} between ${person1Name} and ${person2Name}.`,
    '',
    'Use all five systems as one field, not five separate reports.',
    `Do not summarize systems. Name one central ${relationalTrigger} dynamic that explains:`,
    '- what magnetizes them,',
    '- what destabilizes them,',
    '- what each person unconsciously needs from the other,',
    '- what this connection is trying to force into consciousness.',
    '',
    'Write exactly one paragraph, 100-160 words.',
    'Third person only. Use both names.',
    'No list format. No advice. No therapy language. No technical jargon.',
    'Specific enough that it cannot apply to a random pair.',
    '',
    'CHART DATA (compressed):',
    strippedChartData,
    '',
    `Write the ${relationalTrigger} paragraph now:`,
  ].join('\n');
}

export function buildVerdictWritingPrompt(params: {
  person1Name: string;
  person2Name: string;
  narrativeTrigger: string;
  strippedChartData: string;
  spiceLevel?: number;
  targetWords: number;
}): string {
  const { person1Name, person2Name, narrativeTrigger, strippedChartData, spiceLevel = 7, targetWords } = params;
  const relationalTriggerTitle = RELATIONAL_TRIGGER_TITLE;

  return [
    'You are a precise narrator delivering a final synthesis.',
    'Write as compelling long-form prose that stays understandable to non-experts.',
    '',
    '══════════════════════════════════════════════════════════',
    `${relationalTriggerTitle} SPINE (DO NOT IGNORE):`,
    narrativeTrigger,
    'All paragraphs must either deepen this spine or test it against evidence.',
    '══════════════════════════════════════════════════════════',
    '',
    'RULES:',
    `- Third person only. Use both names (${person1Name}, ${person2Name}).`,
    '- Explain technical terms on first use in plain language.',
    '- No bullet lists in prose.',
    '- No internal planning text or prompt labels.',
    '- Keep it emotionally honest. No fake positivity.',
    `- Spice calibration: ${Math.max(1, Math.min(10, spiceLevel))}/10 (affects candor and shadow depth).`,
    '',
    'STRUCTURE:',
    '- One continuous essay with 4 to 6 strong section headlines.',
    '- Include: synthesis, field dynamic, risk profile, growth potential, timing pressure, closing verdict.',
    '',
    'LENGTH:',
    `- Long-form. Minimum ${targetWords.toLocaleString('en-US')} words.`,
    '- Prefer depth over repetition.',
    '',
    'CHART DATA (compressed):',
    strippedChartData,
    '',
    `Write the final verdict for ${person1Name} and ${person2Name} now.`,
  ].join('\n');
}
