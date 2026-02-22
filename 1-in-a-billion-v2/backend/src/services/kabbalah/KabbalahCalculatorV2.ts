/**
 * KABBALISTIC ASTROLOGY CALCULATOR (V2)
 *
 * Purpose:
 * - Map Swiss Ephemeris tropical placements onto a Kabbalistic Tree-of-Life structure.
 * - Produce deterministic, specific "structure data" so the LLM cannot drift into generic mysticism.
 *
 * Notes:
 * - NO name-based gematria. No Hebrew transliteration of names.
 * - Uses a Sefer Yetzirah style mapping:
 *   - 7 double letters -> 7 classical planets -> lower sefirot
 *   - 12 simple letters -> zodiac signs (for the Sun/Moon/Rising letter triad + faculties)
 *   - elements -> Four Worlds balance
 */

import type { PlacementSummary } from '../swissEphemeris';
import type { HebrewDateInfo } from './HebrewCalendarService';

// ═══════════════════════════════════════════════════════════════════════════════
// SEFER YETZIRAH CORRESPONDENCE TABLES
// ═══════════════════════════════════════════════════════════════════════════════

const PLANET_SEFIRAH_MAP: Record<
  'saturn' | 'jupiter' | 'mars' | 'sun' | 'venus' | 'mercury' | 'moon',
  {
    sefirah: string;
    sefirahIndex: number; // 1=Keter ... 10=Malkuth
    hebrewLetter: string;
    letterName: string;
    duality: { positive: string; negative: string };
  }
> = {
  saturn: {
    sefirah: 'Binah',
    sefirahIndex: 3,
    hebrewLetter: 'ב',
    letterName: 'Bet',
    duality: { positive: 'Wisdom', negative: 'Folly' },
  },
  jupiter: {
    sefirah: 'Chesed',
    sefirahIndex: 4,
    hebrewLetter: 'ג',
    letterName: 'Gimel',
    duality: { positive: 'Wealth', negative: 'Poverty' },
  },
  mars: {
    sefirah: 'Gevurah',
    sefirahIndex: 5,
    hebrewLetter: 'ד',
    letterName: 'Dalet',
    duality: { positive: 'Fertility', negative: 'Desolation' },
  },
  sun: {
    sefirah: 'Tiferet',
    sefirahIndex: 6,
    hebrewLetter: 'כ',
    letterName: 'Kaf',
    duality: { positive: 'Life', negative: 'Death' },
  },
  venus: {
    sefirah: 'Netzach',
    sefirahIndex: 7,
    hebrewLetter: 'פ',
    letterName: 'Pe',
    duality: { positive: 'Grace', negative: 'Ugliness' },
  },
  mercury: {
    sefirah: 'Hod',
    sefirahIndex: 8,
    hebrewLetter: 'ר',
    letterName: 'Resh',
    duality: { positive: 'Seed', negative: 'Barrenness' },
  },
  moon: {
    sefirah: 'Yesod',
    sefirahIndex: 9,
    hebrewLetter: 'ת',
    letterName: 'Tav',
    duality: { positive: 'Dominion', negative: 'Subjugation' },
  },
};

const SIGN_LETTER_MAP: Record<
  string,
  {
    hebrewLetter: string;
    letterName: string;
    faculty: string;
    hebrewMonth: string;
    tribe: string;
  }
> = {
  Aries: { hebrewLetter: 'ה', letterName: 'He', faculty: 'Sight', hebrewMonth: 'Nisan', tribe: 'Judah' },
  Taurus: { hebrewLetter: 'ו', letterName: 'Vav', faculty: 'Hearing', hebrewMonth: 'Iyar', tribe: 'Issachar' },
  Gemini: { hebrewLetter: 'ז', letterName: 'Zayin', faculty: 'Smell', hebrewMonth: 'Sivan', tribe: 'Zebulun' },
  Cancer: { hebrewLetter: 'ח', letterName: 'Chet', faculty: 'Speech', hebrewMonth: 'Tammuz', tribe: 'Reuben' },
  Leo: { hebrewLetter: 'ט', letterName: 'Tet', faculty: 'Taste', hebrewMonth: 'Av', tribe: 'Simeon' },
  Virgo: { hebrewLetter: 'י', letterName: 'Yod', faculty: 'Sexual desire', hebrewMonth: 'Elul', tribe: 'Gad' },
  Libra: { hebrewLetter: 'ל', letterName: 'Lamed', faculty: 'Action/Work', hebrewMonth: 'Tishrei', tribe: 'Ephraim' },
  Scorpio: { hebrewLetter: 'נ', letterName: 'Nun', faculty: 'Motion/Walking', hebrewMonth: 'Cheshvan', tribe: 'Manasseh' },
  Sagittarius: { hebrewLetter: 'ס', letterName: 'Samekh', faculty: 'Anger', hebrewMonth: 'Kislev', tribe: 'Benjamin' },
  Capricorn: { hebrewLetter: 'ע', letterName: 'Ayin', faculty: 'Laughter/Joy', hebrewMonth: 'Tevet', tribe: 'Dan' },
  Aquarius: { hebrewLetter: 'צ', letterName: 'Tsade', faculty: 'Thought/Meditation', hebrewMonth: 'Shevat', tribe: 'Asher' },
  Pisces: { hebrewLetter: 'ק', letterName: 'Qof', faculty: 'Sleep/Dream', hebrewMonth: 'Adar', tribe: 'Naphtali' },
};

const SIGN_ELEMENT: Record<string, 'Fire' | 'Earth' | 'Air' | 'Water'> = {
  Aries: 'Fire',
  Leo: 'Fire',
  Sagittarius: 'Fire',
  Taurus: 'Earth',
  Virgo: 'Earth',
  Capricorn: 'Earth',
  Gemini: 'Air',
  Libra: 'Air',
  Aquarius: 'Air',
  Cancer: 'Water',
  Scorpio: 'Water',
  Pisces: 'Water',
};

const SIGN_MODALITY: Record<string, 'Cardinal' | 'Fixed' | 'Mutable'> = {
  Aries: 'Cardinal',
  Cancer: 'Cardinal',
  Libra: 'Cardinal',
  Capricorn: 'Cardinal',
  Taurus: 'Fixed',
  Leo: 'Fixed',
  Scorpio: 'Fixed',
  Aquarius: 'Fixed',
  Gemini: 'Mutable',
  Virgo: 'Mutable',
  Sagittarius: 'Mutable',
  Pisces: 'Mutable',
};

const TIKKUN_BY_MONTH: Record<
  string,
  { tikkun: string; correction: string; trap: string; gift: string }
> = {
  Nisan: {
    tikkun: 'Patience and Humility',
    correction: 'Learning to follow rather than always lead; tempering impulsive fire with reflective wisdom',
    trap: 'Tyranny disguised as leadership; rage when not in control; burning bridges before they are built',
    gift: 'Once patience is learned, becomes a leader who inspires rather than dominates',
  },
  Iyar: {
    tikkun: 'Releasing Stubbornness',
    correction: 'Letting go of material attachment as identity; learning that change is not death',
    trap: 'Petrification; holding onto dead forms; equating comfort with safety until stagnation becomes suffocation',
    gift: 'Unshakable foundation that can hold others; loyalty that nourishes rather than imprisons',
  },
  Sivan: {
    tikkun: 'Depth over Breadth',
    correction: 'Committing to one path instead of scattering across many; learning that depth requires staying',
    trap: 'Superficiality masquerading as versatility; betrayal through distraction; the inability to be truly known',
    gift: 'Bridges worlds, translates between realms, connects what was separate',
  },
  Tammuz: {
    tikkun: 'Emotional Independence',
    correction: 'Learning that nurturing others is not the same as losing yourself in them; boundaries as love',
    trap: 'Emotional vampirism disguised as care; manipulation through guilt; drowning in sensitivity',
    gift: 'Genuine nurturing that empowers rather than creates dependency',
  },
  Av: {
    tikkun: 'Humility within Power',
    correction: 'Using creative force to serve rather than to dominate; letting the ego become vessel, not throne',
    trap: 'Narcissism disguised as generosity; demanding worship; collapsing when not seen',
    gift: 'Radiant leadership that illuminates others without blinding them',
  },
  Elul: {
    tikkun: 'Self-Acceptance',
    correction: 'Releasing the compulsion to fix and perfect everything including oneself; embracing imperfection',
    trap: 'Criticism that destroys under the guise of improvement; paralysis through impossible standards',
    gift: 'Discernment that heals; the ability to see what is broken and mend it with love',
  },
  Tishrei: {
    tikkun: 'Decisive Action',
    correction: 'Choosing sides instead of perpetually balancing; learning that justice sometimes requires disruption',
    trap: 'Indecision disguised as fairness; peace-keeping that enables abuse; vanity masked as harmony',
    gift: 'True justice that restores balance through courageous action',
  },
  Cheshvan: {
    tikkun: 'Trust and Surrender',
    correction: 'Releasing the need to control through knowledge of others secrets; transforming jealousy into intimacy',
    trap: 'Possessiveness disguised as passion; using vulnerability as weapon; the scorpion stinging itself',
    gift: 'Alchemical transformation; the ability to walk through darkness and return with gold',
  },
  Kislev: {
    tikkun: 'Responsibility within Freedom',
    correction: 'Learning that true freedom includes commitment; that expansion without root is just escape',
    trap: 'Running disguised as seeking; promising everything, delivering nothing; spiritual tourism',
    gift: 'Visionary wisdom grounded in lived experience; teaching that comes from walking the path',
  },
  Tevet: {
    tikkun: 'Warmth within Structure',
    correction: 'Learning that discipline without love is cruelty; that ambition must serve something beyond itself',
    trap: 'Emotional coldness disguised as strength; using achievement to avoid intimacy; the empire built on loneliness',
    gift: 'The master builder who creates structures that shelter others, not just monuments to self',
  },
  Shevat: {
    tikkun: 'Embodiment',
    correction: 'Bringing visionary ideas into concrete reality; learning that the body is not beneath the mind',
    trap: 'Detachment disguised as transcendence; rebellion without cause; alienation mistaken for uniqueness',
    gift: 'Revolutionary insight that actually changes the world because it lands in matter',
  },
  Adar: {
    tikkun: 'Boundaries within Compassion',
    correction: 'Learning where self ends and other begins; that dissolving into another is not love but erasure',
    trap: 'Martyrdom disguised as service; addiction as spiritual seeking; losing self in the ocean of others',
    gift: 'Genuine mystical connection that does not require self-destruction; compassion with clarity',
  },
};

const KLIPOTH: Record<
  string,
  { name: string; meaning: string; shadow: string; manifestation: string }
> = {
  Keter: {
    name: 'Thaumiel',
    meaning: 'The Twin Gods / Divided Self',
    shadow: 'Spiritual pride; believing oneself to be God rather than a vessel of the divine',
    manifestation: 'Messianic delusion, spiritual narcissism, inability to surrender to anything greater',
  },
  Chokmah: {
    name: 'Ghagiel',
    meaning: 'The Hinderers',
    shadow: 'Wisdom perverted into manipulation; insight used to control rather than illuminate',
    manifestation: 'Intellectual domination, gaslighting, using spiritual knowledge as weapon',
  },
  Binah: {
    name: 'Satariel',
    meaning: 'The Concealers',
    shadow: 'Understanding that becomes rigidity; the mother who smothers; structure that imprisons',
    manifestation: 'Depression, excessive grief, inability to release the past, hoarding of form',
  },
  Chesed: {
    name: 'Gha Agsheblah',
    meaning: 'The Devourers',
    shadow: 'Mercy without limit becomes enabling; generosity that devours the giver and creates dependency',
    manifestation: 'Codependency, overgiving to the point of self-destruction, buying love',
  },
  Gevurah: {
    name: 'Golachab',
    meaning: 'The Burners',
    shadow: 'Severity without mercy becomes cruelty; judgment that destroys what it touches',
    manifestation: 'Rage, vindictiveness, punishing others for ones own wounds, self-punishment',
  },
  Tiferet: {
    name: 'Thagirion',
    meaning: 'The Disputers',
    shadow: 'Beauty perverted into vanity; the false self that performs harmony while hiding chaos',
    manifestation: 'Narcissism, image obsession, performing spirituality without substance',
  },
  Netzach: {
    name: 'Harab Serapel',
    meaning: 'The Ravens of Dispersion',
    shadow: 'Desire that scatters; passion without containment; lust that consumes without nourishing',
    manifestation: 'Addiction, obsessive desire, using pleasure to avoid pain, creative dissipation',
  },
  Hod: {
    name: 'Samael',
    meaning: 'The Poison of God',
    shadow: 'Intellect that poisons; analysis that paralyzes; communication that deceives',
    manifestation: 'Overthinking, lying, intellectual dishonesty, using words to obscure rather than reveal',
  },
  Yesod: {
    name: 'Gamaliel',
    meaning: 'The Obscene Ones',
    shadow: 'Foundation corrupted; sexuality disconnected from soul; the unconscious running the show',
    manifestation: 'Sexual compulsion, fantasy addiction, inability to be present, living in illusion',
  },
  Malkuth: {
    name: 'Lilith / Nahemoth',
    meaning: 'The Night Spectre',
    shadow: 'Disconnection from the body and the earth; materialism without spirit or spirit without grounding',
    manifestation: 'Dissociation, greed, sloth, inability to manifest, being stuck in matter',
  },
};

// ═══════════════════════════════════════════════════════════════════════════════
// ASPECT CALCULATION (for Klipothic stress detection)
// ═══════════════════════════════════════════════════════════════════════════════

export interface KabbalahAspect {
  planet1: string;
  planet2: string;
  type: 'conjunction' | 'opposition' | 'square' | 'trine' | 'sextile';
  orb: number;
  isHard: boolean;
}

const ASPECT_DEFINITIONS = [
  { name: 'conjunction' as const, angle: 0, orb: 8, isHard: false },
  { name: 'opposition' as const, angle: 180, orb: 8, isHard: true },
  { name: 'square' as const, angle: 90, orb: 7, isHard: true },
  { name: 'trine' as const, angle: 120, orb: 7, isHard: false },
  { name: 'sextile' as const, angle: 60, orb: 5, isHard: false },
];

function calculateAspects(planets: Record<string, number>): KabbalahAspect[] {
  const aspects: KabbalahAspect[] = [];
  const keys = Object.keys(planets);

  for (let i = 0; i < keys.length; i++) {
    for (let j = i + 1; j < keys.length; j++) {
      const p1 = keys[i]!;
      const p2 = keys[j]!;
      let diff = Math.abs(planets[p1]! - planets[p2]!);
      if (diff > 180) diff = 360 - diff;

      for (const def of ASPECT_DEFINITIONS) {
        const orb = Math.abs(diff - def.angle);
        if (orb <= def.orb) {
          aspects.push({
            planet1: p1,
            planet2: p2,
            type: def.name,
            orb: Math.round(orb * 100) / 100,
            isHard: def.isHard,
          });
          break;
        }
      }
    }
  }

  return aspects;
}

// ═══════════════════════════════════════════════════════════════════════════════
// PROFILE SHAPE
// ═══════════════════════════════════════════════════════════════════════════════

export interface KabbalahProfileV2 {
  sefiroticProfile: {
    dominant: Array<{
      sefirah: string;
      planet: string;
      sign: string;
      house?: number;
      strength: 'strong' | 'moderate' | 'weak';
      hebrewLetter: string;
      duality: { positive: string; negative: string };
    }>;
    void: string[];
    balance: {
      pillarOfMercy: number;
      pillarOfSeverity: number;
      middlePillar: number;
      upperTree: number;
      lowerTree: number;
      heartCenter: number;
    };
  };

  letterSignature: {
    sunLetter: { letter: string; name: string; faculty: string };
    moonLetter: { letter: string; name: string; faculty: string };
    risingLetter: { letter: string; name: string; faculty: string };
    allActiveLetters: Array<{ letter: string; name: string; planet: string; type: 'double' | 'simple' }>;
  };

  fourWorlds: {
    atziluth: { count: number; percentage: number; element: 'Fire'; planets: string[] };
    beriah: { count: number; percentage: number; element: 'Water'; planets: string[] };
    yetzirah: { count: number; percentage: number; element: 'Air'; planets: string[] };
    assiyah: { count: number; percentage: number; element: 'Earth'; planets: string[] };
    dominant: string;
    void: string[];
  };

  tikkun: {
    hebrewBirthMonth: string;
    tikkunName: string;
    correction: string;
    trap: string;
    gift: string;
    zodiacSign: string;
    hebrewLetter: string;
    tribe: string;
  };

  klipothicProfile: {
    activeKlipoth: Array<{
      sefirah: string;
      klipahName: string;
      meaning: string;
      shadow: string;
      manifestation: string;
      trigger: string;
    }>;
    hardAspects: KabbalahAspect[];
    primaryShadowAxis: string;
  };

  hebrewDate: HebrewDateInfo;

  modalityBalance: {
    cardinal: number;
    fixed: number;
    mutable: number;
    dominant: string;
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════════════════════

function getPlanetStrength(planet: string, sign: string): 'strong' | 'moderate' | 'weak' {
  const dignities: Record<
    string,
    { domicile: string[]; exaltation: string[]; detriment: string[]; fall: string[] }
  > = {
    sun: { domicile: ['Leo'], exaltation: ['Aries'], detriment: ['Aquarius'], fall: ['Libra'] },
    moon: { domicile: ['Cancer'], exaltation: ['Taurus'], detriment: ['Capricorn'], fall: ['Scorpio'] },
    mercury: { domicile: ['Gemini', 'Virgo'], exaltation: ['Virgo'], detriment: ['Sagittarius', 'Pisces'], fall: ['Pisces'] },
    venus: { domicile: ['Taurus', 'Libra'], exaltation: ['Pisces'], detriment: ['Scorpio', 'Aries'], fall: ['Virgo'] },
    mars: { domicile: ['Aries', 'Scorpio'], exaltation: ['Capricorn'], detriment: ['Libra', 'Taurus'], fall: ['Cancer'] },
    jupiter: { domicile: ['Sagittarius', 'Pisces'], exaltation: ['Cancer'], detriment: ['Gemini', 'Virgo'], fall: ['Capricorn'] },
    saturn: { domicile: ['Capricorn', 'Aquarius'], exaltation: ['Libra'], detriment: ['Cancer', 'Leo'], fall: ['Aries'] },
  };

  const d = dignities[planet];
  if (!d) return 'moderate';

  if (d.domicile.includes(sign) || d.exaltation.includes(sign)) return 'strong';
  if (d.detriment.includes(sign) || d.fall.includes(sign)) return 'weak';
  return 'moderate';
}

function normalizeHebrewMonth(month: string): string {
  const m = String(month || '').toLowerCase().trim();

  if (m.includes('nisan')) return 'Nisan';
  if (m.includes('iyar') || m.includes('iyyar')) return 'Iyar';
  if (m.includes('sivan') || m.includes('siwan')) return 'Sivan';
  if (m.includes('tammuz') || m.includes('tamuz')) return 'Tammuz';
  if (m.includes('av') || m == 'av' || m.includes('menachem')) return 'Av';
  if (m.includes('elul')) return 'Elul';
  if (m.includes('tishrei') || m.includes('tishri')) return 'Tishrei';
  if (m.includes('cheshvan') || m.includes('heshvan') || m.includes('marcheshvan')) return 'Cheshvan';
  if (m.includes('kislev') || m.includes('chislev')) return 'Kislev';
  if (m.includes('tevet') || m.includes('teves') || m.includes('teveth')) return 'Tevet';
  if (m.includes('shevat') || m.includes('shvat') || m.includes("sh'vat")) return 'Shevat';
  if (m.includes('adar')) return 'Adar';

  return month;
}

function determineKlipothicStress(aspects: KabbalahAspect[]): Array<{ sefirah: string; trigger: string }> {
  const stressed: Array<{ sefirah: string; trigger: string }> = [];

  for (const aspect of aspects) {
    if (!aspect.isHard) continue;

    const s1 = (PLANET_SEFIRAH_MAP as any)[aspect.planet1] as { sefirah: string } | undefined;
    const s2 = (PLANET_SEFIRAH_MAP as any)[aspect.planet2] as { sefirah: string } | undefined;

    if (s1) {
      stressed.push({
        sefirah: s1.sefirah,
        trigger: `${aspect.planet1} ${aspect.type} ${aspect.planet2} (orb ${aspect.orb} degrees)`,
      });
    }
    if (s2) {
      stressed.push({
        sefirah: s2.sefirah,
        trigger: `${aspect.planet2} ${aspect.type} ${aspect.planet1} (orb ${aspect.orb} degrees)`,
      });
    }
  }

  return stressed;
}

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN EXPORT
// ═══════════════════════════════════════════════════════════════════════════════

export function calculateKabbalahProfileV2(
  placements: PlacementSummary,
  hebrewDate: HebrewDateInfo,
): KabbalahProfileV2 {
  const t = placements.tropical;

  // Classical planets used for the Tree mapping.
  const wanted: Array<'sun' | 'moon' | 'mercury' | 'venus' | 'mars' | 'jupiter' | 'saturn'> = [
    'sun',
    'moon',
    'mercury',
    'venus',
    'mars',
    'jupiter',
    'saturn',
  ];

  const tropicalPlanets: Record<string, number> = {};
  const tropicalHouses: Record<string, number | undefined> = {};
  const tropicalSigns: Record<string, string> = {};

  if (t?.planets?.length) {
    for (const p of t.planets) {
      if (!wanted.includes(p.key as any)) continue;
      tropicalPlanets[p.key] = p.longitude;
      tropicalHouses[p.key] = p.house;
      tropicalSigns[p.key] = p.sign;
    }
  } else {
    // Fallback (should not happen in V2): only Sun/Moon are guaranteed.
    tropicalPlanets.sun = placements.sunLongitude;
    tropicalPlanets.moon = placements.moonLongitude;
    tropicalSigns.sun = placements.sunSign;
    tropicalSigns.moon = placements.moonSign;
    tropicalHouses.sun = placements.sunHouse;
    tropicalHouses.moon = placements.moonHouse;
  }

  // ─── Sefirotic Profile ──────────────────────────────────────────────────
  const sefiroticDominant: KabbalahProfileV2['sefiroticProfile']['dominant'] = [];
  const activatedSefirot = new Set<string>();

  for (const [planet, mapping] of Object.entries(PLANET_SEFIRAH_MAP)) {
    const longitude = tropicalPlanets[planet];
    if (!Number.isFinite(longitude)) continue;

    const sign = tropicalSigns[planet] || placements.sunSign || 'Unknown';
    const strength = getPlanetStrength(planet, sign);
    activatedSefirot.add(mapping.sefirah);

    sefiroticDominant.push({
      sefirah: mapping.sefirah,
      planet,
      sign,
      house: tropicalHouses[planet],
      strength,
      hebrewLetter: mapping.hebrewLetter,
      duality: mapping.duality,
    });
  }

  const allSefirot = ['Keter', 'Chokmah', 'Binah', 'Chesed', 'Gevurah', 'Tiferet', 'Netzach', 'Hod', 'Yesod', 'Malkuth'];
  const voidSefirot = allSefirot.filter((s) => !activatedSefirot.has(s));
  const meaningfulVoid = voidSefirot.filter((s) => !['Keter', 'Chokmah', 'Malkuth'].includes(s));

  const pillarOfMercy = sefiroticDominant.filter((d) => ['Chesed', 'Netzach'].includes(d.sefirah) && d.strength !== 'weak').length;
  const pillarOfSeverity = sefiroticDominant.filter((d) => ['Binah', 'Gevurah', 'Hod'].includes(d.sefirah) && d.strength !== 'weak').length;
  const middlePillar = sefiroticDominant.filter((d) => ['Tiferet', 'Yesod'].includes(d.sefirah) && d.strength !== 'weak').length;
  const upperTree = sefiroticDominant.filter((d) => ['Binah'].includes(d.sefirah)).length;
  const lowerTree = sefiroticDominant.filter((d) => ['Netzach', 'Hod', 'Yesod'].includes(d.sefirah)).length;
  const heartCenter = sefiroticDominant.filter((d) => ['Chesed', 'Gevurah', 'Tiferet'].includes(d.sefirah)).length;

  // ─── Hebrew Letter Signature ────────────────────────────────────────────
  const sunLetterData = SIGN_LETTER_MAP[placements.sunSign] || { hebrewLetter: '?', letterName: '?', faculty: '?' , hebrewMonth: 'Nisan', tribe: '?'};
  const moonLetterData = SIGN_LETTER_MAP[placements.moonSign] || { hebrewLetter: '?', letterName: '?', faculty: '?' , hebrewMonth: 'Nisan', tribe: '?'};
  const risingLetterData = SIGN_LETTER_MAP[placements.risingSign] || { hebrewLetter: '?', letterName: '?', faculty: '?' , hebrewMonth: 'Nisan', tribe: '?'};

  const allActiveLetters: KabbalahProfileV2['letterSignature']['allActiveLetters'] = [];
  for (const [planet, mapping] of Object.entries(PLANET_SEFIRAH_MAP)) {
    allActiveLetters.push({
      letter: mapping.hebrewLetter,
      name: mapping.letterName,
      planet,
      type: 'double',
    });
  }

  const occupiedSigns = new Set<string>();
  for (const planet of wanted) {
    const sign = tropicalSigns[planet];
    if (!sign) continue;
    if (occupiedSigns.has(sign)) continue;
    const data = SIGN_LETTER_MAP[sign];
    if (!data) continue;
    occupiedSigns.add(sign);
    allActiveLetters.push({
      letter: data.hebrewLetter,
      name: data.letterName,
      planet,
      type: 'simple',
    });
  }

  // ─── Four Worlds Balance (element distribution) ──────────────────────────
  const worldCounts: Record<'Fire' | 'Water' | 'Air' | 'Earth', { count: number; planets: string[] }> = {
    Fire: { count: 0, planets: [] },
    Water: { count: 0, planets: [] },
    Air: { count: 0, planets: [] },
    Earth: { count: 0, planets: [] },
  };

  for (const planet of wanted) {
    const sign = tropicalSigns[planet];
    if (!sign) continue;
    const element = SIGN_ELEMENT[sign] || 'Earth';
    worldCounts[element].count += 1;
    worldCounts[element].planets.push(planet);
  }

  const totalPlanets = wanted.length;
  const fourWorlds: KabbalahProfileV2['fourWorlds'] = {
    atziluth: { count: worldCounts.Fire.count, percentage: Math.round((worldCounts.Fire.count / totalPlanets) * 100), element: 'Fire', planets: worldCounts.Fire.planets },
    beriah: { count: worldCounts.Water.count, percentage: Math.round((worldCounts.Water.count / totalPlanets) * 100), element: 'Water', planets: worldCounts.Water.planets },
    yetzirah: { count: worldCounts.Air.count, percentage: Math.round((worldCounts.Air.count / totalPlanets) * 100), element: 'Air', planets: worldCounts.Air.planets },
    assiyah: { count: worldCounts.Earth.count, percentage: Math.round((worldCounts.Earth.count / totalPlanets) * 100), element: 'Earth', planets: worldCounts.Earth.planets },
    dominant: '',
    void: [],
  };

  const worldEntries = [
    { name: 'Atziluth (Fire/Spirit)', count: fourWorlds.atziluth.count },
    { name: 'Beriah (Water/Emotion)', count: fourWorlds.beriah.count },
    { name: 'Yetzirah (Air/Mind)', count: fourWorlds.yetzirah.count },
    { name: 'Assiyah (Earth/Body)', count: fourWorlds.assiyah.count },
  ].sort((a, b) => b.count - a.count);

  fourWorlds.dominant = worldEntries[0]?.name || 'Unknown';
  fourWorlds.void = worldEntries.filter((w) => w.count === 0).map((w) => w.name);

  // ─── Tikkun (Soul Correction) ────────────────────────────────────────────
  const normalizedMonth = normalizeHebrewMonth(hebrewDate.month);
  const tikkunData = TIKKUN_BY_MONTH[normalizedMonth] || TIKKUN_BY_MONTH.Nisan;

  const monthSignEntry = Object.entries(SIGN_LETTER_MAP).find(([_sign, data]) => data.hebrewMonth === normalizedMonth);
  const tikkunSign = monthSignEntry ? monthSignEntry[0] : placements.sunSign;
  const tikkunLetterData = monthSignEntry ? monthSignEntry[1] : SIGN_LETTER_MAP[placements.sunSign];

  const tikkun: KabbalahProfileV2['tikkun'] = {
    hebrewBirthMonth: normalizedMonth,
    tikkunName: tikkunData.tikkun,
    correction: tikkunData.correction,
    trap: tikkunData.trap,
    gift: tikkunData.gift,
    zodiacSign: tikkunSign,
    hebrewLetter: tikkunLetterData?.hebrewLetter || '',
    tribe: tikkunLetterData?.tribe || '',
  };

  // ─── Klipothic Profile ──────────────────────────────────────────────────
  const aspects = calculateAspects(tropicalPlanets);
  const hardAspects = aspects.filter((a) => a.isHard);
  const stressedSefirot = determineKlipothicStress(aspects);

  const seenSefirot = new Set<string>();
  const activeKlipoth: KabbalahProfileV2['klipothicProfile']['activeKlipoth'] = [];

  for (const stress of stressedSefirot) {
    if (seenSefirot.has(stress.sefirah)) continue;
    seenSefirot.add(stress.sefirah);

    const klipah = KLIPOTH[stress.sefirah];
    if (!klipah) continue;

    activeKlipoth.push({
      sefirah: stress.sefirah,
      klipahName: klipah.name,
      meaning: klipah.meaning,
      shadow: klipah.shadow,
      manifestation: klipah.manifestation,
      trigger: stress.trigger,
    });
  }

  for (const placement of sefiroticDominant) {
    if (placement.strength !== 'weak') continue;
    if (seenSefirot.has(placement.sefirah)) continue;
    seenSefirot.add(placement.sefirah);
    const klipah = KLIPOTH[placement.sefirah];
    if (!klipah) continue;
    activeKlipoth.push({
      sefirah: placement.sefirah,
      klipahName: klipah.name,
      meaning: klipah.meaning,
      shadow: klipah.shadow,
      manifestation: klipah.manifestation,
      trigger: `${placement.planet} in ${placement.sign} (debilitated)`,
    });
  }

  const mercyStress = activeKlipoth.filter((k) => ['Chesed', 'Netzach'].includes(k.sefirah)).length;
  const severityStress = activeKlipoth.filter((k) => ['Binah', 'Gevurah', 'Hod'].includes(k.sefirah)).length;
  const middleStress = activeKlipoth.filter((k) => ['Tiferet', 'Yesod'].includes(k.sefirah)).length;

  let primaryShadowAxis = 'Balanced (no dominant shadow axis)';
  if (severityStress > mercyStress && severityStress > middleStress) {
    primaryShadowAxis = 'Pillar of Severity (shadow of over-judgment, restriction, cruelty)';
  } else if (mercyStress > severityStress && mercyStress > middleStress) {
    primaryShadowAxis = 'Pillar of Mercy (shadow of over-giving, boundary loss, enabling)';
  } else if (middleStress > 0) {
    primaryShadowAxis = 'Middle Pillar (shadow of false self, identity crisis, disconnection from source)';
  }

  // ─── Modality Balance ────────────────────────────────────────────────────
  const modalityCounts = { cardinal: 0, fixed: 0, mutable: 0 };
  for (const planet of wanted) {
    const sign = tropicalSigns[planet];
    if (!sign) continue;
    const modality = SIGN_MODALITY[sign];
    if (modality === 'Cardinal') modalityCounts.cardinal += 1;
    else if (modality === 'Fixed') modalityCounts.fixed += 1;
    else if (modality === 'Mutable') modalityCounts.mutable += 1;
  }

  let dominantModality = 'Cardinal';
  if (modalityCounts.fixed >= modalityCounts.cardinal && modalityCounts.fixed >= modalityCounts.mutable) dominantModality = 'Fixed';
  if (modalityCounts.mutable >= modalityCounts.cardinal && modalityCounts.mutable >= modalityCounts.fixed) dominantModality = 'Mutable';

  return {
    sefiroticProfile: {
      dominant: sefiroticDominant,
      void: meaningfulVoid,
      balance: {
        pillarOfMercy,
        pillarOfSeverity,
        middlePillar,
        upperTree,
        lowerTree,
        heartCenter,
      },
    },
    letterSignature: {
      sunLetter: { letter: sunLetterData.hebrewLetter, name: sunLetterData.letterName, faculty: sunLetterData.faculty },
      moonLetter: { letter: moonLetterData.hebrewLetter, name: moonLetterData.letterName, faculty: moonLetterData.faculty },
      risingLetter: { letter: risingLetterData.hebrewLetter, name: risingLetterData.letterName, faculty: risingLetterData.faculty },
      allActiveLetters,
    },
    fourWorlds,
    tikkun,
    klipothicProfile: {
      activeKlipoth,
      hardAspects,
      primaryShadowAxis,
    },
    hebrewDate,
    modalityBalance: {
      ...modalityCounts,
      dominant: dominantModality,
    },
  };
}
