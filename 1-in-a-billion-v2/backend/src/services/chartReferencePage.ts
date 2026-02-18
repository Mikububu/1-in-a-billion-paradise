export type BirthReference = {
  birthDate?: string;
  birthTime?: string;
  birthPlace?: string;
};

type ParsedAspect = {
  line: string;
  orb?: number;
};

function formatBirthDate(raw?: string): string {
  const value = String(raw || '').trim();
  const m = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return value;
  const d = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' });
}

function normalizeSpacing(line: string): string {
  return line
    .replace(/(?:%P)+/g, ' ')
    .replace(/[^\x09\x0A\x0D\x20-\x7E]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function parseOrb(line: string): number | undefined {
  const m = line.match(/\(\s*orb\s+([0-9]+(?:\.[0-9]+)?)°/i);
  if (!m) return undefined;
  const n = Number(m[1]);
  return Number.isFinite(n) ? n : undefined;
}

function computeAgeFromBirthDate(raw?: string, now?: Date): number | undefined {
  const value = String(raw || '').trim();
  const m = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return undefined;
  const year = Number(m[1]);
  const month = Number(m[2]);
  const day = Number(m[3]);
  if (!Number.isFinite(year) || !Number.isFinite(month) || !Number.isFinite(day)) return undefined;

  const ref = now || new Date();
  let age = ref.getFullYear() - year;
  const refMonth = ref.getMonth() + 1;
  const refDay = ref.getDate();
  if (refMonth < month || (refMonth === month && refDay < day)) age -= 1;
  if (age < 0 || age > 130) return undefined;
  return age;
}

function extractEvidenceLines(chartData: string): string[] {
  const lines = String(chartData || '').split('\n').map((l) => l.trim());
  const evidenceStart = lines.findIndex((l) => /^EVIDENCE_LINES\s*:/i.test(l));
  if (evidenceStart >= 0) {
    const out: string[] = [];
    for (let i = evidenceStart + 1; i < lines.length; i += 1) {
      const line = lines[i] || '';
      if (!line) continue;
      if (/^[A-Z_]+\s*:/i.test(line) && !line.startsWith('-')) break;
      if (line.startsWith('- ')) out.push(line.slice(2).trim());
    }
    return out;
  }

  return lines
    .filter((l) => l.startsWith('- '))
    .map((l) => l.slice(2).trim());
}

function pick(lines: string[], re: RegExp): string | undefined {
  return lines.find((l) => re.test(l));
}

function pickAll(lines: string[], re: RegExp): string[] {
  return lines.filter((l) => re.test(l));
}

export function buildChartReferencePage(input: {
  chartData: string;
  personName: string;
  birth: BirthReference;
  generatedAt?: Date;
  compact?: boolean;
}): string {
  const lines = extractEvidenceLines(input.chartData);
  const sanitized = lines
    .map((l) => normalizeSpacing(l))
    .filter((l) => l.length > 0 && !/^%P+$/i.test(l));
  if (sanitized.length === 0) return '';

  const asc = pick(sanitized, /^Ascendant:/i) || pick(sanitized, /^Rising:/i);
  const sun = pick(sanitized, /^SUN:/i);
  const moon = pick(sanitized, /^MOON:/i);

  const mercury = pick(sanitized, /^MERCURY:/i);
  const venus = pick(sanitized, /^VENUS:/i);
  const mars = pick(sanitized, /^MARS:/i);

  const jupiter = pick(sanitized, /^JUPITER:/i);
  const saturn = pick(sanitized, /^SATURN:/i);
  const uranus = pick(sanitized, /^URANUS:/i);
  const neptune = pick(sanitized, /^NEPTUNE:/i);
  const pluto = pick(sanitized, /^PLUTO:/i);

  const northNode = pick(sanitized, /^North Node:/i);
  const southNode = pick(sanitized, /^South Node:/i);

  const aspectCandidates = pickAll(sanitized, /\b(CONJUNCTION|OPPOSITION|SQUARE|TRINE|SEXTILE)\b/i)
    .filter((l) => !/^T_/i.test(l));
  const compact = !!input.compact;
  const aspects: ParsedAspect[] = aspectCandidates
    .map((line) => ({ line, orb: parseOrb(line) }))
    .sort((a, b) => {
      if (a.orb == null && b.orb == null) return 0;
      if (a.orb == null) return 1;
      if (b.orb == null) return -1;
      return a.orb - b.orb;
    })
    .slice(0, compact ? 5 : 10);

  const transits = pickAll(sanitized, /^T_/i).slice(0, compact ? 3 : 8);

  const profectedSign = pick(sanitized, /^Profected sign:/i);
  const lordOfYear = pick(sanitized, /^Lord of Year:/i);

  const divider = '---------------------------------------';
  const birthDate = formatBirthDate(input.birth.birthDate);
  const bornLine = [birthDate, input.birth.birthTime, input.birth.birthPlace].filter(Boolean).join(', ');
  const explicitAge = pick(sanitized, /^(Age|Current Age):/i);
  const computedAge = computeAgeFromBirthDate(input.birth.birthDate, input.generatedAt || new Date());
  const ageLine = explicitAge
    ? explicitAge.replace(/^(Age|Current Age):\s*/i, '')
    : (typeof computedAge === 'number' ? String(computedAge) : '');

  const out: string[] = [];
  out.push(divider);
  out.push(`NATAL CHART — ${input.personName}`);
  if (bornLine) out.push(`Born: ${bornLine}`);
  if (ageLine) out.push(`Age: ${ageLine}`);
  out.push(divider);
  out.push('');

  out.push(compact ? 'BIG THREE' : 'THE BIG THREE');
  if (sun) out.push(`  Sun:      ${sun.replace(/^SUN:\s*/i, '')}`);
  if (moon) out.push(`  Moon:     ${moon.replace(/^MOON:\s*/i, '')}`);
  if (asc) out.push(`  Rising:   ${asc.replace(/^(Ascendant|Rising):\s*/i, '')}`);
  out.push('');

  out.push(compact ? 'PERSONAL' : 'PERSONAL PLANETS');
  if (mercury) out.push(`  Mercury:  ${mercury.replace(/^MERCURY:\s*/i, '')}`);
  if (venus) out.push(`  Venus:    ${venus.replace(/^VENUS:\s*/i, '')}`);
  if (mars) out.push(`  Mars:     ${mars.replace(/^MARS:\s*/i, '')}`);
  out.push('');

  out.push(compact ? 'OUTER' : 'OUTER PLANETS');
  if (jupiter) out.push(`  Jupiter:  ${jupiter.replace(/^JUPITER:\s*/i, '')}`);
  if (saturn) out.push(`  Saturn:   ${saturn.replace(/^SATURN:\s*/i, '')}`);
  if (uranus) out.push(`  Uranus:   ${uranus.replace(/^URANUS:\s*/i, '')}`);
  if (neptune) out.push(`  Neptune:  ${neptune.replace(/^NEPTUNE:\s*/i, '')}`);
  if (pluto) out.push(`  Pluto:    ${pluto.replace(/^PLUTO:\s*/i, '')}`);
  out.push('');

  out.push('NODES');
  if (northNode) out.push(`  North Node: ${northNode.replace(/^North Node:\s*/i, '')}`);
  if (southNode) out.push(`  South Node: ${southNode.replace(/^South Node:\s*/i, '')}`);
  out.push('');

  out.push(compact ? 'KEY ASPECTS' : 'KEY ASPECTS (tightest first)');
  if (aspects.length === 0) {
    out.push('  (No aspect summary available)');
  } else {
    for (const a of aspects) {
      out.push(`  ${normalizeSpacing(a.line)}`);
    }
  }
  out.push('');

  const asOf = (input.generatedAt || new Date()).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
  out.push(compact ? `TRANSITS (${asOf})` : `CURRENT TRANSITS (as of ${asOf})`);
  if (transits.length === 0) {
    out.push('  (No transit summary available)');
  } else {
    for (const t of transits) {
      out.push(`  ${normalizeSpacing(t.replace(/^T_/, 'Transit '))}`);
    }
  }
  out.push('');

  out.push('PROFECTION');
  if (profectedSign) out.push(`  ${normalizeSpacing(profectedSign)}`);
  if (lordOfYear) out.push(`  ${normalizeSpacing(lordOfYear)}`);

  out.push(divider);

  return out.join('\n').trim();
}
