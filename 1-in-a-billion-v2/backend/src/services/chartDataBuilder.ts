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

      const vedicRuler: Record<string, string> = {
        Aries: 'mars', Taurus: 'venus', Gemini: 'mercury', Cancer: 'moon',
        Leo: 'sun', Virgo: 'mercury', Libra: 'venus', Scorpio: 'mars',
        Sagittarius: 'jupiter', Capricorn: 'saturn', Aquarius: 'saturn', Pisces: 'jupiter',
      };
      const exaltation: Record<string, string> = {
        sun: 'Aries', moon: 'Taurus', mars: 'Capricorn', mercury: 'Virgo',
        jupiter: 'Cancer', venus: 'Pisces', saturn: 'Libra', rahu: 'Taurus', ketu: 'Scorpio',
      };
      const debilitation: Record<string, string> = {
        sun: 'Libra', moon: 'Scorpio', mars: 'Cancer', mercury: 'Pisces',
        jupiter: 'Capricorn', venus: 'Virgo', saturn: 'Aries', rahu: 'Scorpio', ketu: 'Taurus',
      };
      const moolatrikona: Record<string, string> = {
        sun: 'Leo', moon: 'Taurus', mars: 'Aries', mercury: 'Virgo',
        jupiter: 'Sagittarius', venus: 'Libra', saturn: 'Aquarius',
      };
      const getVedicDignity = (grahaKey: string, sign: string): string => {
        if (exaltation[grahaKey] === sign) return 'uchcha';
        if (debilitation[grahaKey] === sign) return 'neecha';
        if (moolatrikona[grahaKey] === sign) return 'moolatrikona';
        const ruler = vedicRuler[sign];
        if (ruler === grahaKey) return 'svakshetra';
        return 'neutral';
      };
      const grahaDisplayName: Record<string, string> = {
        sun: 'Surya (Sun)', moon: 'Chandra (Moon)', mars: 'Mangal (Mars)',
        mercury: 'Budha (Mercury)', jupiter: 'Guru (Jupiter)', venus: 'Shukra (Venus)',
        saturn: 'Shani (Saturn)', rahu: 'Rahu', ketu: 'Ketu',
      };

      const buildVedicBlock = (
        name: string,
        placements: any,
        birthData: { birthDate: string; birthTime: string; timezone?: string; birthPlace?: string }
      ): string => {
        const sid = placements?.sidereal;
        if (!sid) {
          return `${name.toUpperCase()} VEDIC CHART:\n- Sidereal data unavailable`;
        }

        const now = new Date();
        const age = getAgeYears(birthData.birthDate, now);
        const grahas: any[] = (sid.grahas || []).filter((g: any) => !g.isTrueNode);

        const grahaLines = grahas.map((g: any) => {
          const nak = getNakshatra(g.longitude);
          const dignity = getVedicDignity(g.key, g.sign);
          const dignityTag = dignity !== 'neutral' ? ` [${dignity}]` : '';
          const retroTag = g.retrograde ? ' Rx' : '';
          const mm = String(g.minute ?? 0).padStart(2, '0');
          const padaNum = g.pada ? ` pada ${g.pada}` : '';
          const displayName = grahaDisplayName[g.key] || g.key;
          return `- ${displayName}: ${g.sign} ${g.degree}° ${mm}' | Bhava ${g.bhava} | Nakshatra: ${nak}${padaNum}${dignityTag}${retroTag}`;
        });

        const bhavaMap: Record<number, string[]> = {};
        for (const g of grahas) {
          if (!bhavaMap[g.bhava]) bhavaMap[g.bhava] = [];
          bhavaMap[g.bhava].push(grahaDisplayName[g.key] || g.key);
        }
        const occupiedBhavas = Object.entries(bhavaMap)
          .sort(([a], [b]) => Number(a) - Number(b))
          .map(([bh, gs]) => `- Bhava ${bh}: ${gs.join(', ')}`)
          .join('\n');

        const pressurized = Object.entries(bhavaMap)
          .filter(([, gs]) => gs.length >= 2)
          .map(([bh, gs]) => `Bhava ${bh} (${gs.length} grahas: ${gs.join(', ')})`);

        const angulars = [1, 4, 7, 10];
        const emptyAngulars = angulars.filter((b) => !bhavaMap[b]);

        const lagnaSign = sid.lagnaSign;
        const lagnaLordKey = vedicRuler[lagnaSign] || 'unknown';
        const lagnaLordGraha = grahas.find((g: any) => g.key === lagnaLordKey);
        const lagnaLordLine = lagnaLordGraha
          ? `- Lagna Lord (${grahaDisplayName[lagnaLordKey]}): ${lagnaLordGraha.sign} Bhava ${lagnaLordGraha.bhava} [${getVedicDignity(lagnaLordKey, lagnaLordGraha.sign)}]`
          : `- Lagna Lord: ${lagnaLordKey} (position unknown)`;

        const signArray = ['Aries', 'Taurus', 'Gemini', 'Cancer', 'Leo', 'Virgo',
          'Libra', 'Scorpio', 'Sagittarius', 'Capricorn', 'Aquarius', 'Pisces'];
        const lagnaIdx = signArray.indexOf(lagnaSign);
        const sign7 = lagnaIdx >= 0 ? signArray[(lagnaIdx + 6) % 12] : 'Unknown';
        const lord7key = vedicRuler[sign7] || 'unknown';
        const lord7graha = grahas.find((g: any) => g.key === lord7key);
        const occupants7 = (bhavaMap[7] || []).join(', ') || 'empty';

        return [
          `${name.toUpperCase()} VEDIC CHART (SIDEREAL - LAHIRI AYANAMSA):`,
          `- Birth: ${birthData.birthDate} at ${birthData.birthTime} (${birthData.timezone || 'UTC'})`,
          birthData.birthPlace ? `- Place: ${birthData.birthPlace}` : '',
          age != null ? `- Current Age: ${age}` : '',
          `- Ayanamsa: ${sid.ayanamsaName || 'Lahiri'}`,
          '',
          `LAGNA:`,
          `- Lagna (Ascendant): ${lagnaSign} (${(sid.ascendantLongitude % 30).toFixed(2)}°)`,
          lagnaLordLine,
          '',
          `CHANDRA:`,
          `- Chandra Rashi: ${sid.chandraRashi}`,
          `- Janma Nakshatra: ${sid.janmaNakshatra} pada ${sid.janmaPada}`,
          '',
          `GRAHA POSITIONS:`,
          grahaLines.join('\n'),
          '',
          `BHAVA OCCUPANCY (whole-sign houses from Lagna):`,
          occupiedBhavas,
          '',
          pressurized.length > 0
            ? `PRESSURIZED BHAVAS (2+ grahas): ${pressurized.join('; ')}`
            : 'PRESSURIZED BHAVAS: none',
          emptyAngulars.length > 0
            ? `EMPTY ANGULAR BHAVAS: ${emptyAngulars.join(', ')}`
            : 'EMPTY ANGULAR BHAVAS: none (all angular bhavas occupied)',
          '',
          `7TH BHAVA (PARTNERSHIPS):`,
          `- Sign on 7th: ${sign7}`,
          `- 7th Lord (${grahaDisplayName[lord7key] || lord7key}): ${lord7graha ? `${lord7graha.sign} Bhava ${lord7graha.bhava} [${getVedicDignity(lord7key, lord7graha.sign)}]` : 'position unknown'}`,
          `- Occupants of 7th: ${occupants7}`,
          '',
          (() => {
            const d = placements.vimshottariDasha;
            if (!d) return 'VIMSHOTTARI DASHA: Not computed.';
            const maha = d.mahadasha;
            const antar = d.antardasha;
            const sequence = (d.allMahadashas || [])
              .map((m: any) => `  ${m.isCurrent ? '▶' : ' '} ${m.lord} (${m.years}yr) ${m.startDate} → ${m.endDate}`)
              .join('\n');
            return [
              `VIMSHOTTARI DASHA:`,
              `- Current Mahadasha: ${maha.lord} (${maha.years} years) — ${maha.startDate} to ${maha.endDate}`,
              `- Current Antardasha: ${maha.lord} / ${antar.lord} — ${antar.startDate} to ${antar.endDate}`,
              ``,
              `FULL DASHA SEQUENCE:`,
              sequence,
            ].join('\n');
          })(),
          '',
          (() => {
            const nav = placements.navamsha;
            if (!nav) return 'NAVAMSHA (D-9): Not computed.';
            const grahaLines = (nav.grahas || [])
              .map((g: any) => `- ${grahaDisplayName[g.key] || g.key}: ${g.navamshaSign}`)
              .join('\n');
            return [
              `NAVAMSHA (D-9) — Hidden partnership self:`,
              `- Navamsha Lagna: ${nav.lagnaSign}`,
              grahaLines,
            ].join('\n');
          })(),
        ].filter(Boolean).join('\n');
      };

      if (!hasP2) {
        return buildVedicBlock(person1Name, p1Placements, p1BirthData);
      }

      return [
        buildVedicBlock(person1Name, p1Placements, p1BirthData),
        '',
        buildVedicBlock(person2Name!, p2Placements!, p2BirthData!),
      ].join('\n');
    }

    case 'human_design': {
      // Channel name lookup (mirrors HD_CHANNELS in humanDesignCalculator.ts)
      const CHANNEL_NAMES: Record<string, string> = {
        '1-8': 'Inspiration', '2-14': 'The Beat', '3-60': 'Mutation',
        '4-63': 'Logic', '5-15': 'Rhythm', '6-59': 'Intimacy',
        '7-31': 'The Alpha', '9-52': 'Concentration', '10-20': 'Awakening',
        '10-34': 'Exploration', '10-57': 'Survival', '11-56': 'Curiosity',
        '12-22': 'Openness', '13-33': 'The Prodigal', '16-48': 'Talent',
        '17-62': 'Acceptance', '18-58': 'Judgment', '19-49': 'Sensitivity',
        '20-34': 'Charisma', '21-45': 'Money Line', '23-43': 'Structuring',
        '24-61': 'Awareness', '25-51': 'Initiation', '26-44': 'Transmission',
        '27-50': 'Preservation', '28-38': 'Struggle', '29-46': 'Discovery',
        '30-41': 'Recognition', '32-54': 'Transformation', '34-57': 'Power',
        '35-36': 'Transitoriness', '37-40': 'Community', '39-55': 'Emoting',
        '42-53': 'Maturation', '47-64': 'Abstraction',
      };

      const ALL_CENTERS = ['Head', 'Ajna', 'Throat', 'G', 'Heart', 'Spleen', 'Solar Plexus', 'Sacral', 'Root'];

      const buildHDBlock = (name: string, placements: any): string => {
        const hd = placements?.humanDesign;
        if (!hd) return `${name.toUpperCase()} HUMAN DESIGN:\n- Human Design data unavailable`;

        const definedCenters: string[] = hd.definedCenters || [];
        const openCenters = ALL_CENTERS.filter(c => !definedCenters.includes(c));

        const channelLines = (hd.activeChannels || []).map((id: string) => {
          const name = CHANNEL_NAMES[id] || id;
          return `- Channel ${id}: ${name}`;
        }).join('\n') || '- None';

        const fmtActivation = (planet: string, pos: { gate: number; line: number } | undefined) =>
          pos?.gate ? `${planet.padEnd(10)} Gate ${pos.gate}.${pos.line}` : null;

        const pKeys = ['sun', 'earth', 'moon', 'northNode', 'southNode', 'mercury', 'venus', 'mars', 'jupiter', 'saturn', 'uranus', 'neptune', 'pluto'];

        const personalityLines = pKeys
          .map(k => fmtActivation(k, hd.personality?.[k]))
          .filter(Boolean)
          .map(l => `- ${l}`)
          .join('\n') || '- Unknown';

        const designLines = pKeys
          .map(k => fmtActivation(k, hd.design?.[k]))
          .filter(Boolean)
          .map(l => `- ${l}`)
          .join('\n') || '- Unknown';

        return [
          `${name.toUpperCase()} HUMAN DESIGN:`,
          `- Type: ${hd.type || 'Unknown'}`,
          `- Strategy: ${hd.strategy || 'Unknown'}`,
          `- Authority: ${hd.authority || 'Unknown'}`,
          `- Profile: ${hd.profile || 'Unknown'}`,
          `- Definition: ${hd.definition || 'Unknown'}`,
          `- Incarnation Cross: ${hd.incarnationCross || 'Unknown'}`,
          '',
          `DEFINED CENTERS (${definedCenters.length}): ${definedCenters.join(', ') || 'None'}`,
          `OPEN CENTERS (${openCenters.length}): ${openCenters.join(', ') || 'None'}`,
          '',
          `ACTIVE CHANNELS (${(hd.activeChannels || []).length}):`,
          channelLines,
          '',
          `ALL ACTIVE GATES: ${(hd.activeGates || []).sort((a: number, b: number) => a - b).join(', ') || 'Unknown'}`,
          '',
          'PERSONALITY ACTIVATIONS (Conscious — black):',
          personalityLines,
          '',
          'DESIGN ACTIVATIONS (Unconscious — red):',
          designLines,
        ].join('\n');
      };

      if (!hasP2) return buildHDBlock(person1Name, p1Placements);
      return [buildHDBlock(person1Name, p1Placements), '', buildHDBlock(person2Name!, p2Placements)].join('\n');
    }

    case 'gene_keys': {
      const p1GK = p1Placements?.geneKeys;
      const p2GK = hasP2 ? p2Placements?.geneKeys : null;

      const fmtSphere = (
        label: string,
        sphere: { geneKey: number; line: number; shadow: string; gift: string; siddhi: string } | undefined
      ): string => {
        if (!sphere?.geneKey) return `- ${label}: Unknown`;
        return `- ${label}: Key ${sphere.geneKey}.${sphere.line} | Shadow: ${sphere.shadow} | Gift: ${sphere.gift} | Siddhi: ${sphere.siddhi}`;
      };

      const buildGeneKeysBlock = (name: string, gk: typeof p1GK): string => {
        if (!gk) return `${name.toUpperCase()} GENE KEYS:\n- Gene Keys data unavailable`;

        const activationSeq = [
          fmtSphere("Life's Work (Conscious Sun)", gk.lifesWork),
          fmtSphere('Evolution (Conscious Earth)', gk.evolution),
          fmtSphere('Radiance (Design Sun)', gk.radiance),
          fmtSphere('Purpose (Design Earth)', gk.purpose),
        ].join('\n');

        const venusSeq = [
          gk.attraction ? fmtSphere('Attraction (Venus)', gk.attraction) : null,
          gk.iq ? fmtSphere('IQ / Intelligence (Design Mars)', gk.iq) : null,
          gk.eq ? fmtSphere('EQ / Emotional (Design Venus)', gk.eq) : null,
          gk.sq ? fmtSphere('SQ / Spiritual (Conscious Moon)', gk.sq) : null,
        ].filter(Boolean).join('\n');

        const pearlSeq = [
          gk.vocation ? fmtSphere('Vocation (Conscious Mars)', gk.vocation) : null,
          gk.culture ? fmtSphere('Culture (Design Jupiter)', gk.culture) : null,
          gk.pearl ? fmtSphere('Pearl (same as Life\'s Work)', gk.pearl) : null,
        ].filter(Boolean).join('\n');

        return [
          `${name.toUpperCase()} GENE KEYS (HOLOGENETIC PROFILE):`,
          '',
          'ACTIVATION SEQUENCE (Prime Gifts):',
          activationSeq,
          ...(venusSeq ? ['', 'VENUS SEQUENCE (Relational Gene Keys):', venusSeq] : []),
          ...(pearlSeq ? ['', 'PEARL SEQUENCE (Prosperity Gene Keys):', pearlSeq] : []),
        ].join('\n');
      };

      if (!hasP2) return buildGeneKeysBlock(person1Name, p1GK);
      return [buildGeneKeysBlock(person1Name, p1GK), '', buildGeneKeysBlock(person2Name!, p2GK)].join('\n');
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
