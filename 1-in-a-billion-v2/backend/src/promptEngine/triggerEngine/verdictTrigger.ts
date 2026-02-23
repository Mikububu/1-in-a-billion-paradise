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
    '',
    'THEN, after the prose ends, append a COMPATIBILITY SCORES block.',
    'Format EXACTLY like this — no markdown, no asterisks, clean plain text.',
    'Each score is 0-100. Each score has a 4-sentence verdict beneath it — specific, chart-anchored, unflinching.',
    '',
    `COMPATIBILITY SCORES: ${person1Name} & ${person2Name}`,
    '',
    'OVERALL ALIGNMENT: [0-100]',
    '[4 sentences: the headline truth about this connection across all five systems.]',
    '',
    'WESTERN ASTROLOGY: [0-100]',
    '[4 sentences: tropical chart synastry — specific cross-aspects that drive this score.]',
    '',
    'VEDIC JYOTISH: [0-100]',
    '[4 sentences: sidereal synastry, Nakshatra compatibility, Dasha alignment.]',
    '',
    'HUMAN DESIGN: [0-100]',
    '[4 sentences: circuit compatibility, channel completion, authority interplay.]',
    '',
    'GENE KEYS: [0-100]',
    '[4 sentences: shadow/gift resonance, frequency dynamic between profiles.]',
    '',
    'KABBALAH: [0-100]',
    '[4 sentences: Tikkun alignment, Sefirotic structure, Klipothic interference.]',
    '',
    'SEXUAL CHEMISTRY: [0-100]',
    '[4 sentences: raw erotic potential, what the bedroom would become.]',
    '',
    'PAST LIFE CONNECTION: [0-100]',
    '[4 sentences: karmic signatures across systems, soul familiarity.]',
    '',
    'WORLD-CHANGING POTENTIAL: [0-100]',
    '[4 sentences: what they could build externally if combined.]',
    '',
    'KARMIC VERDICT: [0-100]',
    '[4 sentences: comfort trap or crucible of transformation.]',
    '',
    'GROWTH POTENTIAL: [0-100]',
    '[4 sentences: what they could become together if conscious.]',
    '',
    'SHADOW RISK: [0-100]',
    '[4 sentences: destruction potential if unconscious — higher = riskier.]',
    '',
    'MAGNETIC PULL: [0-100]',
    '[4 sentences: raw gravitational force regardless of wisdom.]',
    '',
    'LONG-TERM SUSTAINABILITY: [0-100]',
    '[4 sentences: can this field sustain itself over time.]',
    '',
    'SCORING RULES:',
    '- Use the full 0-100 range. Do not cluster around 70-80.',
    '- A score of 95+ means genuinely rare. Below 30 means structural incompatibility.',
    '- Overall Alignment is NOT an average. It is a synthesis judgment.',
  ].join('\n');
}
