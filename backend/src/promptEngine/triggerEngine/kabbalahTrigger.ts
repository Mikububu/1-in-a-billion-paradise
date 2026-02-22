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

    if (inTikkun) { out.push(line); continue; }

    if (inSefirot) { continue; } // Section header only kept above

    if (inDominantStrong) {
      if (/^- /.test(t) && strongCount < 3) { out.push(line); strongCount++; }
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

    out.push(line);
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
    `You are reading ${personName}'s Kabbalah profile to find the central ${trigger}.`,
    '',
    `In Kabbalah, the ${trigger} is the Tikkun — the soul correction this person incarnated to work through.`,
    'The Tikkun\'s trap tells you what they keep falling into.',
    'The void Sefirot tell you where they are energetically absent.',
    'The dominant Sefirot tell you the armor they build over the void.',
    'The Primary Shadow Axis tells you the specific polarity they are caught between.',
    '',
    `The ${trigger} is not a Sefirah name. It is not a soul correction label.`,
    'It is the specific lived experience of being caught in the trap:',
    'the behavior they repeat, the relationship pattern they cannot break,',
    'the strength that covers what they cannot access.',
    '',
    TRIGGER_WORD_RULE,
    'Third person. Use selective Kabbalah language (Tikkun, Sefirot, Klipot) only when needed, and explain each term in plain words immediately.',
    'No repair instructions. Avoid generic reassurance.',
    'Specific enough that no other profile produces this exact sentence.',
    'It must cost something to read.',
    '',
    'Do not describe the system as a manual. Do not stack Sefirot/Hebrew terms without explanation.',
    'Do not offer correction or elevation as consolation.',
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

  return [
    'You are a novelist who understands that the soul comes into life with unfinished business.',
    CORE_FAIRYTALE_SEED,
    WRITING_CLARITY_RULE,
    'You think in light and vessel, concealment and revelation, the teacher who is also the trap.',
    'You have read Isaac Bashevis Singer, Nikos Kazantzakis, and Paul Celan.',
    'You are telling the story of a soul\'s correction. Not writing a Kabbalah report.',
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
    '- The soul correction is not a goal — it is the specific friction of this life.',
    '- The void Sefirot mark what is missing; dominant Sefirot show the compensating pattern.',
    `- ${WRITING_NON_FABRICATION_RULE}`,
    `- ${WRITING_REALISM_RULE}`,
    '',
    'SHADOW & DEPTH:',
    `- ${WRITING_shadow_RULE}`,
    '- The Klipot are not abstract evil. They are the shell this person built to survive.',
    '- Do not moralize. Do not offer repair instructions. Just name what is true.',
    '',
    'STRUCTURE:',
    '- One continuous layered essay in paragraphs. No section titles or standalone headline lines.',
    '- The Tikkun trap is the opening. The void is the middle. The correction is the pressure at the end.',
    '- The ending does not resolve. It names the correction still in progress.',
    `- ${WRITING_CONTRAST_RULE}`,
    '',
    'ANTI-SURVEY:',
    `- Do not explain Kabbalah. Serve the ${trigger}.`,
    '- Do not dump Sefirot/worlds/Hebrew concepts as technical lists without explanation.',
    '- Do not invent scenes ("one night", "at dinner", "on Tuesday") unless explicitly provided in user context.',
    '- Explain Kabbalah terms in plain language the first time they appear.',
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
