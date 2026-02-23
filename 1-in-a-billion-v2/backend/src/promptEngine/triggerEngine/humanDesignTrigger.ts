import {
  CORE_FAIRYTALE_SEED,
  NARRATIVE_TRIGGER_LABEL,
  NARRATIVE_TRIGGER_TITLE,
} from './triggerConfig';

/**
 * HUMAN DESIGN TRIGGER ENGINE
 *
 * Two-call architecture for individual Human Design readings.
 *
 * 1. stripHDChartData()      — pure code, ~30 highest-signal lines
 * 2. buildHDTriggerPrompt()    — trigger call → 80-120 word paragraph
 * 3. buildHDWritingPrompt()  — writing call → configurable word target
 */

// ─── 1. STRIP ────────────────────────────────────────────────────────────────

/**
 * Reduces HD chart data to highest-signal lines.
 * Keeps: Type, Strategy, Authority, Profile, Definition, Incarnation Cross,
 *        Defined Centers, Open Centers, Active Channels.
 * Drops: All gate activations (personality/design lines), full active gates list.
 */
export function stripHDChartData(raw: string): string {
  const lines = raw.split('\n');
  const out: string[] = [];

  let inPersonality = false;
  let inDesign = false;
  let inGates = false;

  for (const line of lines) {
    const t = line.trim();

    if (/^ALL ACTIVE GATES:/.test(t)) { inGates = true; continue; }
    if (/^PERSONALITY ACTIVATIONS/.test(t)) { inPersonality = true; inDesign = false; inGates = false; out.push(line); continue; }
    if (/^DESIGN ACTIVATIONS/.test(t)) { inDesign = true; inPersonality = false; inGates = false; out.push(line); continue; }

    if (inGates) { continue; }

    // In personality/design sections: keep only top 3 activations (most important planets)
    const KEEP_PLANETS = new Set(['sun', 'earth', 'moon']);
    if (inPersonality || inDesign) {
      if (/^- /.test(t)) {
        const lc = t.toLowerCase();
        if ([...KEEP_PLANETS].some(p => lc.includes(p))) {
          out.push(line);
        }
      } else if (t === '') {
        out.push(line);
      } else if (/^[A-Z][A-Z0-9\s()\-—]+:$/.test(t)) {
        // Leave activation mode only when the next section actually starts.
        inPersonality = false;
        inDesign = false;
        out.push(line);
      }
      continue;
    }

    out.push(line);
  }

  return out.filter(Boolean).join('\n').trim();
}

// ─── 2. TRIGGER PROMPT ───────────────────────────────────────────────────────

export function buildHDTriggerPrompt(params: {
  personName: string;
  strippedChartData: string;
}): string {
  const { personName, strippedChartData } = params;
  const trigger = NARRATIVE_TRIGGER_LABEL;

  return [
    `You are reading ${personName}'s Human Design chart to find the central ${trigger}.`,
    '',
    `In Human Design, the ${trigger} lives in the open (undefined) centers.`,
    'Open centers are where this person absorbs and amplifies others\' energy.',
    'They become an expert at what they cannot embody.',
    'They perform the thing they most need to receive.',
    '',
    `The Profile is the costume the ${trigger} wears in public.`,
    'The Type and Authority reveal the specific way they override their own knowing.',
    `The Incarnation Cross is the pressure the ${trigger} organizes itself around.`,
    '',
    `The ${trigger} is not an open center. It is not a profile number.`,
    'It is the specific behavior pattern that emerges from the collision of',
    'what this person absorbs (open centers) and how they try to be loved (profile).',
    '',
    'Write one paragraph. 80-120 words exactly.',
    'Third person. No jargon. No HD vocabulary. No repair instructions. No softening.',
    'Specific enough that no other chart produces this exact sentence.',
    'It must cost something to read.',
    '',
    'Do not describe the system. Do not list centers or channels.',
    'Do not offer hope or growth language.',
    `Name the ${trigger}. Stop.`,
    '',
    'CHART DATA:',
    strippedChartData,
    '',
    `Write the ${trigger} paragraph now:`,
  ].join('\n');
}

// ─── 3. WRITING PROMPT ───────────────────────────────────────────────────────

export function buildHDWritingPrompt(params: {
  personName: string;
  narrativeTrigger: string;
  strippedChartData: string;
  targetWords: number;
}): string {
  const { personName, narrativeTrigger, strippedChartData, targetWords } = params;
  const trigger = NARRATIVE_TRIGGER_LABEL;
  const triggerTitle = NARRATIVE_TRIGGER_TITLE;

  return [
    'You are a novelist who understands how people become someone else\'s story.',
    CORE_FAIRYTALE_SEED,
    'You think in bodies, in waiting, in the slow damage of performing the wrong role.',
    'You have read Virginia Woolf, Clarice Lispector, and Franz Kafka.',
    'You are telling the story of a body learning to trust itself. Not writing an HD report.',
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
    '- The body is the center of this story. What it feels. What it absorbs. What it performs.',
    `- The undefined centers are not deficits — they are the site of the ${trigger}.`,
    '',
    'STRUCTURE:',
    '- One continuous essay. NO section titles, NO chapter headings, NO standalone headline lines.',
    '- The Incarnation Cross is the life theme — enter it at least once, indirectly.',
    '- The ending does not resolve. It names where the conditioning is still running.',
    '',
    'ANTI-SURVEY:',
    `- Do not explain Human Design. Serve the ${trigger}.`,
    '- Do not name centers, channels, or gates technically.',
    '- Explain Human Design terms in plain language the first time they appear.',
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
