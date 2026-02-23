import {
  CORE_FAIRYTALE_SEED,
  NARRATIVE_TRIGGER_LABEL,
  NARRATIVE_TRIGGER_TITLE,
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
 * Keeps: Activation Sequence (all 4 spheres), Venus Sequence (first 3 only).
 * Drops: Pearl Sequence, duplicate or rarely used keys.
 */
export function stripGeneKeysChartData(raw: string): string {
  const lines = raw.split('\n');
  const out: string[] = [];

  let inActivation = false;
  let inPearl = false;
  let inVenus = false;
  let venusCount = 0;

  for (const line of lines) {
    const t = line.trim();

    if (/^PEARL SEQUENCE/.test(t)) { inPearl = true; inVenus = false; inActivation = false; continue; }
    if (/^VENUS SEQUENCE/.test(t)) { inVenus = true; inPearl = false; inActivation = false; out.push(line); continue; }
    if (/^ACTIVATION SEQUENCE/.test(t)) { inActivation = true; inVenus = false; inPearl = false; out.push(line); continue; }

    if (inPearl) { continue; }

    if (inActivation) {
      out.push(line);
      continue;
    }

    if (inVenus) {
      if (/^- /.test(t)) {
        if (venusCount < 3) {
          out.push(line);
          venusCount++;
        }
      } else {
        out.push(line);
      }
      continue;
    }

    out.push(line);
  }

  return out.filter(Boolean).join('\n').trim();
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
    'Write one paragraph. 80-120 words exactly.',
    'Third person. No jargon. No Gene Keys vocabulary. No repair instructions. No softening.',
    'Specific enough that no other profile produces this exact sentence.',
    'It must cost something to read.',
    '',
    'Do not describe the system. Do not list keys or spheres.',
    'Do not offer Gift or Siddhi frequencies as consolation.',
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
    'You think in codon sequences, frequency shifts, DNA memory.',
    'You have read Carlos Castaneda, Rainer Maria Rilke, and Ursula Le Guin.',
    'You are telling the story of a consciousness learning to inhabit itself. Not writing a Gene Keys report.',
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
    '',
    'STRUCTURE:',
    '- One continuous essay. NO section titles, NO chapter headings, NO standalone headline lines.',
    '- Move from shadow (the problem) toward the specific gap (what is not yet available to them).',
    '- The ending does not resolve. It leaves the frequency question open.',
    '',
    'ANTI-SURVEY:',
    `- Do not explain Gene Keys. Serve the ${trigger}.`,
    '- Do not name spheres, keys, or frequencies technically.',
    '- Explain Gene Keys terms in plain language the first time they appear.',
    '- Every paragraph must add new consequence or evidence.',
    '',
    `LENGTH: ${targetWords.toLocaleString('en-US')} words. Write until the ${trigger} is fully present. Then stop.`,
    'Do not pad. Do not repeat. Do not add a hopeful ending.',
    '',
    'CHART DATA (authoritative — do not invent or contradict):',
    strippedChartData,
    '',
    `Write ${personName}'s reading now:`,
  ].join('\n');
}
