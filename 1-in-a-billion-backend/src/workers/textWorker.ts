/**
 * TEXT WORKER - LLM Text Generation
 *
 * Processes text_generation tasks for the Supabase Queue (Job Queue V2).
 * Intended to run as a stateless RunPod Serverless worker.
 */

import { BaseWorker, TaskResult } from './baseWorker';
import { JobTask, supabase } from '../services/supabaseClient';
import { ephemerisIsolation } from '../services/ephemerisIsolation'; // Isolated process (crash-safe)
import { llm, llmPaid, type LLMProvider } from '../services/llm'; // Centralized LLM service
import { getProviderForSystem, type LLMProviderName } from '../config/llmProviders';
import { generateDramaticTitles } from '../services/titleGenerator'; // Dramatic title generation
import {
  SYSTEMS as NUCLEAR_V2_SYSTEMS,
  SYSTEM_DISPLAY_NAMES as NUCLEAR_V2_SYSTEM_NAMES,
  buildPersonPrompt,
  buildOverlayPrompt as buildNuclearV2OverlayPrompt,
  buildVerdictPrompt,
} from '../prompts/structures/paidReadingPrompts';
import { buildIndividualPrompt, buildOverlayPrompt } from '../prompts';
import { SpiceLevel } from '../prompts/spice/levels';
import { gematriaService } from '../services/kabbalah/GematriaService';
import { hebrewCalendarService } from '../services/kabbalah/HebrewCalendarService';
import { OUTPUT_FORMAT_RULES } from '../prompts/core/output-rules';
import { logLLMCost } from '../services/costTracking';

function clampSpice(level: number): SpiceLevel {
  const clamped = Math.min(10, Math.max(1, Math.round(level)));
  return clamped as SpiceLevel; // Cast validated number (1-10) to SpiceLevel
}

/**
 * Build chart data string SPECIFIC to the system being analyzed.
 * 
 * CRITICAL: Each system needs its own relevant data, not Western data for everything!
 * - Western: Tropical zodiac positions (Sun, Moon, Rising)
 * - Vedic: Sidereal positions (~23° offset), Nakshatras, Dashas
 * - Human Design: Based on birth time, gates, centers, channels
 * - Gene Keys: Based on I Ching gates from Human Design
 * - Kabbalah: Life path numbers, Sephirot positions
 */
function buildChartDataForSystem(
  system: string,
  person1Name: string,
  p1Placements: any,
  person2Name: string | null,
  p2Placements: any | null,
  p1BirthData: { birthDate: string; birthTime: string; timezone?: string },
  p2BirthData: { birthDate: string; birthTime: string; timezone?: string } | null
): string {
  const formatDegree = (d: any) => (d ? `${d.degree}° ${d.minute}'` : '');
  const hasP2 = Boolean(person2Name && p2Placements && p2BirthData);

  const getZodiacSign = (degree: number): string => {
    const signs = ['Aries', 'Taurus', 'Gemini', 'Cancer', 'Leo', 'Virgo',
      'Libra', 'Scorpio', 'Sagittarius', 'Capricorn', 'Aquarius', 'Pisces'];
    return signs[Math.floor(degree / 30) % 12];
  };

  const getNakshatra = (degree: number): string => {
    const nakshatras = [
      'Ashwini', 'Bharani', 'Krittika', 'Rohini', 'Mrigashira', 'Ardra',
      'Punarvasu', 'Pushya', 'Ashlesha', 'Magha', 'Purva Phalguni', 'Uttara Phalguni',
      'Hasta', 'Chitra', 'Swati', 'Vishakha', 'Anuradha', 'Jyeshtha',
      'Mula', 'Purva Ashadha', 'Uttara Ashadha', 'Shravana', 'Dhanishtha', 'Shatabhisha',
      'Purva Bhadrapada', 'Uttara Bhadrapada', 'Revati'
    ];
    // Exact division: 360 / 27 = 13.333333333333334
    return nakshatras[Math.floor((degree % 360) / (360 / 27)) % 27];
  };

  // Calculate Human Design gates from Sun position
  const getHDGate = (degree: number): number => {
    // Human Design uses a specific mapping of 64 I Ching gates
    const gateMap = [41, 19, 13, 49, 30, 55, 37, 63, 22, 36, 25, 17, 21, 51, 42, 3, 27, 24, 2, 23, 8, 20, 16, 35, 45, 12, 15, 52, 39, 53, 62, 56, 31, 33, 7, 4, 29, 59, 40, 64, 47, 6, 46, 18, 48, 57, 32, 50, 28, 44, 1, 43, 14, 34, 9, 5, 26, 11, 10, 58, 38, 54, 61, 60];
    // Exact division: 360 / 64 = 5.625
    return gateMap[Math.floor((degree % 360) / 5.625) % 64];
  };

  // Calculate Life Path number for Kabbalah
  const getLifePath = (birthDate: string): number => {
    const digits = birthDate.replace(/\D/g, '').split('').map(Number);
    let sum = digits.reduce((a, b) => a + b, 0);
    while (sum > 9 && sum !== 11 && sum !== 22 && sum !== 33) {
      sum = sum.toString().split('').map(Number).reduce((a, b) => a + b, 0);
    }
    return sum;
  };

  // IMPORTANT:
  // For Vedic (sidereal) calculations we MUST use true longitudes from Swiss Ephemeris,
  // not "degree within sign" or guessed mid-sign values. Those approximations can be off
  // by an entire sign + wrong nakshatra/pada.
  //
  // For Human Design / Gene Keys, we also need a continuous 0-360° longitude for the Sun.
  // Prefer Swiss-provided longitudes; fall back to (signIndex*30 + degree + minute/60).
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
    typeof p1Placements?.sunLongitude === 'number' ? (p1Placements.sunLongitude as number) : fallbackLongitude(p1Placements, 'sun');
  const p2SunDeg =
    hasP2 && typeof p2Placements?.sunLongitude === 'number'
      ? (p2Placements.sunLongitude as number)
      : hasP2
        ? fallbackLongitude(p2Placements, 'sun')
        : 0;

  switch (system) {
    case 'western':
      if (!hasP2) {
        return `${person1Name.toUpperCase()} WESTERN (TROPICAL) CHART:
- Sun: ${p1Placements.sunSign} ${formatDegree(p1Placements.sunDegree)}
- Moon: ${p1Placements.moonSign} ${formatDegree(p1Placements.moonDegree)}
- Rising: ${p1Placements.risingSign} ${formatDegree(p1Placements.ascendantDegree)}`;
      }

      return `${person1Name.toUpperCase()} WESTERN (TROPICAL) CHART:
- Sun: ${p1Placements.sunSign} ${formatDegree(p1Placements.sunDegree)}
- Moon: ${p1Placements.moonSign} ${formatDegree(p1Placements.moonDegree)}
- Rising: ${p1Placements.risingSign} ${formatDegree(p1Placements.ascendantDegree)}

${person2Name!.toUpperCase()} WESTERN (TROPICAL) CHART:
- Sun: ${p2Placements!.sunSign} ${formatDegree(p2Placements!.sunDegree)}
- Moon: ${p2Placements!.moonSign} ${formatDegree(p2Placements!.moonDegree)}
- Rising: ${p2Placements!.risingSign} ${formatDegree(p2Placements!.ascendantDegree)}`;

    case 'vedic':
      const p1Sid = p1Placements?.sidereal;
      const p2Sid = hasP2 ? p2Placements?.sidereal : null;

      if (!p1Sid || !Number.isFinite(p1Sid.sunLongitude)) {
        console.error('❌ [Vedic] Sidereal data missing for P1:', p1Placements);
        throw new Error(`Sidereal (Vedic) data missing for ${person1Name}. Please check Swiss Ephemeris configuration.`);
      }

      if (hasP2 && (!p2Sid || !Number.isFinite(p2Sid.sunLongitude))) {
        console.error('❌ [Vedic] Sidereal data missing for P2:', p2Placements);
        throw new Error(`Sidereal (Vedic) data missing for ${person2Name}. Please check Swiss Ephemeris configuration.`);
      }

      const p1SunSidereal = p1Sid.sunLongitude as number;
      const p1MoonSidereal = p1Sid.moonLongitude as number;
      const p1AscSidereal = p1Sid.ascendantLongitude as number;
      const p1RahuSidereal = Number.isFinite(p1Sid?.rahuLongitude) ? (p1Sid.rahuLongitude as number) : null;
      const p1KetuSidereal = Number.isFinite(p1Sid?.ketuLongitude) ? (p1Sid.ketuLongitude as number) : null;

      const p1LagnaSign = getZodiacSign(p1AscSidereal);
      const p1LagnaLord =
        ['Mars', 'Venus', 'Mercury', 'Moon', 'Sun', 'Mercury', 'Venus', 'Mars', 'Jupiter', 'Saturn', 'Saturn', 'Jupiter'][
          Math.floor(p1AscSidereal / 30) % 12
        ];
      
      const p1MoonNakshatra = p1Sid?.janmaNakshatra || getNakshatra(p1MoonSidereal);
      const p1MoonPada = (p1Sid?.janmaPada || (Math.floor((p1MoonSidereal % (360/27)) / (360/108)) + 1)) as number;
      const p1MoonNakshatraLord = ['Ketu', 'Venus', 'Sun', 'Moon', 'Mars', 'Rahu', 'Jupiter', 'Saturn', 'Mercury'][Math.floor(p1MoonSidereal / (360/27)) % 9];
      
      const p2SunSidereal = hasP2 ? (p2Sid!.sunLongitude as number) : 0;
      const p2MoonSidereal = hasP2 ? (p2Sid!.moonLongitude as number) : 0;
      const p2AscSidereal = hasP2 ? (p2Sid!.ascendantLongitude as number) : 0;
      const p2RahuSidereal = hasP2 && Number.isFinite(p2Sid?.rahuLongitude) ? (p2Sid!.rahuLongitude as number) : null;
      const p2KetuSidereal = hasP2 && Number.isFinite(p2Sid?.ketuLongitude) ? (p2Sid!.ketuLongitude as number) : null;
      const p2LagnaSign = hasP2 ? getZodiacSign(p2AscSidereal) : 'Unknown';
      const p2LagnaLord = hasP2 ? ['Mars', 'Venus', 'Mercury', 'Moon', 'Sun', 'Mercury', 'Venus', 'Mars', 'Jupiter', 'Saturn', 'Saturn', 'Jupiter'][Math.floor(p2AscSidereal / 30) % 12] : 'Unknown';
      const p2MoonNakshatra = hasP2 ? (p2Sid?.janmaNakshatra || getNakshatra(p2MoonSidereal)) : '';
      const p2MoonNakshatraLord = hasP2 ? ['Ketu', 'Venus', 'Sun', 'Moon', 'Mars', 'Rahu', 'Jupiter', 'Saturn', 'Mercury'][Math.floor(p2MoonSidereal / (360/27)) % 9] : '';
      const p2MoonPada = hasP2 ? ((p2Sid?.janmaPada || (Math.floor((p2MoonSidereal % (360/27)) / (360/108)) + 1)) as number) : 0;

      const formatGrahas = (sid: any) => {
        const grahas: any[] = Array.isArray(sid?.grahas) ? sid.grahas : [];
        if (grahas.length === 0) return '[Graha list unavailable]';
        // Prefer mean nodes for default output; include true nodes only if explicitly present.
        const filtered = grahas.filter((g) => !(g?.isTrueNode === true));
        const order: Record<string, number> = {
          sun: 1,
          moon: 2,
          mars: 3,
          mercury: 4,
          jupiter: 5,
          venus: 6,
          saturn: 7,
          rahu: 8,
          ketu: 9,
        };
        filtered.sort((a, b) => (order[a.key] || 99) - (order[b.key] || 99));
        return filtered
          .map((g) => {
            const deg = typeof g.degree === 'number' ? g.degree : 0;
            const min = typeof g.minute === 'number' ? g.minute : 0;
            const bhava = typeof g.bhava === 'number' ? g.bhava : 0;
            const nak = g.nakshatra ? ` | Nakshatra: ${g.nakshatra}${g.pada ? ` (Pada ${g.pada}/4)` : ''}` : '';
            return `- ${String(g.key).toUpperCase()}: ${g.sign} ${deg}°${String(min).padStart(2, '0')}' | Bhava ${bhava}${nak}`;
          })
          .join('\n');
      };

      if (!hasP2) {
        return `${person1Name.toUpperCase()} VEDIC JYOTISH CHART (SIDEREAL ONLY):

═══════════════════════════════════════════════════════════════════════════════
CRITICAL: THIS IS PURE VEDIC ASTROLOGY (JYOTISH)
THIS CHART USES THE SIDEREAL ZODIAC (LAHIRI AYANAMSA).
DO NOT USE ANY WESTERN TROPICAL DATA.
═══════════════════════════════════════════════════════════════════════════════

FORBIDDEN TERMINOLOGY:
- DO NOT use "Sun sign", "Moon sign", "zodiac sign" (these are Western concepts)
- DO NOT use "Ascendant" (use "Lagna" only)
- DO NOT reference tropical zodiac, Western astrology, or any non-Vedic systems
- DO NOT use Western house meanings or interpretations

REQUIRED VEDIC TERMINOLOGY ONLY:
- Use "Rashi" for Moon sign (not "Moon sign")
- Use "Lagna" for Ascendant (not "Ascendant" or "Rising")
- Use "Graha" for planets (Surya, Chandra, Mangal, Budha, Guru, Shukra, Shani, Rahu, Ketu)
- Use "Bhava" for houses (not "house")
- Use "Nakshatra" (27 lunar mansions)
- Use "Dasha" for planetary periods (Vimshottari system)

═══════════════════════════════════════════════════════════════════════════════
CHART DATA (SIDEREAL - LAHIRI AYANAMSA):
═══════════════════════════════════════════════════════════════════════════════

GRAHAS + BHAVAS (WHOLE SIGN / RASHI HOUSES):
${formatGrahas(p1Sid)}

LAGNA (SOUL PORTAL):
- Lagna Rashi: ${p1LagnaSign} ${Math.floor(p1AscSidereal % 30)}° ${Math.floor((p1AscSidereal % 1) * 60)}'
- Lagna Lord: ${p1LagnaLord}
- The Lagna is the portal through which the soul entered this body. It determines the dharmic direction and life path.

CHANDRA (MOON) - THE MIND ITSELF:
- Chandra Rashi: ${getZodiacSign(p1MoonSidereal)} ${Math.floor(p1MoonSidereal % 30)}° ${Math.floor((p1MoonSidereal % 1) * 60)}'
- Janma Nakshatra: ${p1MoonNakshatra} (Pada ${p1MoonPada}/4)
- Nakshatra Lord: ${p1MoonNakshatraLord}
- CRITICAL: In Jyotish, the Moon Rashi IS the mind. The Janma Nakshatra is MORE IMPORTANT than the Rashi.

SURYA (SUN) - SOUL PURPOSE:
- Surya Rashi: ${getZodiacSign(p1SunSidereal)} ${Math.floor(p1SunSidereal % 30)}° ${Math.floor((p1SunSidereal % 1) * 60)}'
- Surya Nakshatra: ${getNakshatra(p1SunSidereal)}
- Represents the soul's purpose, dharma, and essential nature.

RAHU-KETU AXIS (KARMIC NODES):
- Rahu: ${p1RahuSidereal != null ? `${getZodiacSign(p1RahuSidereal)} ${Math.floor(p1RahuSidereal % 30)}°` : '[not available]'} - Material desires, worldly attachments
- Ketu: ${p1KetuSidereal != null ? `${getZodiacSign(p1KetuSidereal)} ${Math.floor(p1KetuSidereal % 30)}°` : '[not available]'} - Spiritual detachment, past life mastery

═══════════════════════════════════════════════════════════════════════════════
VEDIC ANALYSIS REQUIREMENTS (PURE JYOTISH ONLY):
═══════════════════════════════════════════════════════════════════════════════

1. NAKSHATRA ANALYSIS (MOST CRITICAL):
   - Janma Nakshatra deity and what the deity WANTS from this person.
   - Nakshatra is MORE IMPORTANT than Rashi in Jyotish.

2. LAGNA ANALYSIS:
   - Lagna lord strength (exaltation, debilitation, own sign, friend/enemy).
   - Lagna lord placement and aspects.

3. PLANETARY ANALYSIS:
   - All Grahas in sidereal positions only.
   - Key house lords: 1st (Lagna), 4th, 7th, 9th, 10th Bhava lords.

4. DASHA SYSTEM (VIMSHOTTARI):
   - Current Mahadasha (based on Moon Nakshatra lord).
   - Upcoming periods and their implications.

5. YOGAS (PLANETARY COMBINATIONS):
   - Raja Yoga, Dhana Yoga, etc.

ABSOLUTE REQUIREMENTS:
- Use ONLY sidereal positions (Lahiri ayanamsa).
- Use ONLY Vedic terminology (Rashi, Lagna, Nakshatra, Graha, Bhava, Dasha).
- DO NOT reference tropical zodiac, Western astrology, or Western house meanings.`;
      }

      return `${person1Name.toUpperCase()} VEDIC JYOTISH CHART (SIDEREAL ONLY):

═══════════════════════════════════════════════════════════════════════════════
CRITICAL: PURE VEDIC ASTROLOGY - ZERO WESTERN CONCEPTS ALLOWED
═══════════════════════════════════════════════════════════════════════════════

FORBIDDEN: "Sun sign", "Moon sign", "Ascendant", "Rising", "house", tropical zodiac, Western astrology

REQUIRED: "Rashi", "Lagna", "Nakshatra", "Graha", "Bhava", "Dasha" (Vedic terms only)

GRAHAS + BHAVAS (WHOLE SIGN / RASHI HOUSES):
${formatGrahas(p1Sid)}

LAGNA (SOUL PORTAL):
- Lagna Rashi: ${p1LagnaSign} ${Math.floor(p1AscSidereal % 30)}° - Lagna Lord: ${p1LagnaLord}

CHANDRA (MOON) - THE MIND:
- Chandra Rashi: ${getZodiacSign(p1MoonSidereal)} ${Math.floor(p1MoonSidereal % 30)}° 
 - Janma Nakshatra: ${p1MoonNakshatra} (Pada ${p1MoonPada}/4) - Lord: ${p1MoonNakshatraLord}

SURYA (SUN) - SOUL PURPOSE:
- Surya Rashi: ${getZodiacSign(p1SunSidereal)} ${Math.floor(p1SunSidereal % 30)}° - Nakshatra: ${getNakshatra(p1SunSidereal)}

RAHU-KETU AXIS (KARMIC NODES):
 - Rahu: ${p1RahuSidereal != null ? `${getZodiacSign(p1RahuSidereal)} ${Math.floor(p1RahuSidereal % 30)}°` : '[not available]'} | Ketu: ${p1KetuSidereal != null ? `${getZodiacSign(p1KetuSidereal)} ${Math.floor(p1KetuSidereal % 30)}°` : '[not available]'}

${person2Name!.toUpperCase()} VEDIC JYOTISH CHART (SIDEREAL ONLY):

GRAHAS + BHAVAS (WHOLE SIGN / RASHI HOUSES):
${formatGrahas(p2Sid)}

LAGNA (SOUL PORTAL):
- Lagna Rashi: ${p2LagnaSign} ${Math.floor(p2AscSidereal % 30)}° - Lagna Lord: ${p2LagnaLord}

CHANDRA (MOON) - THE MIND:
- Chandra Rashi: ${getZodiacSign(p2MoonSidereal)} ${Math.floor(p2MoonSidereal % 30)}° 
- Janma Nakshatra: ${p2MoonNakshatra} (Pada ${p2MoonPada}/4) - Lord: ${p2MoonNakshatraLord}

SURYA (SUN) - SOUL PURPOSE:
- Surya Rashi: ${getZodiacSign(p2SunSidereal)} ${Math.floor(p2SunSidereal % 30)}° - Nakshatra: ${getNakshatra(p2SunSidereal)}

RAHU-KETU AXIS (KARMIC NODES):
 - Rahu: ${p2RahuSidereal != null ? `${getZodiacSign(p2RahuSidereal)} ${Math.floor(p2RahuSidereal % 30)}°` : '[not available]'} | Ketu: ${p2KetuSidereal != null ? `${getZodiacSign(p2KetuSidereal)} ${Math.floor(p2KetuSidereal % 30)}°` : '[not available]'}

═══════════════════════════════════════════════════════════════════════════════
VEDIC ANALYSIS REQUIREMENTS (PURE JYOTISH - NO WESTERN MIXING):
═══════════════════════════════════════════════════════════════════════════════

- Analyze both charts using SIDEREAL positions ONLY
- Use ONLY Vedic terminology (Rashi, Lagna, Nakshatra, Graha, Bhava, Dasha)
- Janma Nakshatra analysis is CRITICAL for both - cover deity, qualities, animal symbol, guna
- Lagna lords and their condition for both charts
- Planetary strengths (Uccha/Neecha/Swakshetra) and Bhava lords
- Vimshottari Dasha compatibility (timing cycles alignment)
- Yogas and karmic indicators
- Rahu-Ketu axis interaction (karmic connections between charts)
- DO NOT use Western house meanings or interpretations
- DO NOT reference tropical zodiac or Western astrology
- This is PURE JYOTISH - zero mixing with Western concepts`;

    case 'human_design':
      const p1SunGate = getHDGate(p1SunDeg);
      const p1EarthGate = getHDGate((p1SunDeg + 180) % 360);
      const p2SunGate = hasP2 ? getHDGate(p2SunDeg) : 0;
      const p2EarthGate = hasP2 ? getHDGate((p2SunDeg + 180) % 360) : 0;

      if (!hasP2) {
        return `${person1Name.toUpperCase()} HUMAN DESIGN:
- Conscious Sun Gate: ${p1SunGate}
- Conscious Earth Gate: ${p1EarthGate}
- Design Sun Gate (88° before birth): ${getHDGate((p1SunDeg - 88 + 360) % 360)}
- Born: ${p1BirthData.birthDate} at ${p1BirthData.birthTime}

NOTE: Human Design combines I Ching, Kabbalah, Hindu-Brahmin chakras, and astrology. Focus on Type, Strategy, Authority, and Gate activations.`;
      }

      return `${person1Name.toUpperCase()} HUMAN DESIGN:
- Conscious Sun Gate: ${p1SunGate}
- Conscious Earth Gate: ${p1EarthGate}
- Design Sun Gate (88° before birth): ${getHDGate((p1SunDeg - 88 + 360) % 360)}
- Born: ${p1BirthData.birthDate} at ${p1BirthData.birthTime}

${person2Name!.toUpperCase()} HUMAN DESIGN:
- Conscious Sun Gate: ${p2SunGate}
- Conscious Earth Gate: ${p2EarthGate}
- Design Sun Gate (88° before birth): ${getHDGate((p2SunDeg - 88 + 360) % 360)}
- Born: ${p2BirthData!.birthDate} at ${p2BirthData!.birthTime}

NOTE: Human Design combines I Ching, Kabbalah, Hindu-Brahmin chakras, and astrology. Focus on Type, Strategy, Authority, and Gate activations.`;

    case 'gene_keys':
      const p1GK = getHDGate(p1SunDeg);
      const p2GK = hasP2 ? getHDGate(p2SunDeg) : 0;

      if (!hasP2) {
        return `${person1Name.toUpperCase()} GENE KEYS:
- Life's Work (Conscious Sun): Gene Key ${p1GK}
- Evolution (Conscious Earth): Gene Key ${getHDGate((p1SunDeg + 180) % 360)}
- Radiance (Conscious South Node): Gene Key ${getHDGate((p1SunDeg + 90) % 360)}
- Purpose (Conscious North Node): Gene Key ${getHDGate((p1SunDeg + 270) % 360)}

NOTE: Gene Keys explores the Shadow, Gift, and Siddhi of each key. Focus on the journey from Shadow to Gift to Siddhi.`;
      }

      return `${person1Name.toUpperCase()} GENE KEYS:
- Life's Work (Conscious Sun): Gene Key ${p1GK}
- Evolution (Conscious Earth): Gene Key ${getHDGate((p1SunDeg + 180) % 360)}
- Radiance (Conscious South Node): Gene Key ${getHDGate((p1SunDeg + 90) % 360)}
- Purpose (Conscious North Node): Gene Key ${getHDGate((p1SunDeg + 270) % 360)}

${person2Name!.toUpperCase()} GENE KEYS:
- Life's Work (Conscious Sun): Gene Key ${p2GK}
- Evolution (Conscious Earth): Gene Key ${getHDGate((p2SunDeg + 180) % 360)}
- Radiance (Conscious South Node): Gene Key ${getHDGate((p2SunDeg + 90) % 360)}
- Purpose (Conscious North Node): Gene Key ${getHDGate((p2SunDeg + 270) % 360)}

NOTE: Gene Keys explores the Shadow, Gift, and Siddhi of each key. Focus on the journey from Shadow to Gift to Siddhi.`;

    case 'kabbalah':
      const p1LP = getLifePath(p1BirthData.birthDate);
      const p2LP = hasP2 ? getLifePath(p2BirthData!.birthDate) : 0;
      const sephirot = ['', 'Kether (Crown)', 'Chokmah (Wisdom)', 'Binah (Understanding)',
        'Chesed (Mercy)', 'Geburah (Severity)', 'Tiphareth (Beauty)',
        'Netzach (Victory)', 'Hod (Glory)', 'Yesod (Foundation)',
        'Malkuth (Kingdom)', 'Kether-Chokmah', 'Binah-Chesed'];

      if (!hasP2) {
        return `${person1Name.toUpperCase()} KABBALAH:
- Life Path Number: ${p1LP} - ${sephirot[p1LP] || 'Master Number'}
- Birth Day Number: ${parseInt(p1BirthData.birthDate.split('-')[2] || '1')}
- Soul Urge: Derived from vowels in name

NOTE: Kabbalah focuses on the Tree of Life (Sephirot), paths between spheres, and the soul's journey.`;
      }

      return `${person1Name.toUpperCase()} KABBALAH:
- Life Path Number: ${p1LP} - ${sephirot[p1LP] || 'Master Number'}
- Birth Day Number: ${parseInt(p1BirthData.birthDate.split('-')[2] || '1')}
- Soul Urge: Derived from vowels in name

${person2Name!.toUpperCase()} KABBALAH:
- Life Path Number: ${p2LP} - ${sephirot[p2LP] || 'Master Number'}
- Birth Day Number: ${parseInt(p2BirthData!.birthDate.split('-')[2] || '1')}
- Soul Urge: Derived from vowels in name

NOTE: Kabbalah focuses on the Tree of Life (Sephirot), paths between spheres, and the soul's journey. Focus on how their Life Paths interact on the Tree.`;

    default:
      if (!hasP2) {
        return `Birth Data for ${person1Name}: ${p1BirthData.birthDate} at ${p1BirthData.birthTime}`;
      }
      return `Birth Data for ${person1Name}: ${p1BirthData.birthDate} at ${p1BirthData.birthTime}
Birth Data for ${person2Name}: ${p2BirthData!.birthDate} at ${p2BirthData!.birthTime}`;
  }
}

// Legacy function - kept for backwards compatibility
function buildChartDataString(
  person1Name: string,
  p1Placements: any,
  person2Name: string,
  p2Placements: any
): string {
  return buildChartDataForSystem('western', person1Name, p1Placements, person2Name, p2Placements,
    { birthDate: '', birthTime: '' }, { birthDate: '', birthTime: '' });
}

// LLM calls now use centralized service (src/services/llm.ts)
// Provider controlled by LLM_PROVIDER env var (deepseek | claude | openai)

export class TextWorker extends BaseWorker {
  constructor() {
    super({
      taskTypes: ['text_generation'],
      maxConcurrentTasks: 2,
    });
  }

  protected async processTask(task: JobTask): Promise<TaskResult> {
    if (!supabase) return { success: false, error: 'Supabase not configured' };

    // ═══════════════════════════════════════════════════════════════════════════
    // SWISS EPHEMERIS DIAGNOSTIC - Check health BEFORE attempting calculations
    // Using ISOLATED process to prevent crashes from killing main worker
    // ═══════════════════════════════════════════════════════════════════════════
    console.log('=== SWISS EPHEMERIS DIAGNOSTIC START ===');
    try {
      const healthCheck = await ephemerisIsolation.healthCheck();
      console.log('Swiss Ephemeris Health Check Result:', JSON.stringify(healthCheck, null, 2));

      if (healthCheck.status !== 'ok') {
        const errorMsg = `Swiss Ephemeris NOT ready: ${healthCheck.message}`;
        console.error('❌', errorMsg);
        return { success: false, error: errorMsg };
      }
      console.log('✅ Swiss Ephemeris is healthy, proceeding with task');
    } catch (healthError: any) {
      const errorMsg = `Swiss Ephemeris health check FAILED: ${healthError.message}`;
      console.error('❌', errorMsg);
      return { success: false, error: errorMsg };
    }
    console.log('=== SWISS EPHEMERIS DIAGNOSTIC END ===');

    const jobId = task.job_id;

    // Load job params
    const { data: job, error: jobErr } = await supabase
      .from('jobs')
      .select('id, user_id, type, params')
      .eq('id', jobId)
      .single();

    if (jobErr || !job) {
      return { success: false, error: `Failed to load job ${jobId}` };
    }

    if (job.type !== 'nuclear_v2' && job.type !== 'extended' && job.type !== 'synastry') {
      return { success: false, error: `TextWorker only supports nuclear_v2, synastry, and extended right now (got ${job.type})` };
    }

    const params: any = job.params || {};
    const person1 = params.person1;
    const person2 = params.person2; // Optional for single-person readings

    if (!person1) {
      return { success: false, error: 'Missing person1 in job.params' };
    }

    const style: 'production' | 'spicy_surreal' = params.style || 'spicy_surreal';
    const spiceLevel = clampSpice(params.relationshipIntensity || 5);

    // Task input schema (we keep it flexible)
    const docNum: number = Number(task.input?.docNum ?? task.sequence + 1);
    const docType: 'person1' | 'person2' | 'overlay' | 'verdict' | 'individual' =
      task.input?.docType ||
      (job.type === 'extended' ? 'individual' : (docNum === 16 ? 'verdict' : 'person1'));
    const system: string | null = task.input?.system ?? null;
    const title: string = task.input?.title || (docType === 'verdict' ? 'Final Verdict' : 'Untitled');

    const requestedSystems: string[] = Array.isArray(params.systems) ? params.systems : [];
    const systemsCount = requestedSystems.length > 0 ? requestedSystems.length : 1;
    const docsTotal =
      job.type === 'nuclear_v2'
        ? 16
        : job.type === 'synastry'
          ? systemsCount * 3
          : systemsCount; // extended: 1 doc per system

    // Update progress: text generation started
    await supabase.rpc('update_job_progress', {
      p_job_id: jobId,
      p_progress: {
        phase: 'text',
        message: `📝 ${title}...`,
        currentStep: `TEXT: Doc ${docNum}/${docsTotal}`,
        docsComplete: Number(task.input?.docsComplete || 0),
        docsTotal,
      },
    });

    // Swiss Ephemeris calculations (ISOLATED PROCESS - crash-safe)
    let p1Placements: any;
    let p2Placements: any;

    try {
      p1Placements = await ephemerisIsolation.computePlacements({
        birthDate: person1.birthDate,
        birthTime: person1.birthTime,
        timezone: person1.timezone,
        latitude: person1.latitude,
        longitude: person1.longitude,
        relationshipIntensity: spiceLevel,
        relationshipMode: 'sensual',
        primaryLanguage: 'en',
      });
    } catch (p1Error: any) {
      const errorMsg = `Person 1 ephemeris calculation failed: ${p1Error.message}`;
      console.error('❌', errorMsg);
      return { success: false, error: errorMsg };
    }

    // Only compute person2 placements if person2 exists (for overlay readings)
    if (person2) {
      try {
        p2Placements = await ephemerisIsolation.computePlacements({
          birthDate: person2.birthDate,
          birthTime: person2.birthTime,
          timezone: person2.timezone,
          latitude: person2.latitude,
          longitude: person2.longitude,
          relationshipIntensity: spiceLevel,
          relationshipMode: 'sensual',
          primaryLanguage: 'en',
        });
      } catch (p2Error: any) {
        const errorMsg = `Person 2 ephemeris calculation failed: ${p2Error.message}`;
        console.error('❌', errorMsg);
        return { success: false, error: errorMsg };
      }
    } else {
      p2Placements = null; // No person2 for single-person readings
    }

    const p1BirthData = {
      birthDate: person1.birthDate,
      birthTime: person1.birthTime,
      birthPlace: `${Number(person1.latitude).toFixed(2)}°N, ${Number(person1.longitude).toFixed(2)}°E`,
      timezone: person1.timezone,
    };

    const p2BirthData = person2 ? {
      birthDate: person2.birthDate,
      birthTime: person2.birthTime,
      birthPlace: `${Number(person2.latitude).toFixed(2)}°N, ${Number(person2.longitude).toFixed(2)}°E`,
      timezone: person2.timezone,
    } : null;

    // ═══════════════════════════════════════════════════════════════════════════
    // CRITICAL FIX: Build chart data based on docType!
    // - person1 docs: Only include person1's chart (no person2 data)
    // - person2 docs: Only include person2's chart (no person1 data)
    // - overlay/verdict docs: Include both charts
    // This prevents the LLM from writing about relationships in individual readings
    // ═══════════════════════════════════════════════════════════════════════════
    let chartData: string;
    
    if (docType === 'person1') {
      // Person1 individual reading - ONLY person1's chart
      chartData = buildChartDataForSystem(
        system || 'western',
        person1.name,
        p1Placements,
        null, // NO person2 data for individual readings!
        null,
        p1BirthData,
        null
      );
      console.log(`📊 [TextWorker] Building ${system} chart data for person1 doc ${docNum} (individual only)`);
    } else if (docType === 'person2') {
      // Person2 individual reading - ONLY person2's chart
      if (!person2 || !p2Placements || !p2BirthData) {
        throw new Error(`person2 doc requires person2 data, but it's missing for job ${jobId}`);
      }
      chartData = buildChartDataForSystem(
        system || 'western',
        person2.name,
        p2Placements,
        null, // NO person1 data for individual readings!
        null,
        p2BirthData,
        null
      );
      console.log(`📊 [TextWorker] Building ${system} chart data for person2 doc ${docNum} (individual only)`);
    } else {
      // Overlay/verdict/other - include both charts
      chartData = buildChartDataForSystem(
        system || 'western',
        person1.name,
        p1Placements,
        person2?.name || null,
        p2Placements,
        p1BirthData,
        p2BirthData
      );
      console.log(`📊 [TextWorker] Building ${system} chart data for ${docType} doc ${docNum} (both people)`);
    }

    let prompt = '';
    let label = `job:${jobId}:doc:${docNum}`;

    if (docType === 'verdict') {
      if (job.type !== 'nuclear_v2') {
        throw new Error(`Verdict docType is only valid for nuclear_v2 jobs (got ${job.type})`);
      }
      // ... existing verdict logic ...
      const { data: tasks, error: tasksErr } = await supabase
        .from('job_tasks')
        .select('sequence, output')
        .eq('job_id', jobId)
        .eq('task_type', 'text_generation')
        .eq('status', 'complete');

      if (tasksErr) {
        throw new Error(`Failed to fetch prior tasks for verdict: ${tasksErr.message}`);
      }

      const summaries = (tasks || [])
        .map((t: any) => t.output)
        .filter(Boolean)
        .filter((o: any) => o.docNum && o.docNum !== 16)
        .sort((a: any, b: any) => (a.docNum ?? 0) - (b.docNum ?? 0))
        .map((o: any) => `${o.title}: ${String(o.excerpt || '').slice(0, 600)}...`)
        .join('\n\n');

      prompt = buildVerdictPrompt({
        person1Name: person1.name,
        person2Name: person2.name,
        allReadingsSummary: summaries || '[No summaries available]',
        spiceLevel,
        style,
      });
      label += ':verdict';

    } else if (system === 'kabbalah') {
      // ═══════════════════════════════════════════════════════════════════════════
      // KABBALAH FULL PIPELINE - Hebrew Name Conversion + Gematria
      // ═══════════════════════════════════════════════════════════════════════════
      // 1. Convert name to Hebrew letters
      // 2. Calculate Gematria values
      // 3. Convert birth date to Hebrew calendar
      // 4. Send structured data to OpenAI (best for Kabbalah interpretation)
      console.log(`🔯 [TextWorker] Running Kabbalah reading for ${docType} with Hebrew preprocessing...`);
      
      const targetPerson = docType === 'person2' ? person2 : person1;
      const targetBirthData = docType === 'person2' ? p2BirthData : p1BirthData;
      
      // Extract name parts (try to split first/last name)
      const fullName = targetPerson.name || 'Unknown';
      const nameParts = fullName.trim().split(/\s+/);
      const firstName = nameParts[0] || fullName;
      const surname = nameParts.length > 1 ? nameParts.slice(1).join(' ') : '';
      
      // Convert name to Hebrew + calculate Gematria
      console.log(`🔯 [Kabbalah] Converting name "${fullName}" to Hebrew...`);
      const firstNameInfo = gematriaService.processName(firstName);
      const surnameInfo = surname ? gematriaService.processName(surname) : null;
      const totalGematria = firstNameInfo.gematria + (surnameInfo?.gematria || 0);
      
      // Helper to romanize Hebrew characters for TTS compatibility
      const romanizeHebrew = (hebrewStr: string): string => {
        const hebrewToRoman: Record<string, string> = {
          'א': 'Aleph', 'ב': 'Bet', 'ג': 'Gimel', 'ד': 'Dalet', 'ה': 'Heh',
          'ו': 'Vav', 'ז': 'Zayin', 'ח': 'Chet', 'ט': 'Tet', 'י': 'Yod',
          'כ': 'Kaf', 'ך': 'Kaf', 'ל': 'Lamed', 'מ': 'Mem', 'ם': 'Mem',
          'נ': 'Nun', 'ן': 'Nun', 'ס': 'Samekh', 'ע': 'Ayin', 'פ': 'Peh',
          'ף': 'Peh', 'צ': 'Tzadi', 'ץ': 'Tzadi', 'ק': 'Qof', 'ר': 'Resh',
          'ש': 'Shin', 'ת': 'Tav'
        };
        return hebrewStr.split('').map(char => hebrewToRoman[char] || char).join('-');
      };
      
      const firstNameRomanized = romanizeHebrew(firstNameInfo.hebrew);
      const surnameRomanized = surnameInfo ? romanizeHebrew(surnameInfo.hebrew) : null;
      
      console.log(`🔯 [Kabbalah] Hebrew: ${firstNameInfo.hebrew}${surnameInfo ? ' ' + surnameInfo.hebrew : ''}`);
      console.log(`🔯 [Kabbalah] Romanized: ${firstNameRomanized}${surnameRomanized ? ' ' + surnameRomanized : ''}`);
      console.log(`🔯 [Kabbalah] Gematria: ${firstNameInfo.gematria}${surnameInfo ? ' + ' + surnameInfo.gematria + ' = ' + totalGematria : ''}`);
      
      // Convert birth date to Hebrew calendar
      let hebrewDateStr = 'birth date not provided';
      let hasValidBirthDate = false;
      try {
        if (targetBirthData?.birthDate && targetBirthData?.timezone) {
          const hebrewDate = await hebrewCalendarService.getHebrewDate(
            `${targetBirthData.birthDate}T${targetBirthData.birthTime || '12:00'}`,
            targetBirthData.timezone
          );
          hebrewDateStr = `${hebrewDate.day} ${hebrewDate.month} ${hebrewDate.year}`;
          if (hebrewDate.specialDay) {
            hebrewDateStr += ` (${hebrewDate.specialDay})`;
          }
          hasValidBirthDate = true;
          console.log(`🔯 [Kabbalah] Hebrew birth date: ${hebrewDateStr}`);
        } else {
          console.warn(`🔯 [Kabbalah] No birth data available for ${fullName}`);
        }
      } catch (e) {
        console.warn(`🔯 [Kabbalah] Hebrew date conversion failed:`, e);
      }
      
      // Get personal context (life events, etc.)
      const contextText = params.personalContext || params.lifeEvents || '';
      
      // Build comprehensive Kabbalah prompt with Hebrew data
      prompt = `CRITICAL FORMATTING WARNING: Do NOT use asterisks (**), markdown, bullet points, or any special formatting. Write pure flowing prose only. No ** around titles or emphasis.

⚠️  CRITICAL AUDIO FORMAT: This reading will become an audiobook. Write as if speaking directly to ${firstName}. Use natural, flowing language that sounds beautiful when spoken aloud. When discussing Hebrew letters, use their English names (Aleph, Bet, Gimel) woven naturally into sentences, not as technical notation.

You are a master Kabbalist interpreting through the Tree of Life.

═══════════════════════════════════════════════════════════════════════════
PRECOMPUTED KABBALAH DATA (use these exact values):
═══════════════════════════════════════════════════════════════════════════

PERSON: ${fullName}

HEBREW NAME ANALYSIS:
• First Name: "${firstName}"
  - Hebrew Letters (Romanized): ${firstNameRomanized}
  - Gematria Value: ${firstNameInfo.gematria}
${surnameInfo ? `• Surname: "${surname}"
  - Hebrew Letters (Romanized): ${surnameRomanized}
  - Gematria Value: ${surnameInfo.gematria}
• TOTAL NAME GEMATRIA: ${totalGematria}` : ''}

${hasValidBirthDate ? `HEBREW BIRTH DATE: ${hebrewDateStr}` : '⚠️  Birth date not available - focus reading on name analysis only'}
Gregorian Birth: ${targetBirthData?.birthDate || 'not provided'}${targetBirthData?.birthTime ? ' at ' + targetBirthData.birthTime : ''}

═══════════════════════════════════════════════════════════════════════════
PERSONAL CONTEXT FROM USER:
═══════════════════════════════════════════════════════════════════════════
${contextText || 'No additional context provided.'}

═══════════════════════════════════════════════════════════════════════════
INTERPRETATION GUIDELINES:
═══════════════════════════════════════════════════════════════════════════

Write a deep Kabbalistic reading exploring:
1. The meaning of each Hebrew letter in their name as a spiritual force
2. The Gematria values and their connection to the Sephirot
3. Their placement in sacred time (Hebrew birth date)
4. Soul journey through the Tree of Life based on their name structure
5. If life events were shared, weave them as activation points

IMPORTANT:
- Letters are STRUCTURAL FORCES, not symbols
- Numbers are QUALITATIVE STATES, not predictions
- Names are CHANNELS OF EXPRESSION and rectification
- Life events are ACTIVATION POINTS, not causes
- Do NOT recalculate any values - use the precomputed data above
- Do NOT predict outcomes or make moral judgments

═══════════════════════════════════════════════════════════════════════════
CRITICAL: HOW TO WRITE ABOUT HEBREW LETTERS (for audio narration):
═══════════════════════════════════════════════════════════════════════════

This reading will be converted to audio. Write naturally using ENGLISH NAMES for Hebrew letters.

✅ CORRECT (flows naturally as speech):
"The letter Aleph opens your name like the first breath of creation. Aleph carries the value of one, the unity that precedes all division. This primal letter holds the tension between above and below, a silent teacher of paradox. Following Aleph comes Bet, the house, the container..."

❌ INCORRECT (unpronounceble):
"The letter א opens your name... א carries the value of one..."

When discussing each letter in their name:
- Use the romanized names: Aleph, Bet, Gimel, Dalet, Heh, Vav, Zayin, Chet, Tet, Yod, Kaf, Lamed, Mem, Nun, Samekh, Ayin, Peh, Tzadi, Qof, Resh, Shin, Tav
- Write as if speaking to someone who cannot see Hebrew script
- Make the letter names part of natural, flowing sentences
- Focus on the MEANING and ENERGY of each letter, not the visual glyph
- Example: "Yod, the smallest letter yet the seed of all others, appears in your name twice..."

Think of this as an audiobook essay on spiritual architecture, not a technical Hebrew lesson.

Style: Mystical, profound, direct address to ${firstName}. ${spiceLevel >= 7 ? 'Be bold and direct.' : 'Be gentle and uplifting.'}
Format: Continuous prose (no bullet points). ~2000 words.

${OUTPUT_FORMAT_RULES}`;

      label += `:kabbalah:${docType}`;
      
    } else {
      if (!system || !(NUCLEAR_V2_SYSTEMS as readonly string[]).includes(system)) {
        throw new Error(`Invalid or missing system for doc ${docNum}: ${system}`);
      }

      const chartKey = system === 'gene_keys' ? 'geneKeys' : system === 'human_design' ? 'humanDesign' : system;

      if (job.type === 'nuclear_v2') {
        if (docType === 'overlay') {
          if (!person2 || !p2BirthData || !p2Placements) {
            throw new Error(`Overlay doc requires person2, but person2 is missing for job ${jobId}`);
          }
          prompt = buildNuclearV2OverlayPrompt({
            system: system as any,
            person1Name: person1.name,
            person2Name: person2.name,
            chartData,
            spiceLevel,
            style,
            relationshipContext: params.relationshipContext,
          });
          label += `:overlay:${system}`;
        } else if (docType === 'person1') {
          prompt = buildPersonPrompt({
            system: system as any,
            personName: person1.name,
            personData: p1BirthData,
            chartData,
            spiceLevel,
            style,
            personalContext: params.personalContext,
          });
          label += `:p1:${system}`;
        } else if (docType === 'person2') {
          if (!person2 || !p2BirthData) {
            throw new Error(`person2 doc requires person2, but person2 is missing for job ${jobId}`);
          }
          prompt = buildPersonPrompt({
            system: system as any,
            personName: person2.name,
            personData: p2BirthData,
            chartData,
            spiceLevel,
            style,
            personalContext: params.personalContext,
          });
          label += `:p2:${system}`;
        } else {
          throw new Error(`Unknown docType for nuclear_v2: ${docType}`);
        }
      } else if (job.type === 'synastry') {
        // Synastry purchase: 3 docs per system (person1, person2, overlay) — NO verdict
        if (!person2 || !p2BirthData) {
          throw new Error(`synastry job requires person2, but person2 is missing for job ${jobId}`);
        }

        if (docType === 'overlay') {
          const chartDataObj: any = { synastry: chartData, [chartKey]: chartData };
          prompt = buildOverlayPrompt({
            type: 'overlay',
            style,
            spiceLevel,
            system: system as any,
            person1: { name: person1.name, ...p1BirthData } as any,
            person2: { name: person2.name, ...p2BirthData } as any,
            chartData: chartDataObj,
            relationshipContext: params.relationshipContext,
          } as any);
          label += `:synastry:overlay:${system}`;
        } else if (docType === 'person1') {
          const chartDataObj: any = { [chartKey]: chartData };
          prompt = buildIndividualPrompt({
            type: 'individual',
            style,
            spiceLevel,
            system: system as any,
            voiceMode: 'other',
            person: { name: person1.name, ...p1BirthData } as any,
            chartData: chartDataObj,
            personalContext: params.personalContext,
          } as any);
          label += `:synastry:p1:${system}`;
        } else if (docType === 'person2') {
          const chartDataObj: any = { [chartKey]: chartData };
          prompt = buildIndividualPrompt({
            type: 'individual',
            style,
            spiceLevel,
            system: system as any,
            voiceMode: 'other',
            person: { name: person2.name, ...p2BirthData } as any,
            chartData: chartDataObj,
            personalContext: params.personalContext,
          } as any);
          label += `:synastry:p2:${system}`;
        } else {
          throw new Error(`Unknown docType for synastry: ${docType}`);
        }
      } else if (job.type === 'extended') {
        if (docType !== 'individual') {
          throw new Error(`Extended jobs should only create 'individual' docs (got ${docType})`);
        }
        const chartDataObj: any = { [chartKey]: chartData };
        prompt = buildIndividualPrompt({
          type: 'individual',
          style,
          spiceLevel,
          system: system as any,
          voiceMode: 'other',
          person: { name: person1.name, ...p1BirthData } as any,
          chartData: chartDataObj,
          personalContext: params.personalContext,
        } as any);
        label += `:individual:${system}`;
      } else {
        throw new Error(`Unhandled job.type: ${job.type}`);
      }
    }

    // DEBUG: Log prompt for Vedic system to verify instructions are included
    if (system === 'vedic') {
      console.log('🔍 [Vedic Debug] System:', system);
      console.log('🔍 [Vedic Debug] Chart data length:', chartData.length);
      console.log('🔍 [Vedic Debug] Chart data preview:', chartData.substring(0, 200));
      console.log('🔍 [Vedic Debug] Prompt includes "VEDIC":', prompt.includes('VEDIC'));
      console.log('🔍 [Vedic Debug] Prompt includes "Nakshatra":', prompt.includes('Nakshatra'));
      console.log('🔍 [Vedic Debug] Prompt includes "Sidereal":', prompt.includes('Sidereal'));
      console.log('🔍 [Vedic Debug] Prompt includes "Jyotish":', prompt.includes('Jyotish'));
      console.log('🔍 [Vedic Debug] Prompt length:', prompt.length);
    }

    // Use centralized LLM service with per-system provider config
    // Config: src/config/llmProviders.ts (Claude for most, OpenAI for Kabbalah)
    const configuredProvider = getProviderForSystem(system || 'western');
    console.log(`🔧 System "${system}" → Provider: ${configuredProvider}`);
    
    let text: string;
    let llmInstance: typeof llm | typeof llmPaid;
    if (configuredProvider === 'claude') {
      // Use Claude Sonnet 4 via llmPaid (unhinged, no censorship)
      llmInstance = llmPaid;
      text = await llmPaid.generate(prompt, label, { 
        maxTokens: 8192, 
        temperature: 0.8,
      });
    } else {
      // Use DeepSeek (default) or OpenAI via llm with provider override
      llmInstance = llm;
      text = await llm.generate(prompt, label, { 
        maxTokens: 8192, 
        temperature: 0.8,
        provider: configuredProvider as LLMProvider,
      });
    }
    
    // 💰 LOG COST for this LLM call
    const usageData = llmInstance.getLastUsage();
    if (usageData) {
      await logLLMCost(
        jobId,
        task.id,
        {
          provider: usageData.provider,
          inputTokens: usageData.usage.inputTokens,
          outputTokens: usageData.usage.outputTokens,
        },
        `text_${system || 'verdict'}_${docType}`
      );
    }
    
    // Post-process: Clean LLM output for spoken audio
    text = text
      // Remove em-dashes and en-dashes
      .replace(/—/g, ', ').replace(/–/g, '-')
      // Remove markdown bold/italic asterisks
      .replace(/\*\*\*/g, '').replace(/\*\*/g, '').replace(/\*/g, '')
      // Remove markdown headers (# ## ### etc)
      .replace(/^#{1,6}\s+/gm, '')
      // Remove markdown underscores for emphasis
      .replace(/___/g, '').replace(/__/g, '').replace(/(?<!\w)_(?!\w)/g, '')
      // Remove duplicate headlines (same line repeated)
      .replace(/^(.+)\n\1$/gm, '$1')
      // Remove section headers (short lines 2-5 words followed by blank line then text)
      // Common patterns: "The Attraction", "Core Identity", "THE SYNTHESIS", etc.
      .replace(/^(The |THE |CHAPTER |Section |Part )?[A-Z][A-Za-z\s]{5,40}\n\n/gm, '')
      // Clean up extra whitespace
      .replace(/\s+,/g, ',').replace(/\n{3,}/g, '\n\n');
    
    const wordCount = text.split(/\s+/).filter(Boolean).length;

    if (wordCount < 200) {
      throw new Error(`LLM returned too little text (${wordCount} words)`);
    }

    // Extract headline from first line of text
    const lines = text.split('\n').filter(line => line.trim());
    const headline = lines[0]?.trim() || '';
    console.log(`📰 Extracted headline: "${headline}"`);

    const excerpt = text.slice(0, 600);

    // Generate dramatic titles (separate LLM call for evocative titles)
    const personName = docType === 'person2' && person2?.name ? person2.name : person1?.name || 'User';
    console.log(`🎭 Generating dramatic titles for ${personName}/${system}...`);
    
    const dramaticTitles = await generateDramaticTitles({
      system: system || 'western',
      personName,
      textExcerpt: excerpt,
      docType: docType as 'person1' | 'person2' | 'overlay' | 'verdict',
      spiceLevel,
    });
    
    console.log(`✅ Dramatic titles generated:`);
    console.log(`   📖 Reading: "${dramaticTitles.readingTitle}"`);
    console.log(`   🎵 Song: "${dramaticTitles.songTitle}"`);

    // Match BaseWorker storage path logic for output (so SQL trigger can enqueue audio tasks)
    const artifactType = 'text' as const;
    const extension = 'txt';
    const textArtifactPath = `${job.user_id}/${jobId}/${artifactType}/${task.id}.${extension}`;

    return {
      success: true,
      output: {
        docNum,
        docType,
        system: system || null,
        title: title || (system ? `${String(system)} - ${docType}` : 'Final Verdict'),
        wordCount,
        excerpt,
        textArtifactPath,
        headline, // Add headline to output
      },
      artifacts: [
        {
          type: 'text',
          buffer: Buffer.from(text, 'utf-8'),
          contentType: 'text/plain; charset=utf-8',
          metadata: {
            jobId,
            docNum,
            docType,
            system: system || null,
            title,
            headline, // LLM-generated headline from first line
            readingTitle: dramaticTitles.readingTitle, // Dramatic title for reading
            songTitle: dramaticTitles.songTitle, // Dramatic title for song
            wordCount,
          },
        },
      ],
    };
  }
}

if (require.main === module) {
  const worker = new TextWorker();
  process.on('SIGTERM', () => worker.stop());
  process.on('SIGINT', () => worker.stop());

  worker.start().catch((error) => {
    console.error('Fatal worker error:', error);
    process.exit(1);
  });
}
