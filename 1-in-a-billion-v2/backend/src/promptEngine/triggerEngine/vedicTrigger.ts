import {
  CORE_FAIRYTALE_SEED,
  NARRATIVE_TRIGGER_LABEL,
  NARRATIVE_TRIGGER_TITLE,
} from './triggerConfig';

/**
 * VEDIC TRIGGER ENGINE
 *
 * Two-call architecture for individual Vedic readings.
 *
 * 1. stripVedicChartData()   — pure code, ~35 highest-signal lines
 * 2. buildVedicTriggerPrompt() — trigger call → 80-120 word paragraph
 * 3. buildVedicWritingPrompt() — writing call → configurable word target
 */

// ─── 1. STRIP ────────────────────────────────────────────────────────────────

/**
 * Reduces full Vedic chart output to ~35 highest-signal lines.
 * Keeps: Lagna, Lagna Lord, Chandra rashi + nakshatra, personal grahas (Sun/Moon/Mars/Saturn/Rahu/Ketu),
 *        current Mahadasha + Antardasha, Navamsha Lagna.
 * Drops: Full graha list (Jupiter/Venus/Mercury unless in key houses), full dasha sequence,
 *        detailed bhava occupancy, pressurized bhavas, 7th bhava detail, empty angulars.
 */
export function stripVedicChartData(raw: string): string {
  const lines = raw.split('\n');
  const out: string[] = [];

  const GRAHA_KEYWORDS = ['surya', 'chandra', 'mangal', 'shani', 'rahu', 'ketu'];

  let inGrahas = false;
  let inBhava = false;
  let inPressurized = false;
  let inEmpty = false;
  let in7th = false;
  let inDasha = false;
  let inFullSequence = false;
  let inNavamsha = false;

  for (const line of lines) {
    const t = line.trim();

    // Section routing
    if (/^GRAHA POSITIONS:/.test(t)) { inGrahas = true; inBhava = false; out.push(line); continue; }
    if (/^BHAVA OCCUPANCY/.test(t)) { inGrahas = false; inBhava = true; continue; }
    if (/^PRESSURIZED BHAVAS/.test(t)) { inBhava = false; inPressurized = true; continue; }
    if (/^EMPTY ANGULAR BHAVAS/.test(t)) { inPressurized = false; inEmpty = true; continue; }
    if (/^7TH BHAVA/.test(t)) { inEmpty = false; in7th = true; continue; }
    if (/^VIMSHOTTARI DASHA/.test(t)) { in7th = false; inDasha = true; out.push(line); continue; }
    if (/^FULL DASHA SEQUENCE/.test(t)) { inFullSequence = true; continue; }
    if (/^NAVAMSHA/.test(t)) { inDasha = false; inFullSequence = false; inNavamsha = true; out.push(line); continue; }

    // Header lines — keep
    if (/^[A-Z\s]+VEDIC CHART/.test(t)) { out.push(line); continue; }
    if (/^- (Birth|Place|Current Age|Ayanamsa):/.test(t)) { out.push(line); continue; }

    // Lagna block — keep all
    if (/^LAGNA:/.test(t)) { out.push(line); continue; }
    if (/^- Lagna/.test(t)) { out.push(line); continue; }

    // Chandra block — keep all
    if (/^CHANDRA:/.test(t)) { out.push(line); continue; }
    if (/^- Chandra Rashi:/.test(t) || /^- Janma Nakshatra:/.test(t)) { out.push(line); continue; }

    // Graha lines — keep only selected grahas
    if (inGrahas) {
      if (/^- /.test(t)) {
        const lc = t.toLowerCase();
        if (GRAHA_KEYWORDS.some((g) => lc.includes(g))) {
          out.push(line);
        }
      }
      continue;
    }

    // Bhava, pressurized, empty, 7th — drop entirely
    if (inBhava || inPressurized || inEmpty || in7th) { continue; }

    // Dasha — keep current Maha + Antardasha only
    if (inDasha && !inFullSequence) {
      if (/^- Current (Mahadasha|Antardasha):/.test(t)) { out.push(line); }
      continue;
    }

    // Full sequence — drop
    if (inFullSequence) { continue; }

    // Navamsha — keep Lagna + Sun/Moon/Mars/Saturn/Rahu/Ketu lines
    if (inNavamsha) {
      if (/^- Navamsha Lagna:/.test(t)) { out.push(line); continue; }
      if (/^- (Surya|Chandra|Mangal|Shani|Rahu|Ketu)/.test(t)) { out.push(line); continue; }
      if (/^NAVAMSHA/.test(t)) { out.push(line); continue; }
      continue;
    }
  }

  return out.filter(Boolean).join('\n').trim();
}

// ─── 2. TRIGGER PROMPT ───────────────────────────────────────────────────────

export function buildVedicTriggerPrompt(params: {
  personName: string;
  strippedChartData: string;
}): string {
  const { personName, strippedChartData } = params;
  const trigger = NARRATIVE_TRIGGER_LABEL;

  return [
    `You are reading ${personName}'s Vedic natal chart to find the central ${trigger}.`,
    '',
    `In Jyotish, the ${trigger} lives where Rahu pulls obsessively, where Saturn crushes,`,
    'where the Mahadasha lord is currently pressing hardest against the Lagna.',
    'The Nakshatra of the Moon tells you the emotional texture of the suffering.',
    '',
    `The ${trigger} is not a placement. It is not a theme.`,
    'It is the specific thing this person cannot stop repeating or fleeing from.',
    'The gap between who they believe themselves to be (Lagna) and what they actually crave (Rahu).',
    'The discipline they cannot sustain (Saturn) and the feeling it produces (Chandra).',
    '',
    'Write one paragraph. 80-120 words exactly.',
    'Third person. Use Jyotish/Sanskrit terms only when needed and explain first use in plain language. No repair instructions. No softening.',
    'Specific enough that no other chart produces this exact sentence.',
    'It must cost something to read.',
    '',
    'Do not write as a dry placement report.',
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

export function buildVedicWritingPrompt(params: {
  personName: string;
  narrativeTrigger: string;
  strippedChartData: string;
  targetWords: number;
}): string {
  const { personName, narrativeTrigger, strippedChartData, targetWords } = params;
  const trigger = NARRATIVE_TRIGGER_LABEL;
  const triggerTitle = NARRATIVE_TRIGGER_TITLE;

  return [
    'You are a novelist with deep knowledge of Indian classical storytelling.',
    CORE_FAIRYTALE_SEED,
    'You think in cycles, karma, and mythic repetition.',
    'You have read Hermann Hesse, Dostoevsky, and the Mahabharata.',
    'You are telling the story of a soul across time. Not writing an astrology report.',
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
    '- Stay inside the experience. Do not explain it from above.',
    `- The Dasha period is the current chapter of the ${trigger}, not a forecast.`,
    '',
    'STRUCTURE:',
    '- One continuous essay. NO section titles, NO chapter headings, NO standalone headline lines.',
    '- The prose must build. The Dasha period is the present tense pressure.',
    `- The ending does not resolve. It names where the ${trigger} is pressing now.`,
    '',
    'ANTI-SURVEY:',
    `- Do not tour the grahas. Serve the ${trigger}.`,
    '- Avoid dense report-style placement syntax.',
    '- Explain Sanskrit/Jyotish terms in plain language the first time they appear.',
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
