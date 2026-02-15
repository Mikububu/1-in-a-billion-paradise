/**
 * Chart data builder used by the V2 job pipeline.
 *
 * Purpose:
 * - Provide system-specific chart data to the LLM (Western/Vedic/HD/GeneKeys/Kabbalah).
 * - Avoid leaking the "other person" chart into individual readings.
 *
 * NOTE: This is intentionally a pure function. Any Swiss Ephemeris calls happen elsewhere.
 */

export function buildChartDataForSystem(
  system: string,
  person1Name: string,
  p1Placements: any,
  person2Name: string | null,
  p2Placements: any | null,
  p1BirthData: { birthDate: string; birthTime: string; timezone?: string; birthPlace?: string },
  p2BirthData: { birthDate: string; birthTime: string; timezone?: string; birthPlace?: string } | null
): string {
  const formatDegree = (d: any) => (d ? `${d.degree}° ${d.minute}'` : '');
  const hasP2 = Boolean(person2Name && p2Placements && p2BirthData);

  const getZodiacSign = (degree: number): string => {
    const signs = [
      'Aries',
      'Taurus',
      'Gemini',
      'Cancer',
      'Leo',
      'Virgo',
      'Libra',
      'Scorpio',
      'Sagittarius',
      'Capricorn',
      'Aquarius',
      'Pisces',
    ];
    return signs[Math.floor(degree / 30) % 12];
  };

  const getNakshatra = (degree: number): string => {
    const nakshatras = [
      'Ashwini',
      'Bharani',
      'Krittika',
      'Rohini',
      'Mrigashira',
      'Ardra',
      'Punarvasu',
      'Pushya',
      'Ashlesha',
      'Magha',
      'Purva Phalguni',
      'Uttara Phalguni',
      'Hasta',
      'Chitra',
      'Swati',
      'Vishakha',
      'Anuradha',
      'Jyeshtha',
      'Mula',
      'Purva Ashadha',
      'Uttara Ashadha',
      'Shravana',
      'Dhanishtha',
      'Shatabhisha',
      'Purva Bhadrapada',
      'Uttara Bhadrapada',
      'Revati',
    ];
    // Exact division: 360 / 27 = 13.333333333333334
    return nakshatras[Math.floor((degree % 360) / (360 / 27)) % 27];
  };

  const getHDGate = (degree: number): number => {
    // Human Design uses a specific mapping of 64 I Ching gates
    const gateMap = [
      41, 19, 13, 49, 30, 55, 37, 63, 22, 36, 25, 17, 21, 51, 42, 3, 27, 24,
      2, 23, 8, 20, 16, 35, 45, 12, 15, 52, 39, 53, 62, 56, 31, 33, 7, 4,
      29, 59, 40, 64, 47, 6, 46, 18, 48, 57, 32, 50, 28, 44, 1, 43, 14, 34,
      9, 5, 26, 11, 10, 58, 38, 54, 61, 60,
    ];
    // Exact division: 360 / 64 = 5.625
    return gateMap[Math.floor((degree % 360) / 5.625) % 64];
  };

  const getLifePath = (birthDate: string): number => {
    const digits = birthDate.replace(/\D/g, '').split('').map(Number);
    let sum = digits.reduce((a, b) => a + b, 0);
    while (sum > 9 && sum !== 11 && sum !== 22 && sum !== 33) {
      sum = sum
        .toString()
        .split('')
        .map(Number)
        .reduce((a, b) => a + b, 0);
    }
    return sum;
  };

  const signIndex: Record<string, number> = {
    Aries: 0,
    Taurus: 1,
    Gemini: 2,
    Cancer: 3,
    Leo: 4,
    Virgo: 5,
    Libra: 6,
    Scorpio: 7,
    Sagittarius: 8,
    Capricorn: 9,
    Aquarius: 10,
    Pisces: 11,
  };

  const fallbackLongitude = (pl: any, which: 'sun' | 'moon' | 'asc') => {
    const sign =
      which === 'sun'
        ? pl?.sunDegree?.sign || pl?.sunSign
        : which === 'moon'
          ? pl?.moonDegree?.sign || pl?.moonSign
          : pl?.ascendantDegree?.sign || pl?.risingSign;
    const deg =
      which === 'sun'
        ? (pl?.sunDegree?.degree ?? 0)
        : which === 'moon'
          ? (pl?.moonDegree?.degree ?? 0)
          : (pl?.ascendantDegree?.degree ?? 0);
    const min =
      which === 'sun'
        ? (pl?.sunDegree?.minute ?? 0)
        : which === 'moon'
          ? (pl?.moonDegree?.minute ?? 0)
          : (pl?.ascendantDegree?.minute ?? 0);
    const idx = typeof sign === 'string' && sign in signIndex ? signIndex[sign]! : 0;
    return (idx * 30 + deg + min / 60) % 360;
  };

  const p1SunDeg =
    typeof p1Placements?.sunLongitude === 'number'
      ? (p1Placements.sunLongitude as number)
      : fallbackLongitude(p1Placements, 'sun');
  const p2SunDeg =
    hasP2 && typeof p2Placements?.sunLongitude === 'number'
      ? (p2Placements.sunLongitude as number)
      : hasP2
        ? fallbackLongitude(p2Placements, 'sun')
        : 0;

  const fmtDegObj = (d: { sign: string; degree: number; minute: number } | undefined) => {
    if (!d) return 'Unknown';
    const mm = String(d.minute ?? 0).padStart(2, '0');
    return `${d.sign} ${d.degree}° ${mm}'`;
  };

  const westernRuler: Record<string, string> = {
    Aries: 'Mars',
    Taurus: 'Venus',
    Gemini: 'Mercury',
    Cancer: 'Moon',
    Leo: 'Sun',
    Virgo: 'Mercury',
    Libra: 'Venus',
    Scorpio: 'Mars',
    Sagittarius: 'Jupiter',
    Capricorn: 'Saturn',
    Aquarius: 'Saturn',
    Pisces: 'Jupiter',
  };

  const getAgeYears = (birthDate: string, now: Date) => {
    const [y, m, d] = String(birthDate).split('-').map((v) => Number(v));
    if (!y || !m || !d) return undefined;
    const nowY = now.getUTCFullYear();
    const nowM = now.getUTCMonth() + 1;
    const nowD = now.getUTCDate();
    let age = nowY - y;
    if (nowM < m || (nowM === m && nowD < d)) age -= 1;
    return age;
  };

  const buildWesternSection = (name: string, placements: any, birthData: { birthDate: string; birthTime: string; timezone?: string; birthPlace?: string }) => {
    const t = placements?.tropical;
    if (!t) {
      return `${name.toUpperCase()} WESTERN (TROPICAL) CHART:\n` +
        `- Sun: ${placements.sunSign} ${formatDegree(placements.sunDegree)}\n` +
        `- Moon: ${placements.moonSign} ${formatDegree(placements.moonDegree)}\n` +
        `- Rising: ${placements.risingSign} ${formatDegree(placements.ascendantDegree)}`;
    }

    const now = new Date();
    const todayIso = now.toISOString().slice(0, 10);
    const age = getAgeYears(birthData.birthDate, now);

    const asc = fmtDegObj(placements?.ascendantDegree);
    const mc = fmtDegObj(typeof t?.mcLongitude === 'number' ? (toDegreesObj(t.mcLongitude) as any) : undefined);

    const sun = t.planets.find((p: any) => p.key === 'sun');
    const sect =
      typeof sun?.house === 'number'
        ? sun.house >= 7
          ? 'Day'
          : 'Night'
        : undefined;

    const ascSign = placements?.risingSign || placements?.ascendantDegree?.sign;
    const ascIdx = typeof ascSign === 'string' && ascSign in signIndex ? signIndex[ascSign]! : 0;
    const profYear = typeof age === 'number' ? age % 12 : undefined;
    const profSign = typeof age === 'number'
      ? Object.keys(signIndex).find((k) => signIndex[k] === ((ascIdx + age) % 12)) || 'Unknown'
      : undefined;
    const lordOfYear = profSign ? westernRuler[profSign] : undefined;
    const prof5 = profSign
      ? Object.keys(signIndex).find((k) => signIndex[k] === ((signIndex[profSign]! + 4) % 12)) || 'Unknown'
      : undefined;
    const prof7 = profSign
      ? Object.keys(signIndex).find((k) => signIndex[k] === ((signIndex[profSign]! + 6) % 12)) || 'Unknown'
      : undefined;

    const planetLines = (t.planets || [])
      .map((p: any) => {
        const rx = p.retrograde ? ' Rx' : '';
        const house = typeof p.house === 'number' ? ` (House ${p.house})` : '';
        return `- ${String(p.key).toUpperCase()}: ${fmtDegObj(p)}${house}${rx}`;
      })
      .join('\n');

    const cuspLines = (t.houseCusps || [])
      .slice(0, 12)
      .map((c: number, idx: number) => `- ${idx + 1}: ${fmtDegObj(toDegreesObj(c))}`)
      .join('\n');

    const nodeLines = t.nodes
      ? [
        `- North Node: ${fmtDegObj(t.nodes.northNodeDegree)}${typeof t.nodes.northNodeHouse === 'number' ? ` (House ${t.nodes.northNodeHouse})` : ''}${t.nodes.northNodeRetrograde ? ' Rx' : ''}`,
        `- South Node: ${fmtDegObj(t.nodes.southNodeDegree)}${typeof t.nodes.southNodeHouse === 'number' ? ` (House ${t.nodes.southNodeHouse})` : ''}${t.nodes.southNodeRetrograde ? ' Rx' : ''}`,
      ].join('\n')
      : '- North Node: Unknown\n- South Node: Unknown';

    const aspectLines = (t.aspects || [])
      .map((a: any) => `- ${a.a} ${String(a.type).toUpperCase()} ${a.b} (orb ${a.orb}°${a.exact ? ', exact' : ''})`)
      .join('\n');

    const transitPlanetLines = (t.transits?.planets || [])
      .map((p: any) => {
        const rx = p.retrograde ? ' Rx' : '';
        const house = typeof p.house === 'number' ? ` (House ${p.house})` : '';
        return `- ${String(p.key).toUpperCase()}: ${fmtDegObj(p)}${house}${rx}`;
      })
      .join('\n');

    const transitAspectLines = (t.transits?.aspectsToNatal || [])
      .slice(0, 40)
      .map((a: any) => `- ${a.transit} ${String(a.type).toUpperCase()} ${a.natal} (orb ${a.orb}°${a.exact ? ', exact' : ''})`)
      .join('\n');

    const profectionBlock =
      typeof age === 'number' && profSign
        ? [
          `ANNUAL PROFECTION (as of ${todayIso}):`,
          `- Age: ${age}`,
          `- Profection year: ${profYear}`,
          `- Profected sign: ${profSign}`,
          `- Lord of Year: ${lordOfYear || 'Unknown'}`,
          `- Profected 5th sign: ${prof5} (ruler: ${westernRuler[prof5!] || 'Unknown'})`,
          `- Profected 7th sign: ${prof7} (ruler: ${westernRuler[prof7!] || 'Unknown'})`,
        ].join('\n')
        : `ANNUAL PROFECTION: Unknown (birthDate missing/invalid)`;

    return [
      `${name.toUpperCase()} WESTERN (TROPICAL) CHART (SWISS EPHEMERIS):`,
      `- Ascendant: ${asc}`,
      `- MC: ${mc}`,
      sect ? `- Sect: ${sect}` : null,
      '',
      'PLANETS (tropical):',
      planetLines || '- (no planet data)',
      '',
      'NODES (mean):',
      nodeLines,
      '',
      'HOUSE CUSPS (Placidus):',
      cuspLines || '- (no house data)',
      '',
      'MAJOR ASPECTS (orb <= 5°):',
      aspectLines || '- (no major aspects within orb)',
      '',
      profectionBlock,
      '',
      t.transits?.calculatedAt ? `CURRENT TRANSITS (UTC as of ${t.transits.calculatedAt}):` : 'CURRENT TRANSITS:',
      transitPlanetLines || '- (no transit data)',
      '',
      'TRANSIT ASPECTS TO NATAL (orb <= 5°):',
      transitAspectLines || '- (no major transit aspects within orb)',
    ]
      .filter(Boolean)
      .join('\n');
  };

  // Local helper: degrees object for a longitude number using the same sign set as above.
  function toDegreesObj(longitude: number): { sign: string; degree: number; minute: number } {
    const normalized = (longitude % 360 + 360) % 360;
    const signs = [
      'Aries',
      'Taurus',
      'Gemini',
      'Cancer',
      'Leo',
      'Virgo',
      'Libra',
      'Scorpio',
      'Sagittarius',
      'Capricorn',
      'Aquarius',
      'Pisces',
    ];
    const sign = signs[Math.floor(normalized / 30) % 12] || 'Unknown';
    const degreeInSign = normalized % 30;
    const degree = Math.floor(degreeInSign);
    const minute = Math.floor((degreeInSign - degree) * 60);
    return { sign, degree, minute };
  }

  switch (system) {
    case 'western':
      if (!hasP2) {
        return buildWesternSection(person1Name, p1Placements, p1BirthData);
      }

      return `${buildWesternSection(person1Name, p1Placements, p1BirthData)}\n\n${buildWesternSection(person2Name!, p2Placements!, p2BirthData!)}`;

    case 'vedic': {
      const p1Sid = p1Placements?.sidereal;
      const p2Sid = hasP2 ? p2Placements?.sidereal : null;

      if (!p1Sid || !Number.isFinite(p1Sid.sunLongitude)) {
        throw new Error(`Sidereal (Vedic) data missing for ${person1Name}. Please check Swiss Ephemeris configuration.`);
      }

      if (hasP2 && (!p2Sid || !Number.isFinite(p2Sid.sunLongitude))) {
        throw new Error(`Sidereal (Vedic) data missing for ${person2Name}. Please check Swiss Ephemeris configuration.`);
      }

      const p1SunSidereal = p1Sid.sunLongitude as number;
      const p1MoonSidereal = p1Sid.moonLongitude as number;
      const p1AscSidereal = p1Sid.ascendantLongitude as number;
      const p1RahuSidereal = Number.isFinite(p1Sid?.rahuLongitude) ? (p1Sid.rahuLongitude as number) : null;
      const p1KetuSidereal = Number.isFinite(p1Sid?.ketuLongitude) ? (p1Sid.ketuLongitude as number) : null;

      const p1LagnaSign = getZodiacSign(p1AscSidereal);
      const p1SunSign = getZodiacSign(p1SunSidereal);
      const p1MoonSign = getZodiacSign(p1MoonSidereal);
      const p1SunNak = getNakshatra(p1SunSidereal);
      const p1MoonNak = getNakshatra(p1MoonSidereal);

      if (!hasP2) {
        return [
          `CHART DATA (SIDEREAL - LAHIRI AYANAMSA):`,
          `${person1Name.toUpperCase()} VEDIC CHART:`,
          `- Lagna (Ascendant): ${p1LagnaSign} (${(p1AscSidereal % 30).toFixed(2)}°)`,
          `- Sun: ${p1SunSign} (${(p1SunSidereal % 30).toFixed(2)}°) | Nakshatra: ${p1SunNak}`,
          `- Moon: ${p1MoonSign} (${(p1MoonSidereal % 30).toFixed(2)}°) | Nakshatra: ${p1MoonNak}`,
          p1RahuSidereal != null ? `- Rahu: ${getZodiacSign(p1RahuSidereal)} (${(p1RahuSidereal % 30).toFixed(2)}°)` : '',
          p1KetuSidereal != null ? `- Ketu: ${getZodiacSign(p1KetuSidereal)} (${(p1KetuSidereal % 30).toFixed(2)}°)` : '',
          '',
          `NOTE: Use dashas, navamsha, and nakshatra logic. Do not use tropical assumptions.`,
        ].filter(Boolean).join('\n');
      }

      const p2SunSidereal = (p2Sid!.sunLongitude as number);
      const p2MoonSidereal = (p2Sid!.moonLongitude as number);
      const p2AscSidereal = (p2Sid!.ascendantLongitude as number);
      const p2RahuSidereal = Number.isFinite(p2Sid?.rahuLongitude) ? (p2Sid!.rahuLongitude as number) : null;
      const p2KetuSidereal = Number.isFinite(p2Sid?.ketuLongitude) ? (p2Sid!.ketuLongitude as number) : null;

      return [
        `CHART DATA (SIDEREAL - LAHIRI AYANAMSA):`,
        `${person1Name.toUpperCase()} VEDIC CHART:`,
        `- Lagna (Ascendant): ${getZodiacSign(p1AscSidereal)} (${(p1AscSidereal % 30).toFixed(2)}°)`,
        `- Sun: ${getZodiacSign(p1SunSidereal)} (${(p1SunSidereal % 30).toFixed(2)}°) | Nakshatra: ${getNakshatra(p1SunSidereal)}`,
        `- Moon: ${getZodiacSign(p1MoonSidereal)} (${(p1MoonSidereal % 30).toFixed(2)}°) | Nakshatra: ${getNakshatra(p1MoonSidereal)}`,
        p1RahuSidereal != null ? `- Rahu: ${getZodiacSign(p1RahuSidereal)} (${(p1RahuSidereal % 30).toFixed(2)}°)` : '',
        p1KetuSidereal != null ? `- Ketu: ${getZodiacSign(p1KetuSidereal)} (${(p1KetuSidereal % 30).toFixed(2)}°)` : '',
        '',
        `${person2Name!.toUpperCase()} VEDIC CHART:`,
        `- Lagna (Ascendant): ${getZodiacSign(p2AscSidereal)} (${(p2AscSidereal % 30).toFixed(2)}°)`,
        `- Sun: ${getZodiacSign(p2SunSidereal)} (${(p2SunSidereal % 30).toFixed(2)}°) | Nakshatra: ${getNakshatra(p2SunSidereal)}`,
        `- Moon: ${getZodiacSign(p2MoonSidereal)} (${(p2MoonSidereal % 30).toFixed(2)}°) | Nakshatra: ${getNakshatra(p2MoonSidereal)}`,
        p2RahuSidereal != null ? `- Rahu: ${getZodiacSign(p2RahuSidereal)} (${(p2RahuSidereal % 30).toFixed(2)}°)` : '',
        p2KetuSidereal != null ? `- Ketu: ${getZodiacSign(p2KetuSidereal)} (${(p2KetuSidereal % 30).toFixed(2)}°)` : '',
        '',
        `NOTE: Use dashas, navamsha, and nakshatra logic. Do not use tropical assumptions.`,
      ].filter(Boolean).join('\n');
    }

    case 'human_design': {
      // Use Swiss-derived sun longitude for gate mapping (fallback to sign+degree if missing).
      const p1Gate = getHDGate(p1SunDeg);
      const p2Gate = hasP2 ? getHDGate(p2SunDeg) : 0;

      if (!hasP2) {
        return `${person1Name.toUpperCase()} HUMAN DESIGN:\n` +
          `- Type: ${p1Placements?.humanDesign?.type || 'Unknown'}\n` +
          `- Authority: ${p1Placements?.humanDesign?.authority || 'Unknown'}\n` +
          `- Profile: ${p1Placements?.humanDesign?.profile || 'Unknown'}\n` +
          `- Sun Gate (approx): ${p1Gate}\n` +
          `- Defined Centers: ${(p1Placements?.humanDesign?.definedCenters || []).join(', ') || 'Unknown'}`;
      }

      return `${person1Name.toUpperCase()} HUMAN DESIGN:\n` +
        `- Type: ${p1Placements?.humanDesign?.type || 'Unknown'}\n` +
        `- Authority: ${p1Placements?.humanDesign?.authority || 'Unknown'}\n` +
        `- Profile: ${p1Placements?.humanDesign?.profile || 'Unknown'}\n` +
        `- Sun Gate (approx): ${p1Gate}\n` +
        `- Defined Centers: ${(p1Placements?.humanDesign?.definedCenters || []).join(', ') || 'Unknown'}\n\n` +
        `${person2Name!.toUpperCase()} HUMAN DESIGN:\n` +
        `- Type: ${p2Placements?.humanDesign?.type || 'Unknown'}\n` +
        `- Authority: ${p2Placements?.humanDesign?.authority || 'Unknown'}\n` +
        `- Profile: ${p2Placements?.humanDesign?.profile || 'Unknown'}\n` +
        `- Sun Gate (approx): ${p2Gate}\n` +
        `- Defined Centers: ${(p2Placements?.humanDesign?.definedCenters || []).join(', ') || 'Unknown'}`;
    }

    case 'gene_keys': {
      const p1GK = p1Placements?.geneKeys;
      const p2GK = hasP2 ? p2Placements?.geneKeys : null;

      if (!hasP2) {
        return `${person1Name.toUpperCase()} GENE KEYS:\n` +
          `- Life's Work: ${p1GK?.lifesWork?.geneKey}.${p1GK?.lifesWork?.line}\n` +
          `- Evolution: ${p1GK?.evolution?.geneKey}.${p1GK?.evolution?.line}\n` +
          `- Radiance: ${p1GK?.radiance?.geneKey}.${p1GK?.radiance?.line}\n` +
          `- Purpose: ${p1GK?.purpose?.geneKey}.${p1GK?.purpose?.line}`;
      }

      return `${person1Name.toUpperCase()} GENE KEYS:\n` +
        `- Life's Work: ${p1GK?.lifesWork?.geneKey}.${p1GK?.lifesWork?.line}\n` +
        `- Evolution: ${p1GK?.evolution?.geneKey}.${p1GK?.evolution?.line}\n` +
        `- Radiance: ${p1GK?.radiance?.geneKey}.${p1GK?.radiance?.line}\n` +
        `- Purpose: ${p1GK?.purpose?.geneKey}.${p1GK?.purpose?.line}\n\n` +
        `${person2Name!.toUpperCase()} GENE KEYS:\n` +
        `- Life's Work: ${p2GK?.lifesWork?.geneKey}.${p2GK?.lifesWork?.line}\n` +
        `- Evolution: ${p2GK?.evolution?.geneKey}.${p2GK?.evolution?.line}\n` +
        `- Radiance: ${p2GK?.radiance?.geneKey}.${p2GK?.radiance?.line}\n` +
        `- Purpose: ${p2GK?.purpose?.geneKey}.${p2GK?.purpose?.line}`;
    }

    case 'kabbalah': {
      const buildKabbalahBlock = (name: string, placements: any, birthData: { birthDate: string; birthTime: string; timezone?: string; birthPlace?: string }) => {
        const profile = placements?.kabbalahProfile;
        if (!profile) {
          // Fallback (should be rare): keep it minimal to avoid LLM drifting into gematria.
          return `${name.toUpperCase()} KABBALAH:\n` +
            `- Birth Date: ${birthData.birthDate} ${birthData.birthTime} (${birthData.timezone || 'UTC'})\n` +
            `NOTE: Kabbalah profile missing. Do not use name-based gematria or transliteration.`;
        }

        const hd = profile.hebrewDate;
        const t = profile.tikkun;

        const strong = (profile.sefiroticProfile?.dominant || []).filter((d: any) => d.strength === 'strong');
        const moderate = (profile.sefiroticProfile?.dominant || []).filter((d: any) => d.strength === 'moderate');
        const weak = (profile.sefiroticProfile?.dominant || []).filter((d: any) => d.strength === 'weak');
        const voidSef = profile.sefiroticProfile?.void || [];

        const fmtDom = (d: any) => {
          const house = typeof d.house === 'number' ? ` (House ${d.house})` : '';
          return `- ${d.sefirah} via ${String(d.planet).toUpperCase()} in ${d.sign}${house} | strength=${d.strength} | letter=${d.hebrewLetter} (${d.duality?.positive}/${d.duality?.negative})`;
        };

        const fw = profile.fourWorlds;
        const fwLines = fw
          ? [
            `- Atziluth (Fire/Spirit): ${fw.atziluth.count}/7 (${fw.atziluth.percentage}%) planets=${(fw.atziluth.planets || []).join(', ') || 'none'}`,
            `- Beriah (Water/Emotion): ${fw.beriah.count}/7 (${fw.beriah.percentage}%) planets=${(fw.beriah.planets || []).join(', ') || 'none'}`,
            `- Yetzirah (Air/Mind): ${fw.yetzirah.count}/7 (${fw.yetzirah.percentage}%) planets=${(fw.yetzirah.planets || []).join(', ') || 'none'}`,
            `- Assiyah (Earth/Body): ${fw.assiyah.count}/7 (${fw.assiyah.percentage}%) planets=${(fw.assiyah.planets || []).join(', ') || 'none'}`,
            `- Dominant World: ${fw.dominant}`,
            `- Void Worlds: ${(fw.void || []).join(', ') || 'none'}`,
          ].join('\n')
          : '- Four Worlds: Unknown';

        const ls = profile.letterSignature;
        const lsLines = ls
          ? [
            `- Sun Letter: ${ls.sunLetter.letter} (${ls.sunLetter.name}) faculty=${ls.sunLetter.faculty}`,
            `- Moon Letter: ${ls.moonLetter.letter} (${ls.moonLetter.name}) faculty=${ls.moonLetter.faculty}`,
            `- Rising Letter: ${ls.risingLetter.letter} (${ls.risingLetter.name}) faculty=${ls.risingLetter.faculty}`,
            `- Active Letters: ${(ls.allActiveLetters || []).map((x: any) => `${x.letter}(${x.name})[${x.type}:${String(x.planet).toUpperCase()}]`).join(', ') || 'none'}`,
          ].join('\n')
          : '- Letter Signature: Unknown';

        const kp = profile.klipothicProfile;
        const kpLines = kp
          ? [
            `- Primary Shadow Axis: ${kp.primaryShadowAxis}`,
            `- Active Klipoth: ${(kp.activeKlipoth || []).map((k: any) => `${k.sefirah}:${k.klipahName} (trigger=${k.trigger})`).join(' | ') || 'none'}`,
            `- Hard Aspects: ${(kp.hardAspects || []).map((a: any) => `${a.planet1} ${a.type} ${a.planet2} (orb ${a.orb})`).join(' | ') || 'none'}`,
          ].join('\n')
          : '- Klipoth: Unknown';

        const transitWeather = (() => {
          const transits = placements?.tropical?.transits;
          const aspectsToNatal = transits?.aspectsToNatal || [];
          if (!transits || !Array.isArray(aspectsToNatal) || aspectsToNatal.length === 0) {
            return '- Current spiritual weather: Unknown';
          }

          const classical = new Set(['SUN', 'MOON', 'MERCURY', 'VENUS', 'MARS', 'JUPITER', 'SATURN']);
          const planetToSefirah = new Map<string, string>();
          for (const d of profile.sefiroticProfile?.dominant || []) {
            if (d?.planet && d?.sefirah) planetToSefirah.set(String(d.planet).toLowerCase(), String(d.sefirah));
          }

          const lines = aspectsToNatal
            .filter((a: any) => typeof a?.transit === 'string' && typeof a?.natal === 'string')
            .filter((a: any) => a.transit.startsWith('T_'))
            .filter((a: any) => classical.has(String(a.natal).toUpperCase()) && classical.has(String(a.transit).slice(2).toUpperCase()))
            .sort((a: any, b: any) => (Number(a.orb) || 999) - (Number(b.orb) || 999))
            .slice(0, 16)
            .map((a: any) => {
              const tPlanet = String(a.transit).replace(/^T_/, '').toLowerCase();
              const nPlanet = String(a.natal).toLowerCase();
              const tSef = planetToSefirah.get(tPlanet) || '?';
              const nSef = planetToSefirah.get(nPlanet) || '?';
              const orb = Number.isFinite(Number(a.orb)) ? `${Number(a.orb).toFixed(2)}°` : '?';
              return `- ${a.transit}(${tSef}) ${String(a.type).toUpperCase()} ${a.natal}(${nSef}) orb=${orb}${a.exact ? ' exact' : ''}`;
            });

          return [
            `- Calculated At: ${transits.calculatedAt || 'Unknown'}`,
            ...lines,
          ].join('\n');
        })();

        const mb = profile.modalityBalance;
        const mbLine = mb
          ? `- Cardinal=${mb.cardinal} Fixed=${mb.fixed} Mutable=${mb.mutable} (dominant=${mb.dominant})`
          : '- Modality: Unknown';

        const bal = profile.sefiroticProfile?.balance;
        const balLine = bal
          ? `- Pillar Balance: Mercy=${bal.pillarOfMercy} Severity=${bal.pillarOfSeverity} Middle=${bal.middlePillar} | UpperTree=${bal.upperTree} LowerTree=${bal.lowerTree} HeartCenter=${bal.heartCenter}`
          : '- Pillar Balance: Unknown';

        return [
          `${name.toUpperCase()} KABBALAH PROFILE (V2):`,
          `HEBREW BIRTH DATE:`,
          `- ${hd?.day ?? '?'} ${hd?.month ?? '?'} ${hd?.year ?? '?'} (${hd?.weekday ?? 'Unknown'})${hd?.specialDay ? ` | ${hd.specialDay}` : ''}`,
          ``,
          `TIKKUN (SOUL CORRECTION):`,
          `- Hebrew Month: ${t?.hebrewBirthMonth ?? 'Unknown'}`,
          `- Tikkun Name: ${t?.tikkunName ?? 'Unknown'}`,
          `- Correction: ${t?.correction ?? 'Unknown'}`,
          `- Trap: ${t?.trap ?? 'Unknown'}`,
          `- Gift: ${t?.gift ?? 'Unknown'}`,
          `- Associated Sign: ${t?.zodiacSign ?? 'Unknown'}`,
          `- Letter: ${t?.hebrewLetter ?? ''}`,
          `- Tribe: ${t?.tribe ?? ''}`,
          ``,
          `SEFIROTIC STRUCTURE:`,
          strong.length ? `DOMINANT (STRONG):\n${strong.map(fmtDom).join('\n')}` : 'DOMINANT (STRONG): none',
          moderate.length ? `MODERATE:\n${moderate.map(fmtDom).join('\n')}` : 'MODERATE: none',
          weak.length ? `WEAK/UNDERDEVELOPED:\n${weak.map(fmtDom).join('\n')}` : 'WEAK/UNDERDEVELOPED: none',
          `VOID/DEFICIENT SEFIROT: ${voidSef.join(', ') || 'none'}`,
          balLine,
          ``,
          `FOUR WORLDS (ELEMENT BALANCE):`,
          fwLines,
          ``,
          `LETTER SIGNATURE (SEFER YETZIRAH):`,
          lsLines,
          ``,
          `KLIPOTHIC RISK PROFILE:`,
          kpLines,
          ``,
          `CURRENT SPIRITUAL WEATHER (NOW):`,
          transitWeather,
          ``,
          `MODALITY BALANCE:`,
          mbLine,
          ``,
          `POLICY: No name-based gematria or Hebrew transliteration of names. Evidence must come from this profile.`,
        ].join('\n');
      };

      if (!hasP2) {
        return buildKabbalahBlock(person1Name, p1Placements, p1BirthData);
      }

      return [
        buildKabbalahBlock(person1Name, p1Placements, p1BirthData),
        '',
        buildKabbalahBlock(person2Name!, p2Placements, p2BirthData!),
      ].join('\n');
    }

    default:
      if (!hasP2) {
        return `Birth Data for ${person1Name}: ${p1BirthData.birthDate} at ${p1BirthData.birthTime}`;
      }
      return `Birth Data for ${person1Name}: ${p1BirthData.birthDate} at ${p1BirthData.birthTime}\n` +
        `Birth Data for ${person2Name}: ${p2BirthData!.birthDate} at ${p2BirthData!.birthTime}`;
  }
}
