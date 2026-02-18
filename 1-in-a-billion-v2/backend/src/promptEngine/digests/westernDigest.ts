export type WesternDigestValidation = {
  ok: boolean;
  evidenceLines: string[];
  reason?: string;
};

const DIGEST_HEADER = 'WESTERN_CHART_DIGEST_V3';

export function compactWesternChartDataForDigest(chartData: string): string {
  const text = String(chartData || '').trim();
  if (!text) return text;

  const lines = text.split('\n');
  const currentTransitsIdx = lines.findIndex((l) => /^CURRENT TRANSITS\b/.test(l.trim()));
  const transitAspectsIdx = lines.findIndex((l) => /^TRANSIT ASPECTS TO NATAL\b/.test(l.trim()));

  // If we can't find the markers, leave as-is.
  if (currentTransitsIdx === -1 || transitAspectsIdx === -1 || transitAspectsIdx <= currentTransitsIdx) {
    return text;
  }

  const head = lines.slice(0, currentTransitsIdx + 1);
  const tail = lines.slice(transitAspectsIdx);

  return [
    ...head,
    '- (transit planet list omitted for digest; use transit aspects below)',
    '',
    ...tail,
  ].join('\n');
}

export function buildWesternChartDigestPrompt(params: {
  personName: string;
  chartData: string;
}): string {
  const { personName, chartData } = params;

  return [
    DIGEST_HEADER,
    '',
    `You are creating a compact "Western Chart Digest" for ${personName}.`,
    'Purpose: this digest will be fed into a second-pass writing prompt (Jung x Lynch long-form essay).',
    'Your job here is NOT to write the final literary reading. Your job is to reduce cognitive load by selecting evidence and translating it into sceneable, psychologically-real story ingredients.',
    '',
    'HARD RULES:',
    '- Do NOT invent any placements, aspects, houses, transits, profections, or events.',
    '- When you copy an evidence line, you MUST copy it EXACTLY character-for-character from CHART DATA.',
    '- Keep the digest compact (aim ~900-1400 words). Do not go below 900 words.',
    '- No markdown. No bullets other than the required dash-lines format below.',
    '- No second-person address. Use the name only.',
    '- Opening priority must follow loudest pressure signal (tightest orb / strongest current weather), not Sun-sign default framing.',
    '- WEATHER_NOTES must start with a TEMPERATURE line that states the emotional climate of current transits in one concrete sentence.',
    '- TEMPERATURE is binding for second-pass writing tone. Do not default to growth language if evidence is harsh.',
    '- Avoid lecture frames and horoscope boilerplate. Do NOT write lines like:',
    '  "The Sun represents...", "The Moon governs...", "The rising sign is...", "This aspect suggests...", "Astrologers call this..."',
    '',
    'OUTPUT FORMAT (must match exactly):',
    `${DIGEST_HEADER}`,
    'EVIDENCE_LINES:',
    '- (exact line copied from CHART DATA)',
    '- (exact line copied from CHART DATA)',
    'BIG3_SIGNATURE:',
    '<250-400 words. A one-page-feeling signature of Sun/Moon/Rising as lived pattern. Use metaphor, tension, image. Not definitions. No lecture tone.>',
    'INCARNATION_PRESSURE:',
    '<250-400 words. Destiny-pressure without fortune-telling. What this life is trying to metabolize. Ground it in evidence lines.>',
    'WEATHER_NOTES:',
    '- TEMPERATURE: <one sentence naming the emotional climate created by current transits right now (e.g. demolition, fog, pressure, release, hunger, expansion, fire).>',
    '- Now/Next12: <short, concrete psychological weather note> | Evidence: <paste ONE exact evidence line from EVIDENCE_LINES>',
    '- Now/Next12: <short, concrete psychological weather note> | Evidence: <paste ONE exact evidence line from EVIDENCE_LINES>',
    'DATING_NOTES:',
    '- Love: <pattern, trigger->defense->cost->repair> | Evidence: <exact evidence line>',
    '- Sex: <need, control/surrender, taboo truth> | Evidence: <exact evidence line>',
    '- Shadow: <precise loop, not moralizing> | Evidence: <exact evidence line>',
    '- Repair: <what actually works when it breaks> | Evidence: <exact evidence line>',
    'MOTIFS (for Lynch engine):',
    '- Motif: <a room, an object, a recurring image that can carry the reading> | Evidence: <exact evidence line>',
    '- Motif: <a red-room/curtain moment, used sparingly> | Evidence: <exact evidence line>',
    '',
    'EVIDENCE LINE SELECTION REQUIREMENTS:',
    '- Include Ascendant, Sun, Moon lines.',
    '- Include Venus and Mars lines.',
    '- Include Saturn, Neptune, and Pluto placement lines.',
    '- Include North Node and South Node lines.',
    '- Include at least 6 aspect lines from "MAJOR ASPECTS". Prefer tighter orbs.',
    '- Include the profection block lines: Profected sign, Lord of Year, Profected 5th sign, Profected 7th sign.',
    '- Include 2-4 transit aspect lines from "TRANSIT ASPECTS TO NATAL". Prefer tighter orbs.',
    '- WEATHER_NOTES TEMPERATURE must be derived from transit evidence (CURRENT TRANSITS + TRANSIT ASPECTS TO NATAL), not from generic growth defaults.',
    '- Include 1-2 house cusp lines (1 and 7 minimum).',
    '',
    'CHART DATA (authoritative):',
    chartData,
    '',
    'NOW PRODUCE THE DIGEST.',
  ].join('\n');
}

export function extractEvidenceLinesFromDigest(digest: string): string[] {
  const text = String(digest || '');
  const lines = text.split('\n');

  const start = lines.findIndex((l) => l.trim() === 'EVIDENCE_LINES:');
  if (start === -1) return [];

  // Evidence lines run until the next section header (all caps with underscores) or until SEEDS:
  const out: string[] = [];
  for (let i = start + 1; i < lines.length; i += 1) {
    const raw = lines[i] ?? '';
    const trimmed = raw.trim();
    if (!trimmed) continue;
    if (trimmed === 'SEEDS:' || trimmed.endsWith(':') && /^[A-Z0-9_]+:$/.test(trimmed)) break;
    if (trimmed.startsWith('- ')) out.push(trimmed);
  }
  return out;
}

export function validateWesternDigestAgainstChartData(params: {
  digest: string;
  chartData: string;
}): WesternDigestValidation {
  const { digest, chartData } = params;

  const headerOk = String(digest || '').trimStart().startsWith(DIGEST_HEADER);
  if (!headerOk) {
    return { ok: false, evidenceLines: [], reason: `Missing digest header "${DIGEST_HEADER}"` };
  }

  const evidenceLines = extractEvidenceLinesFromDigest(digest);
  if (evidenceLines.length < 12) {
    return { ok: false, evidenceLines, reason: `Too few evidence lines (${evidenceLines.length})` };
  }

  for (const line of evidenceLines) {
    if (!chartData.includes(line)) {
      return { ok: false, evidenceLines, reason: `Evidence line not found verbatim in CHART DATA: "${line}"` };
    }
  }

  return { ok: true, evidenceLines };
}
