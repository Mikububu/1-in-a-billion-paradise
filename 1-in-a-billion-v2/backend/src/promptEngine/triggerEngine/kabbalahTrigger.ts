import {
  CORE_FAIRYTALE_SEED,
  NARRATIVE_TRIGGER_LABEL,
  NARRATIVE_TRIGGER_TITLE,
} from './triggerConfig';
import { buildKabbalahSection } from '../../prompts/systems/kabbalah';

/**
 * KABBALAH TRIGGER ENGINE
 *
 * Two-call architecture for individual Kabbalah readings.
 *
 * 1. stripKabbalahChartData()      — pure code, ~35 highest-signal lines
 * 2. buildKabbalahTriggerPrompt()    — trigger call → 80-120 word paragraph
 * 3. buildKabbalahWritingPrompt()  — writing call → configurable word target
 */

// ─── 1. STRIP ────────────────────────────────────────────────────────────────

/**
 * Reduces Kabbalah profile to highest-signal lines.
 * Keeps: Tikkun (soul correction), Dominant strong Sefirot (top 3),
 *        Void Sefirot, Four Worlds dominant + void, Primary Shadow Axis.
 * Drops: Moderate/weak sefirot details, letter signature detail,
 *        transit weather, modality, balance lines, policy note.
 */
export function stripKabbalahChartData(raw: string): string {
  const lines = raw.split('\n');
  const out: string[] = [];

  let inTikkun = false;
  let inSefirot = false;
  let inDominantStrong = false;
  let inModerate = false;
  let inWeak = false;
  let inFourWorlds = false;
  let inLetterSig = false;
  let inKlipoth = false;
  let inTransitWeather = false;
  let inModality = false;
  let strongCount = 0;

  for (const line of lines) {
    const t = line.trim();

    if (/^TIKKUN/.test(t)) { inTikkun = true; inSefirot = false; out.push(line); continue; }
    if (/^SEFIROTIC STRUCTURE/.test(t)) { inTikkun = false; inSefirot = true; out.push(line); continue; }
    if (/^DOMINANT \(STRONG\)/.test(t)) { inDominantStrong = true; inModerate = false; inWeak = false; strongCount = 0; out.push(line); continue; }
    if (/^MODERATE:/.test(t)) { inDominantStrong = false; inModerate = true; continue; }
    if (/^WEAK\/UNDERDEVELOPED/.test(t)) { inModerate = false; inWeak = true; continue; }
    if (/^VOID\/DEFICIENT SEFIROT/.test(t)) { inWeak = false; out.push(line); continue; }
    if (/^- Pillar Balance/.test(t)) { continue; }
    if (/^FOUR WORLDS/.test(t)) { inSefirot = false; inFourWorlds = true; out.push(line); continue; }
    if (/^LETTER SIGNATURE/.test(t)) { inFourWorlds = false; inLetterSig = true; continue; }
    if (/^KLIPOTHIC RISK/.test(t)) { inLetterSig = false; inKlipoth = true; out.push(line); continue; }
    if (/^CURRENT SPIRITUAL WEATHER/.test(t)) { inKlipoth = false; inTransitWeather = true; continue; }
    if (/^MODALITY BALANCE/.test(t)) { inTransitWeather = false; inModality = true; continue; }
    if (/^POLICY:/.test(t)) { inModality = false; continue; }

    // Header — keep
    if (/KABBALAH PROFILE/.test(t)) { out.push(line); continue; }

    // Hebrew date — keep
    if (/^HEBREW BIRTH DATE/.test(t)) { out.push(line); continue; }
    if (/^- [0-9]/.test(t) && out.some(l => l.includes('HEBREW'))) { out.push(line); continue; }

    if (inTikkun) {
      if (/^- (Hebrew Month|Tikkun Name|Correction|Trap|Gift):/.test(t)) out.push(line);
      continue;
    }

    if (inSefirot) { continue; } // Section header only kept above

    if (inDominantStrong) {
      if (/^- /.test(t) && strongCount < 3) {
        const normalized = line
          .replace(/\s+via\s+[A-Z_]+\s+in\s+[A-Za-z]+\s*(?:\(House\s+\d+\))?/i, '')
          .replace(/\s+\|\s+letter=.*$/i, '');
        out.push(normalized);
        strongCount++;
      }
      continue;
    }

    if (inModerate || inWeak) { continue; }

    if (inFourWorlds) {
      // Keep dominant and void lines only
      if (/^- Dominant World:/.test(t) || /^- Void Worlds:/.test(t)) { out.push(line); }
      continue;
    }

    if (inLetterSig) { continue; }

    if (inKlipoth) {
      // Keep primary shadow axis only
      if (/^- Primary Shadow Axis:/.test(t)) { out.push(line); }
      continue;
    }

    if (inTransitWeather || inModality) { continue; }
  }

  return out.filter(Boolean).join('\n').trim();
}

// ─── 2. TRIGGER PROMPT ───────────────────────────────────────────────────────

export function buildKabbalahTriggerPrompt(params: {
  personName: string;
  strippedChartData: string;
}): string {
  const { personName, strippedChartData } = params;
  const trigger = NARRATIVE_TRIGGER_LABEL;

  return [
    `You are a Kabbalistic reader analyzing ${personName}'s Tree of Life profile to find the central ${trigger}.`,
    '',
    `In Kabbalah, the ${trigger} is rooted in the Tikkun — the soul correction, the specific homework this soul incarnated to work through.`,
    'The Tikkun\'s trap tells you what they keep falling into.',
    'The void Sephiroth (think of them as dark rooms on the Tree of Life where no light reaches) tell you where they are energetically absent.',
    'The dominant Sephiroth tell you the armor they build over the void.',
    'The Klipothic risk (the shadow shells, the broken vessels) tells you what possesses them when they are unconscious.',
    '',
    'NAME the specific Tikkun and its trap.',
    'NAME the Sephiroth involved — both dominant and void.',
    'NAME the Klipothic shadow pattern.',
    `The ${trigger} is the lived experience of being caught in the Tikkun\'s trap: the behavior they repeat, the relationship pattern they cannot break, the Sephirotic strength that covers what they cannot access.`,
    '',
    'Write one paragraph. 80-120 words exactly.',
    'Third person. Use Kabbalistic terminology and explain each term naturally on first use — like a patient grandfather explaining something sacred.',
    'No repair instructions. No correction or elevation as consolation. No softening.',
    'Specific enough that no other profile produces this exact sentence.',
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

export function buildKabbalahWritingPrompt(params: {
  personName: string;
  narrativeTrigger: string;
  strippedChartData: string;
  targetWords: number;
}): string {
  const { personName, narrativeTrigger, strippedChartData, targetWords } = params;
  const trigger = NARRATIVE_TRIGGER_LABEL;
  const triggerTitle = NARRATIVE_TRIGGER_TITLE;

  // Inject the Kabbalah system guidance — Sephiroth, Tikkun, Klipoth, Four Worlds, accessibility
  const kabbalahGuidance = buildKabbalahSection(false);

  return [
    'You are a Kabbalistic reader and literary novelist.',
    'You think in light and vessel, concealment and revelation, the teacher who is also the trap.',
    'You have read Isaac Bashevis Singer, Nikos Kazantzakis, Paul Celan, and the Zohar.',
    CORE_FAIRYTALE_SEED,
    '',
    'You are telling the story of a soul\'s correction — through the lens of the Tree of Life.',
    'This is NOT a generic spiritual essay. It is a Kabbalistic reading: grounded in specific Sephiroth, Tikkun patterns, Klipothic shadows, and the Four Worlds.',
    '',
    kabbalahGuidance,
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
    '- The Tikkun (soul correction) is not a goal — it is the specific friction of this life.',
    '- The void Sephiroth mark what is missing; dominant Sephiroth show the compensating pattern.',
    '- Name specific Sephiroth (e.g., "Gevurah — severity, the left arm of the Tree") and their qualities.',
    '- Name the Klipothic shadows — the broken vessels, the dark side of each emphasized Sephirah.',
    '- Explain Kabbalistic terms naturally on first use — like a patient grandfather explaining something sacred.',
    '',
    'STRUCTURE:',
    '- One continuous essay. NO section titles, NO chapter headings, NO standalone headline lines.',
    '- The Tikkun trap is the opening. The void Sephiroth are the middle. The correction pressure is the end.',
    '- Touch on the Four Worlds (Atziluth, Beriah, Yetzirah, Assiyah) — where is this soul balanced, where weak?',
    '- The ending does not resolve. It names the correction still in progress.',
    '',
    'KABBALISTIC VOICE:',
    '- USE Kabbalistic terminology throughout: Sephiroth, Tikkun, Klipoth, Gilgul, the Four Worlds, the 22 Paths.',
    '- NEVER use Western astrology terms — this is pure Kabbalah.',
    '- Reference specific Sephiroth and their qualities from the chart data — these are the evidence.',
    '- Every paragraph must add new consequence or evidence rooted in their specific Tree of Life mapping.',
    '- Do not be generic. Ground every insight in a specific Sephirah, Klipothic pattern, or World imbalance.',
    '',
    `LENGTH: ${targetWords.toLocaleString('en-US')} words. Write until the ${trigger} is fully present. Then stop.`,
    'Do not pad. Do not repeat. Do not add a hopeful ending.',
    '',
    'CHART DATA (authoritative — do not invent or contradict):',
    strippedChartData,
    '',
    `Write ${personName}'s Kabbalistic reading now:`,
  ].join('\n');
}
