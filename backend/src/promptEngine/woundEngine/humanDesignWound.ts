/**
 * HUMAN DESIGN WOUND ENGINE
 *
 * Two-call architecture for individual Human Design readings.
 *
 * 1. stripHDChartData()      — pure code, ~30 highest-signal lines
 * 2. buildHDWoundPrompt()    — wound call → 80-120 word paragraph
 * 3. buildHDWritingPrompt()  — writing call → 3,500 words
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

// ─── 2. WOUND PROMPT ─────────────────────────────────────────────────────────

export function buildHDWoundPrompt(params: {
  personName: string;
  strippedChartData: string;
}): string {
  const { personName, strippedChartData } = params;

  return [
    `You are reading ${personName}'s Human Design chart to find the central wound.`,
    '',
    'In Human Design, the wound lives in the open (undefined) centers.',
    'Open centers are where this person absorbs and amplifies others\' energy.',
    'They become an expert at what they cannot embody.',
    'They perform the thing they most need to receive.',
    '',
    'The Profile is the costume the wound wears in public.',
    'The Type and Authority reveal the specific way they override their own knowing.',
    'The Incarnation Cross is the pressure the wound organizes itself around.',
    '',
    'The wound is not an open center. It is not a profile number.',
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
    'Name the wound. Stop.',
    '',
    'CHART DATA:',
    strippedChartData,
    '',
    'Write the wound paragraph now:',
  ].join('\n');
}

// ─── 3. WRITING PROMPT ───────────────────────────────────────────────────────

export function buildHDWritingPrompt(params: {
  personName: string;
  wound: string;
  strippedChartData: string;
}): string {
  const { personName, wound, strippedChartData } = params;

  return [
    'You are a novelist who understands how people become someone else\'s story.',
    'You think in bodies, in waiting, in the slow damage of performing the wrong role.',
    'You have read Virginia Woolf, Clarice Lispector, and Franz Kafka.',
    'You are telling the story of a body learning to trust itself. Not writing an HD report.',
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
    '- The body is the center of this story. What it feels. What it absorbs. What it performs.',
    '- The undefined centers are not deficits — they are the site of the wound.',
    '',
    'METAPHOR WORLD:',
    '- Find the image this specific chart demands. Frequency, signal, static, noise.',
    '- Or: pressure, threshold, overflow. Or: waiting room, doorway, the held breath.',
    '- Do not decorate. Every image must carry structural weight.',
    '',
    'STRUCTURE:',
    '- 4 to 6 sections. Invent a title for each. Specific, strange, earned.',
    '- Section titles must be standalone plain-text lines. No numbering, no Roman numerals, no dashes, no markdown.',
    '- The Incarnation Cross is the life theme — enter it at least once, indirectly.',
    '- The ending does not resolve. It names where the conditioning is still running.',
    '',
    'ANTI-SURVEY:',
    '- Do not explain Human Design. Serve the wound.',
    '- Do not name centers, channels, or gates technically.',
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
