/**
 * SEPARATE LLM SCORING CALL
 *
 * Generates compatibility scores as a dedicated 3rd LLM call AFTER the
 * reading prose is finalized. This keeps the reading text clean (no embedded
 * scores) so it can feed the audio pipeline, while producing structured
 * graphical data for the PDF compatibility snapshot page.
 *
 * 10 categories, each scored 0-100 with 2-3 sentences of reasoning.
 */

import { llmPaid } from '../../services/llm';

export type CompatibilityScore = {
  label: string;
  score: number;       // 0-100
  scoreTen: number;    // 0-10 (for PDF progress bars)
  note: string;        // 2-3 sentences of reasoning
};

const OVERLAY_CATEGORIES = [
  { key: 'SEXUAL CHEMISTRY', instruction: 'Raw erotic/physical charge. What the bedroom would become — liberation or consumption.' },
  { key: 'MAGNETIC PULL', instruction: 'How hard it would be to walk away. The raw gravitational force regardless of wisdom.' },
  { key: 'KARMIC RESONANCE', instruction: 'Past life / soul familiarity. Whether this feels like recognition or repetition.' },
  { key: 'SHADOW RISK', instruction: 'Destruction potential if both remain unconscious. What this looks like at its worst.' },
  { key: 'HEALING POTENTIAL', instruction: 'Mutual growth capacity. What they could become together if conscious.' },
  { key: 'DAILY LIFE', instruction: 'Can they actually function together in ordinary routines, logistics, domestic reality.' },
  { key: 'LONG-TERM SUSTAINABILITY', instruction: 'Staying power over time. Can this field sustain itself or does it burn out.' },
  { key: 'WORLD-CHANGING POTENTIAL', instruction: 'What they could build or ignite externally if they combined forces.' },
  { key: 'COMMUNICATION DEPTH', instruction: 'How deep the understanding goes. Whether they truly hear each other or perform hearing.' },
  { key: 'TOXIC RELATIONSHIP POTENTIAL', instruction: 'How badly it could go wrong. The specific pattern of damage if unconscious.' },
];

const VERDICT_CATEGORIES = [
  ...OVERLAY_CATEGORIES,
  { key: 'OVERALL ALIGNMENT', instruction: 'The headline truth about this connection synthesized across all five systems.' },
  { key: 'WESTERN ASTROLOGY', instruction: 'Tropical chart synastry — specific cross-aspects that drive this score.' },
  { key: 'VEDIC JYOTISH', instruction: 'Sidereal synastry, Nakshatra compatibility, Dasha alignment.' },
  { key: 'HUMAN DESIGN', instruction: 'Circuit compatibility, channel completion, authority interplay.' },
  { key: 'GENE KEYS', instruction: 'Shadow/gift resonance, frequency dynamic between profiles.' },
  { key: 'KABBALAH', instruction: 'Tikkun alignment, Sefirotic structure, Klipothic interference.' },
];

function buildScoringPrompt(params: {
  person1Name: string;
  person2Name: string;
  readingText: string;
  chartData: string;
  categories: typeof OVERLAY_CATEGORIES;
  isVerdict: boolean;
}): string {
  const { person1Name, person2Name, readingText, chartData, categories, isVerdict } = params;

  const categoryBlock = categories.map((cat) =>
    `${cat.key}: [0-100]\n[2-3 sentences: ${cat.instruction}]`
  ).join('\n\n');

  return [
    `You are a precise analyst scoring the compatibility between ${person1Name} and ${person2Name}.`,
    '',
    'You have just read the following analysis of their connection:',
    '════════════════════════════════════════════════════════════════',
    readingText.slice(0, 12000), // Keep within token budget
    '════════════════════════════════════════════════════════════════',
    '',
    'CHART DATA (authoritative):',
    chartData.slice(0, 6000),
    '',
    'Based on the reading above and the chart data, score each category below.',
    '',
    'OUTPUT FORMAT — follow EXACTLY, no markdown, no asterisks, clean plain text:',
    '',
    categoryBlock,
    '',
    'SCORING RULES:',
    '- Use the FULL 0-100 range. Do not cluster around 70-80.',
    '- A score of 90+ means genuinely rare alignment. Below 30 means structural incompatibility.',
    '- Each score MUST have 2-3 sentences of specific reasoning anchored to chart data or the reading.',
    `- ALTERNATE which person you mention first. Do NOT always lead with ${person1Name}. This is about the PAIR, not about one person.`,
    '- Be honest and unflinching. No therapy language. No fake positivity.',
    isVerdict
      ? '- OVERALL ALIGNMENT is NOT an average — it is a synthesis judgment across all five systems.'
      : `- These scores are derived from THIS system's chart data only.`,
    '',
    'Output the scores now:',
  ].join('\n');
}

function parseScores(raw: string): CompatibilityScore[] {
  const text = String(raw || '');
  const scoreBlockRe = /^([A-Z][A-Z &\-\/]+?):\s*(\d{1,3})\s*$/gm;
  const matches: Array<{ label: string; score100: number; startIndex: number; endIndex: number }> = [];
  let m: RegExpExecArray | null;

  while ((m = scoreBlockRe.exec(text)) !== null) {
    const rawLabel = (m[1] || '').trim();
    const score100 = Number(m[2]);
    if (!rawLabel || !Number.isFinite(score100)) continue;
    if (/^(COMPATIBILITY|SCORING|FORMAT|OUTPUT|STRUCTURE|STYLE|BASED|SCORE)/i.test(rawLabel)) continue;
    if (score100 < 0 || score100 > 100) continue;
    matches.push({ label: rawLabel, score100, startIndex: m.index, endIndex: m.index + m[0].length });
  }

  const rows: CompatibilityScore[] = [];
  for (let i = 0; i < matches.length; i++) {
    const current = matches[i];
    const nextIndex = i + 1 < matches.length
      ? matches[i + 1].startIndex  // Start of next label line — no more guessing offsets
      : text.length;
    const noteText = text.slice(current.endIndex, nextIndex).trim();
    const sentences = noteText
      .split(/(?<=[.!?])\s+/)
      .filter((s) => s.trim().length > 10)
      .slice(0, 3);
    const note = sentences.join(' ').trim();

    rows.push({
      label: toTitleCase(current.label),
      score: current.score100,
      scoreTen: Math.max(0, Math.min(10, Math.round((current.score100 / 10) * 10) / 10)),
      note,
    });
  }
  return rows;
}

function toTitleCase(str: string): string {
  return str
    .toLowerCase()
    .split(/[\s-]+/)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

export async function generateCompatibilityScores(params: {
  person1Name: string;
  person2Name: string;
  readingText: string;
  chartData: string;
  label: string;
  isVerdict?: boolean;
}): Promise<CompatibilityScore[]> {
  const { person1Name, person2Name, readingText, chartData, label, isVerdict = false } = params;
  const categories = isVerdict ? VERDICT_CATEGORIES : OVERLAY_CATEGORIES;

  const prompt = buildScoringPrompt({
    person1Name,
    person2Name,
    readingText,
    chartData,
    categories,
    isVerdict,
  });

  console.log(`🎯 Generating compatibility scores for ${label} (${categories.length} categories)...`);

  const raw = await llmPaid.generateStreaming(prompt, `${label}:scoring`, {
    provider: 'claude',
    maxTokens: 4096,
    temperature: 0.3,
    maxRetries: 5,
  });

  const scores = parseScores(String(raw || ''));

  if (scores.length < 3) {
    console.warn(`⚠️ Scoring call returned only ${scores.length} scores for ${label}. Expected ${categories.length}.`);
  } else {
    console.log(`✅ Parsed ${scores.length} compatibility scores for ${label}`);
  }

  return scores;
}
