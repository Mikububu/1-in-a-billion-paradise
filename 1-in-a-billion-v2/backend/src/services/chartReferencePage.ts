export type BirthReference = {
  birthDate?: string;
  birthTime?: string;
  birthPlace?: string;
};

type ParsedAspect = {
  line: string;
  orb?: number;
};

// ─── shared helpers ──────────────────────────────────────────────────────────

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

function extractRawLines(chartData: string): string[] {
  return String(chartData || '').split('\n').map((l) => normalizeSpacing(l)).filter(Boolean);
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
  return lines.filter((l) => l.startsWith('- ')).map((l) => l.slice(2).trim());
}

function pick(lines: string[], re: RegExp): string | undefined {
  return lines.find((l) => re.test(l));
}

function pickAll(lines: string[], re: RegExp): string[] {
  return lines.filter((l) => re.test(l));
}

function divider(): string {
  return '---------------------------------------';
}

function header(personName: string, birth: BirthReference, system: string, generatedAt?: Date): string[] {
  const birthDate = formatBirthDate(birth.birthDate);
  const bornLine = [birthDate, birth.birthTime, birth.birthPlace].filter(Boolean).join(', ');
  const computedAge = computeAgeFromBirthDate(birth.birthDate, generatedAt || new Date());
  const lines = [
    divider(),
    `${system.toUpperCase()} — ${personName}`,
  ];
  if (bornLine) lines.push(`Born: ${bornLine}`);
  if (typeof computedAge === 'number') lines.push(`Age: ${computedAge}`);
  lines.push(divider(), '');
  return lines;
}

// ─── WESTERN ─────────────────────────────────────────────────────────────────

function buildWesternReferencePage(input: {
  chartData: string;
  personName: string;
  birth: BirthReference;
  generatedAt?: Date;
  compact?: boolean;
}): string {
  const sanitized = extractEvidenceLines(input.chartData)
    .map((l) => normalizeSpacing(l))
    .filter((l) => l.length > 0 && !/^%P+$/i.test(l));

  if (sanitized.length === 0) return '';

  const compact = !!input.compact;
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

  const asOf = (input.generatedAt || new Date()).toLocaleDateString('en-US', {
    year: 'numeric', month: 'long', day: 'numeric',
  });

  const out: string[] = [...header(input.personName, input.birth, 'Western Astrology', input.generatedAt)];

  out.push('BIG THREE');
  if (sun) out.push(`  Sun:      ${sun.replace(/^SUN:\s*/i, '')}`);
  if (moon) out.push(`  Moon:     ${moon.replace(/^MOON:\s*/i, '')}`);
  if (asc) out.push(`  Rising:   ${asc.replace(/^(Ascendant|Rising):\s*/i, '')}`);
  out.push('');

  out.push('PERSONAL PLANETS');
  if (mercury) out.push(`  Mercury:  ${mercury.replace(/^MERCURY:\s*/i, '')}`);
  if (venus) out.push(`  Venus:    ${venus.replace(/^VENUS:\s*/i, '')}`);
  if (mars) out.push(`  Mars:     ${mars.replace(/^MARS:\s*/i, '')}`);
  out.push('');

  out.push('OUTER PLANETS');
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

  out.push(`KEY ASPECTS (tightest first)`);
  if (aspects.length === 0) {
    out.push('  (No aspect summary available)');
  } else {
    for (const a of aspects) out.push(`  ${normalizeSpacing(a.line)}`);
  }
  out.push('');

  out.push(`TRANSITS (${asOf})`);
  if (transits.length === 0) {
    out.push('  (No transit summary available)');
  } else {
    for (const t of transits) out.push(`  ${normalizeSpacing(t.replace(/^T_/, 'Transit '))}`);
  }
  out.push('');

  out.push('PROFECTION');
  if (profectedSign) out.push(`  ${normalizeSpacing(profectedSign)}`);
  if (lordOfYear) out.push(`  ${normalizeSpacing(lordOfYear)}`);
  out.push(divider());

  return out.join('\n').trim();
}

// ─── VEDIC ───────────────────────────────────────────────────────────────────

function buildVedicReferencePage(input: {
  chartData: string;
  personName: string;
  birth: BirthReference;
  generatedAt?: Date;
}): string {
  const raw = extractRawLines(input.chartData);

  const findVal = (re: RegExp): string | undefined => {
    const l = raw.find((line) => re.test(line));
    if (!l) return undefined;
    return l.replace(re, '').replace(/^[:\s]+/, '').trim();
  };

  const lagna = findVal(/^-?\s*Lagna\s*\(Ascendant\)\s*:/i)
    || findVal(/^-?\s*Lagna\s*:/i);
  const lagnaLord = findVal(/^-?\s*Lagna Lord/i);
  const surya = findVal(/^-?\s*Surya\s*\(Sun\)\s*:/i) || findVal(/^-?\s*Surya\s*:/i);
  const chandra = findVal(/^-?\s*Chandra\s*\(Moon\)\s*:/i) || findVal(/^-?\s*Chandra\s*:/i);
  const mangal = findVal(/^-?\s*Mangal\s*\(Mars\)\s*:/i) || findVal(/^-?\s*Mangal\s*:/i);
  const budha = findVal(/^-?\s*Budha\s*\(Mercury\)\s*:/i) || findVal(/^-?\s*Budha\s*:/i);
  const guru = findVal(/^-?\s*Guru\s*\(Jupiter\)\s*:/i) || findVal(/^-?\s*Guru\s*:/i);
  const shukra = findVal(/^-?\s*Shukra\s*\(Venus\)\s*:/i) || findVal(/^-?\s*Shukra\s*:/i);
  const shani = findVal(/^-?\s*Shani\s*\(Saturn\)\s*:/i) || findVal(/^-?\s*Shani\s*:/i);
  const rahu = findVal(/^-?\s*Rahu\s*:/i);
  const ketu = findVal(/^-?\s*Ketu\s*:/i);

  const janmaNakshatra = findVal(/^-?\s*Janma Nakshatra\s*:/i)
    || findVal(/^-?\s*Chandra Rashi\s*:/i);

  // Dasha
  const mahadasha = findVal(/^-?\s*Current Mahadasha\s*:/i);
  const antardasha = findVal(/^-?\s*Current Antardasha\s*:/i);

  // Loudest signal / temperature from digest sections
  const loudestIdx = raw.findIndex((l) => /^##\s*LOUDEST SIGNAL/i.test(l));
  const loudestLines: string[] = [];
  if (loudestIdx >= 0) {
    for (let i = loudestIdx + 1; i < Math.min(loudestIdx + 4, raw.length); i += 1) {
      const l = raw[i] || '';
      if (/^##/.test(l)) break;
      if (l.trim()) loudestLines.push(l.trim());
    }
  }

  const temperature = findVal(/^##\s*TEMPERATURE\s*$/) || findVal(/^-?\s*TEMPERATURE\s*:/i);
  const seventh = findVal(/^-?\s*One-line relationship architecture/i);

  const out: string[] = [...header(input.personName, input.birth, 'Vedic Astrology (Jyotish)', input.generatedAt)];

  out.push('LAGNA (ASCENDANT)');
  if (lagna) out.push(`  Sign:       ${lagna}`);
  if (lagnaLord) out.push(`  Lord:       ${lagnaLord}`);
  out.push('');

  out.push('GRAHAS (SIDEREAL)');
  const graha = (label: string, val?: string) =>
    val ? out.push(`  ${label.padEnd(10)} ${val}`) : undefined;
  graha('Surya:', surya);
  graha('Chandra:', chandra);
  graha('Mangal:', mangal);
  graha('Budha:', budha);
  graha('Guru:', guru);
  graha('Shukra:', shukra);
  graha('Shani:', shani);
  graha('Rahu:', rahu);
  graha('Ketu:', ketu);
  if (janmaNakshatra) out.push(`  Janma Nak:  ${janmaNakshatra}`);
  out.push('');

  out.push('VIMSHOTTARI DASHA');
  if (mahadasha) out.push(`  Mahadasha:  ${mahadasha}`);
  if (antardasha) out.push(`  Antardasha: ${antardasha}`);
  out.push('');

  if (seventh) {
    out.push('7TH BHAVA (PARTNERSHIP)');
    out.push(`  ${seventh}`);
    out.push('');
  }

  if (loudestLines.length > 0) {
    out.push('LOUDEST SIGNAL');
    for (const l of loudestLines.slice(0, 3)) out.push(`  ${l}`);
    out.push('');
  }

  if (temperature) {
    out.push(`CURRENT TEMPERATURE: ${temperature}`);
    out.push('');
  }

  out.push(divider());
  return out.join('\n').trim();
}

// ─── HUMAN DESIGN ────────────────────────────────────────────────────────────

function buildHumanDesignReferencePage(input: {
  chartData: string;
  personName: string;
  birth: BirthReference;
  generatedAt?: Date;
}): string {
  const raw = extractRawLines(input.chartData);

  const findVal = (re: RegExp): string | undefined => {
    const l = raw.find((line) => re.test(line));
    if (!l) return undefined;
    return l.replace(re, '').replace(/^[:\s-]+/, '').trim();
  };

  const type = findVal(/^-?\s*Type\s*:/i);
  const strategy = findVal(/^-?\s*Strategy\s*:/i);
  const authority = findVal(/^-?\s*Authority\s*:/i);
  const profile = findVal(/^-?\s*Profile\s*:/i);
  const definition = findVal(/^-?\s*Definition\s*:/i);
  const cross = findVal(/^-?\s*Incarnation Cross\s*:/i);

  const definedLine = raw.find((l) => /^DEFINED CENTERS/i.test(l));
  const openLine = raw.find((l) => /^OPEN CENTERS/i.test(l));
  const defined = definedLine?.replace(/^DEFINED CENTERS[^:]*:\s*/i, '').trim();
  const open = openLine?.replace(/^OPEN CENTERS[^:]*:\s*/i, '').trim();

  // Active channels
  const channelStart = raw.findIndex((l) => /^ACTIVE CHANNELS/i.test(l));
  const channels: string[] = [];
  if (channelStart >= 0) {
    for (let i = channelStart + 1; i < Math.min(channelStart + 10, raw.length); i += 1) {
      const l = (raw[i] || '').replace(/^-\s*/, '').trim();
      if (!l || /^[A-Z ]+:/.test(l)) break;
      channels.push(l);
    }
  }

  // All active gates
  const gatesLine = raw.find((l) => /^ALL ACTIVE GATES/i.test(l));
  const gates = gatesLine?.replace(/^ALL ACTIVE GATES[^:]*:\s*/i, '').trim();

  const out: string[] = [...header(input.personName, input.birth, 'Human Design', input.generatedAt)];

  out.push('DESIGN');
  if (type) out.push(`  Type:       ${type}`);
  if (strategy) out.push(`  Strategy:   ${strategy}`);
  if (authority) out.push(`  Authority:  ${authority}`);
  if (profile) out.push(`  Profile:    ${profile}`);
  if (definition) out.push(`  Definition: ${definition}`);
  if (cross) out.push(`  Cross:      ${cross}`);
  out.push('');

  out.push('ENERGY CENTERS');
  if (defined) out.push(`  Defined: ${defined}`);
  if (open) out.push(`  Open:    ${open}`);
  out.push('');

  if (channels.length > 0) {
    out.push(`ACTIVE CHANNELS (${channels.length})`);
    for (const ch of channels.slice(0, 8)) out.push(`  ${ch}`);
    out.push('');
  }

  if (gates) {
    out.push('ACTIVE GATES');
    out.push(`  ${gates}`);
    out.push('');
  }

  out.push(divider());
  return out.join('\n').trim();
}

// ─── GENE KEYS ───────────────────────────────────────────────────────────────

function buildGeneKeysReferencePage(input: {
  chartData: string;
  personName: string;
  birth: BirthReference;
  generatedAt?: Date;
}): string {
  const raw = extractRawLines(input.chartData);

  const extractSphere = (re: RegExp): string | undefined => {
    const l = raw.find((line) => re.test(line));
    if (!l) return undefined;
    return l.replace(re, '').replace(/^[:\s-]+/, '').trim();
  };

  const spheres: Array<{ label: string; val?: string }> = [
    { label: "Life's Work", val: extractSphere(/Life'?s Work/i) },
    { label: 'Evolution', val: extractSphere(/Evolution\s*\(Conscious Earth\)/i) },
    { label: 'Radiance', val: extractSphere(/Radiance\s*\(Design Sun\)/i) },
    { label: 'Purpose', val: extractSphere(/Purpose\s*\(Design Earth\)/i) },
    { label: 'Attraction', val: extractSphere(/Attraction\s*\(Venus\)/i) },
    { label: 'IQ', val: extractSphere(/IQ\s*\/\s*Intelligence/i) },
    { label: 'EQ', val: extractSphere(/EQ\s*\/\s*Emotional/i) },
    { label: 'SQ', val: extractSphere(/SQ\s*\/\s*Spiritual/i) },
    { label: 'Vocation', val: extractSphere(/Vocation\s*\(Conscious Mars\)/i) },
    { label: 'Culture', val: extractSphere(/Culture\s*\(Design Jupiter\)/i) },
    { label: 'Pearl', val: extractSphere(/Pearl\s*\(same/i) },
  ];

  const out: string[] = [...header(input.personName, input.birth, 'Gene Keys', input.generatedAt)];

  out.push('ACTIVATION SEQUENCE (Prime Gifts)');
  for (const { label, val } of spheres.slice(0, 4)) {
    if (val) out.push(`  ${label.padEnd(12)} ${val}`);
  }
  out.push('');

  const venusSeq = spheres.slice(4, 8).filter((s) => s.val);
  if (venusSeq.length > 0) {
    out.push('VENUS SEQUENCE (Relational)');
    for (const { label, val } of venusSeq) {
      if (val) out.push(`  ${label.padEnd(12)} ${val}`);
    }
    out.push('');
  }

  const pearlSeq = spheres.slice(8).filter((s) => s.val);
  if (pearlSeq.length > 0) {
    out.push('PEARL SEQUENCE (Prosperity)');
    for (const { label, val } of pearlSeq) {
      if (val) out.push(`  ${label.padEnd(12)} ${val}`);
    }
    out.push('');
  }

  out.push(divider());
  return out.join('\n').trim();
}

// ─── KABBALAH ────────────────────────────────────────────────────────────────

function buildKabbalahReferencePage(input: {
  chartData: string;
  personName: string;
  birth: BirthReference;
  generatedAt?: Date;
}): string {
  const raw = extractRawLines(input.chartData);

  const findVal = (re: RegExp): string | undefined => {
    const l = raw.find((line) => re.test(line));
    if (!l) return undefined;
    return l.replace(re, '').replace(/^[:\s-]+/, '').trim();
  };

  const dominantWorld = findVal(/Dominant World\s*:/i);
  const voidWorlds = findVal(/Void Worlds\s*:/i);

  // Letter signature
  const sunLetter = findVal(/Sun Letter\s*:/i);
  const moonLetter = findVal(/Moon Letter\s*:/i);
  const risingLetter = findVal(/Rising Letter\s*:/i);

  // Sefirot — collect strong ones
  const strongSefirot: string[] = raw
    .filter((l) => /strength=strong/i.test(l))
    .map((l) => {
      const m = l.match(/^-?\s*([\w\s]+)\s+via\s+/i);
      return m ? m[1].trim() : l.replace(/^-?\s*/, '').slice(0, 40);
    })
    .slice(0, 5);

  const moderateSefirot: string[] = raw
    .filter((l) => /strength=moderate/i.test(l))
    .map((l) => {
      const m = l.match(/^-?\s*([\w\s]+)\s+via\s+/i);
      return m ? m[1].trim() : l.replace(/^-?\s*/, '').slice(0, 40);
    })
    .slice(0, 3);

  // Shadow axis
  const shadowAxis = findVal(/Primary Shadow Axis\s*:/i);

  // Klipoth
  const klipoth = findVal(/Active Klipoth\s*:/i);

  const out: string[] = [...header(input.personName, input.birth, 'Kabbalah (Hermetic)', input.generatedAt)];

  out.push('FOUR WORLDS');
  if (dominantWorld) out.push(`  Dominant: ${dominantWorld}`);
  if (voidWorlds) out.push(`  Void:     ${voidWorlds}`);
  out.push('');

  out.push('SEFIROT');
  if (strongSefirot.length > 0) {
    out.push('  Strong:');
    for (const s of strongSefirot) out.push(`    ${s}`);
  }
  if (moderateSefirot.length > 0) {
    out.push('  Moderate:');
    for (const s of moderateSefirot) out.push(`    ${s}`);
  }
  out.push('');

  out.push('LETTER SIGNATURE');
  if (sunLetter) out.push(`  Sun:    ${sunLetter}`);
  if (moonLetter) out.push(`  Moon:   ${moonLetter}`);
  if (risingLetter) out.push(`  Rising: ${risingLetter}`);
  out.push('');

  out.push('SHADOW WORK');
  if (shadowAxis) out.push(`  Primary Axis: ${shadowAxis}`);
  if (klipoth) out.push(`  Active Klipoth: ${klipoth}`);
  out.push('');

  out.push(divider());
  return out.join('\n').trim();
}

// ─── COMPATIBILITY APPENDIX ──────────────────────────────────────────────────

type CompatibilityMetric = {
  label: string;
  score: number;
  note: string;
};

function clampScore(score: number): number {
  return Math.max(0, Math.min(10, Math.round(score * 10) / 10));
}

function countRegex(text: string, re: RegExp): number {
  const m = text.match(re);
  return m ? m.length : 0;
}

function buildCompatibilityMetrics(system: string, combinedChartData: string): CompatibilityMetric[] {
  const text = String(combinedChartData || '');
  const isVedic = system === 'vedic';
  const isHd = system === 'human_design';
  const isGk = system === 'gene_keys';
  const isKabbalah = system === 'kabbalah';

  const magneticSignalsRaw =
    countRegex(text, /\b(conjunction|venus|mars|pluto|eighth house|8th house|intimacy|attraction|magnetic)\b/gi) +
    countRegex(text, /\b(channel 6-59|gate 59)\b/gi);
  const hardSignalsRaw =
    countRegex(text, /\b(square|opposition|saturn|pluto|rahu|ketu|klipoth|shadow axis|danger|risk)\b/gi) +
    countRegex(text, /\b(12th house|eighth house|8th house)\b/gi);
  const softSignalsRaw =
    countRegex(text, /\b(trine|sextile|jupiter|venus|gift|resourcefulness|teamwork|wisdom|healing)\b/gi);
  const dailySignalsRaw =
    countRegex(text, /\b(moon|4th house|6th house|routine|daily|home|defined centers|open centers)\b/gi);
  const karmicSignalsRaw =
    countRegex(text, /\b(north node|south node|rahu|ketu|karmic|tikkun|cross|dasha)\b/gi);

  // Diminishing returns prevent score saturation when the combined chart dump is very dense.
  const normalize = (n: number): number => Math.min(4, Math.log2(1 + Math.max(0, n)));
  const magneticSignals = normalize(magneticSignalsRaw);
  const hardSignals = normalize(hardSignalsRaw);
  const softSignals = normalize(softSignalsRaw);
  const dailySignals = normalize(dailySignalsRaw);
  const karmicSignals = normalize(karmicSignalsRaw);

  let safeToSpicy = 4.1 + magneticSignals * 0.95 + softSignals * 0.25 - hardSignals * 0.45;
  let karmic = 3.2 + karmicSignals * 1.05 + (isVedic || isKabbalah ? 0.5 : 0);
  let dailyLife = 4.4 + dailySignals * 0.85 + softSignals * 0.35 - hardSignals * 0.55;
  let toxic = 2.4 + hardSignals * 0.95 + magneticSignals * 0.30 - softSignals * 0.30;
  let healing = 3.8 + softSignals * 0.95 + karmicSignals * 0.28 - hardSignals * 0.50;
  let longTerm = 4.0 + dailySignals * 0.55 + softSignals * 0.60 - hardSignals * 0.60;

  if (isHd) {
    safeToSpicy += 0.15;
    dailyLife += 0.25;
    toxic += 0.10;
  }
  if (isGk) {
    healing += 0.35;
    karmic += 0.2;
  }
  if (isKabbalah) {
    karmic += 0.4;
    toxic += 0.15;
    longTerm -= 0.1;
  }

  const safeToSpicyScore = clampScore(safeToSpicy);
  const karmicScore = clampScore(karmic);
  const dailyLifeScore = clampScore(dailyLife);
  const toxicScore = clampScore(toxic);
  const healingScore = clampScore(healing);
  const longTermScore = clampScore(longTerm);

  const noteByScore = (score: number, low: string, mid: string, high: string): string => {
    if (score >= 7.5) return high;
    if (score >= 4.5) return mid;
    return low;
  };

  return [
    {
      label: 'Safe to Spicy',
      score: safeToSpicyScore,
      note: noteByScore(
        safeToSpicyScore,
        'Leans safe and steady; chemistry may need conscious ignition.',
        'Balanced attraction: enough heat to matter, enough safety to stay.',
        'High voltage chemistry; captivating, but requires emotional maturity.'
      ),
    },
    {
      label: 'Karmic Resonance',
      score: karmicScore,
      note: noteByScore(
        karmicScore,
        'Little karmic drag; this can feel refreshingly present-focused.',
        'Clear karmic pull with unfinished lessons that can still be worked through.',
        'Strong karmic charge; the bond can feel fated and difficult to ignore.'
      ),
    },
    {
      label: 'Daily Life',
      score: dailyLifeScore,
      note: noteByScore(
        dailyLifeScore,
        'Day-to-day rhythm needs negotiation to avoid repeated friction.',
        'Workable routine potential if communication stays explicit.',
        'Daily compatibility is strong; routines can become a shared refuge.'
      ),
    },
    {
      label: 'Toxic Relationship Potential',
      score: toxicScore,
      note: noteByScore(
        toxicScore,
        'Low toxicity signature; conflict is unlikely to spiral.',
        'Moderate risk: old wounds can amplify conflict under stress.',
        'High risk: hidden fire can turn magnetic pull into emotional volatility.'
      ),
    },
    {
      label: 'Healing Potential',
      score: healingScore,
      note: noteByScore(
        healingScore,
        'Healing requires deliberate effort; growth is possible but not automatic.',
        'Mutual growth potential is real when both stay accountable.',
        'Strong healing field: this bond can accelerate emotional integration.'
      ),
    },
    {
      label: 'Long-Term Sustainability',
      score: longTermScore,
      note: noteByScore(
        longTermScore,
        'Long-term stability is fragile unless both change key patterns.',
        'Long-term can work with structure, boundaries, and honest timing.',
        'Strong long-term potential when shared values are actively maintained.'
      ),
    },
  ];
}

/**
 * Builds a compatibility snapshot page for synastry/overlay readings.
 * Deterministic — no LLM call needed. Extracts key cross-system indicators
 * directly from the combined chart data.
 */
export function buildCompatibilityAppendix(input: {
  system: string;
  person1Name: string;
  person2Name: string;
  person1ChartData: string;
  person2ChartData: string;
  combinedChartData: string;
}): string {
  const { system, person1Name, person2Name, combinedChartData } = input;
  const raw = extractRawLines(combinedChartData);

  const asOf = new Date().toLocaleDateString('en-US', {
    year: 'numeric', month: 'long', day: 'numeric',
  });

  const out: string[] = [
    divider(),
    `COMPATIBILITY SNAPSHOT`,
    `${person1Name} & ${person2Name}`,
    `System: ${system.replace('_', ' ').replace(/\b\w/g, (c) => c.toUpperCase())}`,
    `Generated: ${asOf}`,
    divider(),
    '',
  ];

  const metrics = buildCompatibilityMetrics(system, combinedChartData);
  out.push('COMPATIBILITY METRICS');
  for (const metric of metrics) {
    out.push(`- ${metric.label}: ${metric.score.toFixed(1)}/10 — ${metric.note}`);
  }
  out.push('');

  if (system === 'western' || system === 'vedic') {
    // Cross-aspects: lines containing both person names or labeled as synastry
    const synastryAspects = raw
      .filter((l) => /\bCONJUNCTION|OPPOSITION|SQUARE|TRINE|SEXTILE\b/i.test(l))
      .filter((l) => /synastry|cross|overlay/i.test(l) || l.includes('→') || l.includes('vs'))
      .slice(0, 8);

    const allAspects = raw
      .filter((l) => /\bCONJUNCTION|OPPOSITION|SQUARE|TRINE|SEXTILE\b/i.test(l))
      .map((line) => ({ line, orb: parseOrb(line) }))
      .sort((a, b) => {
        if (a.orb == null && b.orb == null) return 0;
        if (a.orb == null) return 1;
        if (b.orb == null) return -1;
        return a.orb - b.orb;
      })
      .slice(0, 8);

    const aspects = synastryAspects.length > 0
      ? synastryAspects
      : allAspects.map((a) => a.line);

    if (aspects.length > 0) {
      out.push('KEY CROSS-ASPECTS (tightest first)');
      for (const a of aspects) out.push(`  ${normalizeSpacing(a)}`);
      out.push('');
    }

    // Vedic-specific: Ashtakoota / compatibility scores
    const ashta = raw.find((l) => /Ashtakoota|Total Score/i.test(l));
    if (ashta) {
      out.push('VEDIC COMPATIBILITY');
      out.push(`  ${ashta}`);
      const subScores = raw
        .filter((l) => /Yoni|Gana|Dasha|Varna|Tara|Nadi|Bhakut/i.test(l))
        .slice(0, 6);
      for (const s of subScores) out.push(`  ${normalizeSpacing(s)}`);
      out.push('');
    }
  }

  if (system === 'human_design') {
    // Channel completions between charts
    const electromagnetic = raw
      .filter((l) => /electromagnetic|channel completion|completing channel/i.test(l))
      .slice(0, 6);
    if (electromagnetic.length > 0) {
      out.push('ELECTROMAGNETIC CONNECTIONS');
      for (const l of electromagnetic) out.push(`  ${normalizeSpacing(l)}`);
      out.push('');
    }

    // Defined/open center dynamics
    const centersP1 = raw.find((l) => /DEFINED CENTERS/i.test(l) && raw.indexOf(l) < raw.length / 2);
    const centersP2 = raw.find((l) => /DEFINED CENTERS/i.test(l) && raw.indexOf(l) > raw.length / 2);
    if (centersP1 || centersP2) {
      out.push('CENTER DYNAMICS');
      if (centersP1) out.push(`  ${person1Name}: ${centersP1.replace(/^DEFINED CENTERS[^:]*:\s*/i, '')}`);
      if (centersP2) out.push(`  ${person2Name}: ${centersP2.replace(/^DEFINED CENTERS[^:]*:\s*/i, '')}`);
      out.push('');
    }
  }

  if (system === 'gene_keys') {
    // Shadow/Gift resonance — find matching gene key numbers between charts
    const p1Keys = extractGeneKeyNumbers(input.person1ChartData);
    const p2Keys = extractGeneKeyNumbers(input.person2ChartData);
    const shared = p1Keys.filter((k) => p2Keys.includes(k));
    const mirrored = findMirroredKeys(p1Keys, p2Keys);

    if (shared.length > 0) {
      out.push('SHARED GENE KEYS (resonance)');
      out.push(`  Keys ${shared.join(', ')} active in both charts`);
      out.push('');
    }
    if (mirrored.length > 0) {
      out.push('MIRRORED KEYS (polarity)');
      for (const [a, b] of mirrored.slice(0, 3)) out.push(`  Key ${a} ↔ Key ${b}`);
      out.push('');
    }
  }

  if (system === 'kabbalah') {
    // Four Worlds alignment
    const p1Dominant = raw.find((l) => /Dominant World/i.test(l) && raw.indexOf(l) < raw.length / 2);
    const p2Dominant = raw.find((l) => /Dominant World/i.test(l) && raw.indexOf(l) >= raw.length / 2);
    if (p1Dominant || p2Dominant) {
      out.push('FOUR WORLDS ALIGNMENT');
      if (p1Dominant) out.push(`  ${person1Name}: ${p1Dominant.replace(/^.*Dominant World[^:]*:\s*/i, '')}`);
      if (p2Dominant) out.push(`  ${person2Name}: ${p2Dominant.replace(/^.*Dominant World[^:]*:\s*/i, '')}`);
      out.push('');
    }

    // Shared sefirot / klipoth polarity
    const p1Shadow = raw.find((l) => /Primary Shadow Axis/i.test(l) && raw.indexOf(l) < raw.length / 2);
    const p2Shadow = raw.find((l) => /Primary Shadow Axis/i.test(l) && raw.indexOf(l) >= raw.length / 2);
    if (p1Shadow || p2Shadow) {
      out.push('SHADOW AXIS');
      if (p1Shadow) out.push(`  ${person1Name}: ${p1Shadow.replace(/^.*Primary Shadow Axis[^:]*:\s*/i, '')}`);
      if (p2Shadow) out.push(`  ${person2Name}: ${p2Shadow.replace(/^.*Primary Shadow Axis[^:]*:\s*/i, '')}`);
      out.push('');
    }
  }

  out.push(divider());
  return out.join('\n').trim();
}

function extractGeneKeyNumbers(chartData: string): number[] {
  const nums: number[] = [];
  const re = /Key\s+(\d+)\./g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(chartData)) !== null) {
    const n = Number(m[1]);
    if (n >= 1 && n <= 64 && !nums.includes(n)) nums.push(n);
  }
  return nums;
}

function findMirroredKeys(p1: number[], p2: number[]): Array<[number, number]> {
  // Gene Keys that are opposite/complementary tend to be ~32 apart (codon pairs)
  const pairs: Array<[number, number]> = [];
  for (const k of p1) {
    const mirror = k <= 32 ? k + 32 : k - 32;
    if (p2.includes(mirror)) pairs.push([k, mirror]);
  }
  return pairs;
}

// ─── PUBLIC ENTRY POINT ──────────────────────────────────────────────────────

export function buildChartReferencePage(input: {
  chartData: string;
  personName: string;
  birth: BirthReference;
  generatedAt?: Date;
  compact?: boolean;
  system?: string;
}): string {
  const sys = (input.system || 'western').toLowerCase().replace(/-/g, '_');

  switch (sys) {
    case 'vedic':
    case 'vedic_astrology':
    case 'vedic_astrology_jyotish':
      return buildVedicReferencePage(input);

    case 'human_design':
      return buildHumanDesignReferencePage(input);

    case 'gene_keys':
      return buildGeneKeysReferencePage(input);

    case 'kabbalah':
      return buildKabbalahReferencePage(input);

    default:
      return buildWesternReferencePage(input);
  }
}
