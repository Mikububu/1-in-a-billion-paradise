import {
  CORE_FAIRYTALE_SEED,
  NARRATIVE_TRIGGER_LABEL,
  NARRATIVE_TRIGGER_TITLE,
} from './triggerConfig';
import { buildVedicSection } from '../../prompts/systems/vedic';

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
    `You are a Jyotish reader analyzing ${personName}'s Vedic natal chart through the left-handed Vamachara perspective to find the central ${trigger}.`,
    '',
    `In Jyotish, the ${trigger} lives where Rahu — the hungry, headless demon — pulls obsessively, where Shani (Saturn) crushes,`,
    'where the Mahadasha lord is currently pressing hardest against the Lagna (the soul portal, the cosmic doorway of the first breath).',
    'The Janma Nakshatra (Moon\'s lunar mansion) tells you the emotional texture of the suffering.',
    '',
    'NAME the specific Grahas involved using Vedic names (Rahu, Shani, Mangal, etc.).',
    'NAME the Nakshatra and its ruling deity.',
    'NAME the Rashi and Bhava positions that form this pattern.',
    `The ${trigger} is the lived behavior pattern these placements produce — the gap between Lagna and Rahu, the discipline Shani demands that they cannot sustain.`,
    '',
    'Write one paragraph. 80-120 words exactly.',
    'Third person. Use Vedic/Jyotish terminology and explain each term naturally on first use like a grandfather telling a fairy tale to a child.',
    'Deliver with fatalistic irony — dark truths with a knowing smile.',
    'No repair instructions. No softening.',
    'Specific enough that no other chart produces this exact sentence.',
    'It must cost something to read.',
    '',
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

  // Inject the Vedic system guidance with its Rahu-first perspective, fairy-tale explanations, and fatalistic humor
  const vedicGuidance = buildVedicSection(false, 7);

  return [
    'You are a Jyotish reader and literary novelist steeped in the left-handed Vamachara tradition.',
    'You think in cycles, karma, mythic repetition, and Rahu\'s hunger.',
    'You have read Hermann Hesse, Dostoevsky, and the Mahabharata.',
    CORE_FAIRYTALE_SEED,
    '',
    'You are telling the story of a soul across time — through the lens of their Vedic chart.',
    'This is NOT a generic spiritual essay. It is a Jyotish reading: grounded in specific Grahas, Nakshatras, Bhavas, and Dasha periods.',
    'Deliver it with fatalistic irony — the cosmos has written the story, and it\'s often brutal, but there\'s something absurdly funny about that too.',
    '',
    vedicGuidance,
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
    '- Use ONLY Vedic names for Grahas: Surya, Chandra, Mangal, Budha, Guru, Shukra, Shani, Rahu, Ketu. NEVER Western planet names.',
    '- Name Nakshatras, their ruling deities, and what the deity WANTS from this person.',
    '- Explain every Vedic term immediately when first used — like a grandfather telling a fairy tale to a child.',
    '',
    'STRUCTURE:',
    '- One continuous essay. NO section titles, NO chapter headings, NO standalone headline lines.',
    '- Look through Rahu\'s eyes first — what is this person hungry for, obsessed with, overcompensating for?',
    '- The Dasha period is the present tense pressure. Which cosmic season is ruling their life?',
    `- The ending does not resolve. It names where the ${trigger} is pressing now — with a wink.`,
    '',
    'JYOTISH VOICE:',
    '- USE Vedic terminology throughout: Lagna, Rashi, Bhava, Graha, Nakshatra, Dasha, Dosha, Yoga.',
    '- NEVER use Western terms: no "Ascendant" (use Lagna), no "house" (use Bhava), no "Mars" (use Mangal).',
    '- Reference specific Grahas, Bhavas, and Nakshatras from the chart data — these are the evidence.',
    '- Every paragraph must add new consequence or evidence rooted in their specific placements.',
    '- Do not be generic. Ground every insight in a specific Graha, Bhava, or Nakshatra.',
    '',
    `LENGTH: ${targetWords.toLocaleString('en-US')} words. Write until the ${trigger} is fully present. Then stop.`,
    'Do not pad. Do not repeat. Do not add a hopeful ending.',
    '',
    'CHART DATA (authoritative — do not invent or contradict):',
    strippedChartData,
    '',
    `Write ${personName}'s Jyotish reading now:`,
  ].join('\n');
}
