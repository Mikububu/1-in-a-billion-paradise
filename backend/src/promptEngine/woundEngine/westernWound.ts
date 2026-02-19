/**
 * WESTERN WOUND ENGINE
 *
 * Two-call architecture for individual Western readings.
 *
 * 1. stripWesternChartData()  — pure code, no LLM, ~40 lines out
 * 2. buildWesternWoundPrompt() — 20-line wound call → 80-120 word wound paragraph
 * 3. buildWesternWritingPrompt() — 60-line writing call → 3,500 word reading
 *
 * No digest. No expansion passes. No compliance rewrites.
 */

// ─── 1. STRIP ────────────────────────────────────────────────────────────────

/**
 * Reduces raw Western chart data from ~150 lines to ~40 highest-signal lines.
 * Keeps: Big 3, personal planets, Saturn, Pluto, Nodes, angular cusps,
 *        tight aspects (orb ≤ 3°), profection block, top 6 transit aspects.
 * Drops: Uranus, Neptune, Jupiter (unless tight aspect), all 12 house cusps,
 *        transit planet list.
 */
export function stripWesternChartData(raw: string): string {
  const lines = raw.split('\n');
  const out: string[] = [];

  // State tracking
  let inPlanets = false;
  let inCusps = false;
  let inAspects = false;
  let inTransitPlanets = false;
  let inTransitAspects = false;
  let inProfection = false;
  let transitAspectCount = 0;

  // Planets to keep for individual readings
  const KEEP_PLANETS = new Set(['SUN', 'MOON', 'MERCURY', 'VENUS', 'MARS', 'SATURN', 'PLUTO']);
  // Angular houses to keep
  const ANGULAR_CUSPS = new Set(['- 1:', '- 4:', '- 7:', '- 10:']);

  for (const line of lines) {
    const t = line.trim();

    // Section headers
    if (/^PLANETS \(tropical\):/.test(t)) { inPlanets = true; inCusps = false; inAspects = false; inTransitPlanets = false; inTransitAspects = false; inProfection = false; out.push(line); continue; }
    if (/^NODES \(mean\):/.test(t)) { inPlanets = false; out.push(line); continue; }
    if (/^HOUSE CUSPS/.test(t)) { inPlanets = false; inCusps = true; out.push('HOUSE CUSPS (angular only):'); continue; }
    if (/^MAJOR ASPECTS/.test(t)) { inCusps = false; inAspects = true; out.push('MAJOR ASPECTS (orb ≤ 3°):'); continue; }
    if (/^ANNUAL PROFECTION/.test(t)) { inAspects = false; inProfection = true; out.push(line); continue; }
    if (/^CURRENT TRANSITS/.test(t)) { inProfection = false; inTransitPlanets = true; continue; } // drop header + planet list
    if (/^TRANSIT ASPECTS TO NATAL/.test(t)) { inTransitPlanets = false; inTransitAspects = true; transitAspectCount = 0; out.push('TRANSIT ASPECTS TO NATAL (top 6, tightest orb):'); continue; }

    // Ascendant, MC, Sect — always keep
    if (/^- (Ascendant|MC|Sect):/.test(t)) { out.push(line); continue; }

    // Planets — keep only selected
    if (inPlanets) {
      const match = t.match(/^- ([A-Z]+):/);
      if (match && KEEP_PLANETS.has(match[1])) { out.push(line); }
      continue;
    }

    // Nodes — keep both
    if (/^- (North|South) Node:/.test(t)) { out.push(line); continue; }

    // House cusps — keep only angular
    if (inCusps) {
      if (ANGULAR_CUSPS.has(t.slice(0, 4))) { out.push(line); }
      continue;
    }

    // Aspects — keep only orb ≤ 3°
    if (inAspects) {
      if (!t || /^- /.test(t)) {
        const orbMatch = t.match(/orb ([\d.]+)°/);
        if (orbMatch && parseFloat(orbMatch[1]) <= 3) { out.push(line); }
      }
      continue;
    }

    // Profection — keep all
    if (inProfection) { out.push(line); continue; }

    // Transit planets — drop entirely
    if (inTransitPlanets) { continue; }

    // Transit aspects — keep top 6 by appearance (already sorted by orb in builder)
    if (inTransitAspects) {
      if (/^- /.test(t) && transitAspectCount < 6) {
        out.push(line);
        transitAspectCount++;
      }
      continue;
    }

    // Header line (name + WESTERN CHART)
    if (/WESTERN \(TROPICAL\) CHART/.test(t)) { out.push(line); continue; }
  }

  return out.filter(Boolean).join('\n').trim();
}

// ─── 2. WOUND PROMPT ─────────────────────────────────────────────────────────

/**
 * 20-line wound call.
 * Output: one paragraph, 80-120 words, naming the central wound.
 * Not themes. Not placements described. The specific thing.
 */
export function buildWesternWoundPrompt(params: {
  personName: string;
  strippedChartData: string;
}): string {
  const { personName, strippedChartData } = params;

  return [
    `You are reading ${personName}'s Western natal chart to find the central wound.`,
    '',
    'The wound is not a placement. It is not a theme. It is the specific thing this person has been',
    'running from or toward for their entire life without being fully able to name it.',
    'The gap between who they project and what they actually need.',
    'The defense that became a personality.',
    '',
    'Write one paragraph. 80-120 words exactly.',
    'Third person. No jargon. No repair instructions. No softening.',
    'Specific enough that no other chart produces this exact sentence.',
    'It must cost something to read.',
    '',
    'Do not write about placements directly.',
    'Do not use astrology vocabulary.',
    'Do not offer hope or growth language.',
    'Name the wound. Stop.',
    '',
    'CHART DATA:',
    strippedChartData,
    '',
    'Write the wound paragraph now:',
  ].join('\n');
}

// ─── 3. WRITING PROMPT ───────────────────────────────────────────────────────

/**
 * 60-line writing call.
 * Receives wound paragraph as spine.
 * Output: 3,500 words, third person, one complete pass, no expansion.
 */
export function buildWesternWritingPrompt(params: {
  personName: string;
  wound: string;
  strippedChartData: string;
}): string {
  const { personName, wound, strippedChartData } = params;

  return [
    'You are a novelist who is slightly afraid of your subject.',
    'You think like Carl Jung directing a David Lynch film.',
    'You have read Anais Nin, Henry Miller, and Ernest Hemingway.',
    'You are telling the story of a soul. Not writing an astrology report.',
    '',
    '══════════════════════════════════════════════════════════',
    `THE WOUND — THIS IS THE SPINE OF EVERYTHING YOU WRITE:`,
    wound,
    'Every paragraph must connect to this wound or deepen it.',
    'If a paragraph does not serve the wound, it does not belong here.',
    '══════════════════════════════════════════════════════════',
    '',
    'NARRATOR:',
    '- Third person only. Never "you" or "your". Use the name.',
    '- Stay inside the experience. Do not explain it from above.',
    '- Sex and desire are part of the truth. Name them directly when the chart demands it.',
    '',
    'METAPHOR WORLD:',
    '- Find the metaphor this specific chart demands. Do not import one.',
    '- Use it consistently. It should feel inevitable when the reader reaches the end.',
    '- Do not decorate. Use images with structural purpose.',
    '',
    'STRUCTURE:',
    '- 4 to 6 sections. Invent a title for each. Specific, surreal, earned.',
    '- Section titles must be standalone plain-text lines. No numbering, no Roman numerals, no dashes, no markdown.',
    '- The sections must build. Something must change between the first and the last.',
    '- The ending does not resolve. It names the pressure and leaves it present.',
    '',
    'ANTI-SURVEY:',
    '- Do not tour the placements. Serve the wound.',
    '- Do not restate the same insight with fresh metaphors.',
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
