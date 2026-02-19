/**
 * KABBALAH WOUND ENGINE
 *
 * Two-call architecture for individual Kabbalah readings.
 *
 * 1. stripKabbalahChartData()      — pure code, ~35 highest-signal lines
 * 2. buildKabbalahWoundPrompt()    — wound call → 80-120 word paragraph
 * 3. buildKabbalahWritingPrompt()  — writing call → 3,500 words
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

// ─── 2. WOUND PROMPT ─────────────────────────────────────────────────────────

export function buildKabbalahWoundPrompt(params: {
  personName: string;
  strippedChartData: string;
}): string {
  const { personName, strippedChartData } = params;

  return [
    `You are reading ${personName}'s Kabbalah profile to find the central wound.`,
    '',
    'In Kabbalah, the wound is the Tikkun — the soul correction this person incarnated to work through.',
    'The Tikkun\'s trap tells you what they keep falling into.',
    'The void Sefirot tell you where they are energetically absent.',
    'The dominant Sefirot tell you the armor they build over the void.',
    'The Primary Shadow Axis tells you the specific polarity they are caught between.',
    '',
    'The wound is not a Sefirah name. It is not a soul correction label.',
    'It is the specific lived experience of being caught in the trap:',
    'the behavior they repeat, the relationship pattern they cannot break,',
    'the strength that covers what they cannot access.',
    '',
    'Write one paragraph. 80-120 words exactly.',
    'Third person. No jargon. No Kabbalah vocabulary. No repair instructions. No softening.',
    'Specific enough that no other profile produces this exact sentence.',
    'It must cost something to read.',
    '',
    'Do not describe the system. Do not name Sefirot or Hebrew terms.',
    'Do not offer correction or elevation as consolation.',
    'Name the wound. Stop.',
    '',
    'CHART DATA:',
    strippedChartData,
    '',
    'Write the wound paragraph now:',
  ].join('\n');
}

// ─── 3. WRITING PROMPT ───────────────────────────────────────────────────────

export function buildKabbalahWritingPrompt(params: {
  personName: string;
  wound: string;
  strippedChartData: string;
}): string {
  const { personName, wound, strippedChartData } = params;

  return [
    'You are a novelist who understands that the soul comes into life with unfinished business.',
    'You think in light and vessel, concealment and revelation, the teacher who is also the trap.',
    'You have read Isaac Bashevis Singer, Nikos Kazantzakis, and Paul Celan.',
    'You are telling the story of a soul\'s correction. Not writing a Kabbalah report.',
    '',
    '══════════════════════════════════════════════════════════',
    'THE WOUND — THIS IS THE SPINE OF EVERYTHING YOU WRITE:',
    wound,
    'Every paragraph must connect to this wound or deepen it.',
    'If a paragraph does not serve the wound, it does not belong here.',
    '══════════════════════════════════════════════════════════',
    '',
    'NARRATOR:',
    '- Third person only. Never "you" or "your". Use the name.',
    '- The soul correction is not a goal — it is the specific friction of this life.',
    '- The void Sefirot are the absent rooms. The dominant ones are the rooms they never leave.',
    '',
    'METAPHOR WORLD:',
    '- Find the image this specific profile demands. Light in vessels, water finding its level.',
    '- Or: the teacher who repeats the lesson until the student breaks. The door left unlocked.',
    '- Do not decorate. Every image must carry structural weight.',
    '',
    'STRUCTURE:',
    '- 4 to 6 sections. Invent a title for each. Specific, ancient, earned.',
    '- Section titles must be standalone plain-text lines. No numbering, no Roman numerals, no dashes, no markdown.',
    '- The Tikkun trap is the opening. The void is the middle. The correction is the pressure at the end.',
    '- The ending does not resolve. It names the correction still in progress.',
    '',
    'ANTI-SURVEY:',
    '- Do not explain Kabbalah. Serve the wound.',
    '- Do not name Sefirot, worlds, or Hebrew concepts technically.',
    '- Every paragraph must add new consequence or evidence.',
    '',
    'LENGTH: 3,500 words. Write until the wound is fully present. Then stop.',
    'Do not pad. Do not repeat. Do not add a hopeful ending.',
    '',
    'CHART DATA (authoritative — do not invent or contradict):',
    strippedChartData,
    '',
    `Write ${personName}'s reading now:`,
  ].join('\n');
}
