/**
 * TEXT WORKER - LLM Text Generation
 *
 * Processes text_generation tasks for the Supabase Queue (Job Queue V2).
 * Intended to run as a stateless RunPod Serverless worker.
 */

import { BaseWorker, TaskResult } from './baseWorker';
import { JobTask, supabase } from '../services/supabaseClient';
import { ephemerisIsolation } from '../services/ephemerisIsolation'; // Isolated process (crash-safe)
import { llm } from '../services/llm'; // Centralized LLM service
import {
  SYSTEMS as NUCLEAR_V2_SYSTEMS,
  SYSTEM_DISPLAY_NAMES as NUCLEAR_V2_SYSTEM_NAMES,
  buildPersonPrompt,
  buildOverlayPrompt as buildNuclearV2OverlayPrompt,
  buildVerdictPrompt,
} from '../prompts/structures/nuclearV2';
import { buildIndividualPrompt } from '../prompts';
import { SpiceLevel } from '../prompts/spice/levels';

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
  p1BirthData: { birthDate: string; birthTime: string },
  p2BirthData: { birthDate: string; birthTime: string } | null
): string {
  const formatDegree = (d: any) => (d ? `${d.degree}° ${d.minute}'` : '');
  const hasP2 = Boolean(person2Name && p2Placements && p2BirthData);

  // Calculate approximate sidereal positions (Lahiri ayanamsa ~23°50')
  const AYANAMSA = 23.85; // Lahiri ayanamsa for current era
  const toSidereal = (tropicalDegree: number) => {
    const sidereal = tropicalDegree - AYANAMSA;
    return sidereal < 0 ? sidereal + 360 : sidereal;
  };

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
    return nakshatras[Math.floor(degree / 13.333) % 27];
  };

  // Calculate Human Design gates from Sun position
  const getHDGate = (degree: number): number => {
    // Human Design uses a specific mapping of degrees to I Ching gates
    const gateMap = [41, 19, 13, 49, 30, 55, 37, 63, 22, 36, 25, 17, 21, 51, 42, 3, 27, 24, 2, 23, 8, 20, 16, 35, 45, 12, 15, 52, 39, 53, 62, 56, 31, 33, 7, 4, 29, 59, 40, 64, 47, 6, 46, 18, 48, 57, 32, 50, 28, 44, 1, 43, 14, 34, 9, 5, 26, 11, 10, 58, 38, 54, 61, 60];
    return gateMap[Math.floor(degree / 5.625) % 64];
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

  // Extract tropical degrees (estimate from sign if exact degree not available)
  const signToDegree: Record<string, number> = {
    'Aries': 15, 'Taurus': 45, 'Gemini': 75, 'Cancer': 105, 'Leo': 135, 'Virgo': 165,
    'Libra': 195, 'Scorpio': 225, 'Sagittarius': 255, 'Capricorn': 285, 'Aquarius': 315, 'Pisces': 345
  };

  const p1SunDeg = p1Placements.sunDegree?.degree || signToDegree[p1Placements.sunSign] || 0;
  const p1MoonDeg = p1Placements.moonDegree?.degree || signToDegree[p1Placements.moonSign] || 0;
  const p2SunDeg = hasP2 ? (p2Placements!.sunDegree?.degree || signToDegree[p2Placements!.sunSign] || 0) : 0;
  const p2MoonDeg = hasP2 ? (p2Placements!.moonDegree?.degree || signToDegree[p2Placements!.moonSign] || 0) : 0;

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
      const p1SunSidereal = toSidereal(p1SunDeg);
      const p1MoonSidereal = toSidereal(p1MoonDeg);
      const p1AscSidereal = p1Placements.ascendantDegree ? toSidereal((p1Placements.ascendantDegree.degree || 0) + (p1Placements.ascendantDegree.minute || 0) / 60) : 0;
      const p1LagnaSign = p1AscSidereal > 0 ? getZodiacSign(p1AscSidereal) : 'Unknown';
      const p1LagnaLord = p1AscSidereal > 0 ? ['Mars', 'Venus', 'Mercury', 'Moon', 'Sun', 'Mercury', 'Venus', 'Mars', 'Jupiter', 'Saturn', 'Saturn', 'Jupiter'][Math.floor(p1AscSidereal / 30) % 12] : 'Unknown';
      
      // Calculate Rahu-Ketu (Moon's nodes - approximate)
      // Rahu = Moon's North Node, Ketu = Moon's South Node (180° opposite)
      // Simplified: Use Moon position + 90° for Rahu, -90° for Ketu
      const p1RahuSidereal = (p1MoonSidereal + 90) % 360;
      const p1KetuSidereal = (p1MoonSidereal - 90 + 360) % 360;
      
      const p1MoonNakshatra = getNakshatra(p1MoonSidereal);
      const p1MoonNakshatraLord = ['Ketu', 'Venus', 'Sun', 'Moon', 'Mars', 'Rahu', 'Jupiter', 'Saturn', 'Mercury'][Math.floor(p1MoonSidereal / 13.333) % 9];
      const p1MoonPada = Math.floor((p1MoonSidereal % 13.333) / 3.333) + 1;
      
      const p2SunSidereal = hasP2 ? toSidereal(p2SunDeg) : 0;
      const p2MoonSidereal = hasP2 ? toSidereal(p2MoonDeg) : 0;
      const p2AscSidereal = hasP2 && p2Placements?.ascendantDegree ? toSidereal((p2Placements.ascendantDegree.degree || 0) + (p2Placements.ascendantDegree.minute || 0) / 60) : 0;
      const p2LagnaSign = p2AscSidereal > 0 ? getZodiacSign(p2AscSidereal) : 'Unknown';
      const p2LagnaLord = p2AscSidereal > 0 ? ['Mars', 'Venus', 'Mercury', 'Moon', 'Sun', 'Mercury', 'Venus', 'Mars', 'Jupiter', 'Saturn', 'Saturn', 'Jupiter'][Math.floor(p2AscSidereal / 30) % 12] : 'Unknown';
      const p2RahuSidereal = hasP2 ? (p2MoonSidereal + 90) % 360 : 0;
      const p2KetuSidereal = hasP2 ? (p2MoonSidereal - 90 + 360) % 360 : 0;
      const p2MoonNakshatra = hasP2 ? getNakshatra(p2MoonSidereal) : '';
      const p2MoonNakshatraLord = hasP2 ? ['Ketu', 'Venus', 'Sun', 'Moon', 'Mars', 'Rahu', 'Jupiter', 'Saturn', 'Mercury'][Math.floor(p2MoonSidereal / 13.333) % 9] : '';
      const p2MoonPada = hasP2 ? Math.floor((p2MoonSidereal % 13.333) / 3.333) + 1 : 0;

      if (!hasP2) {
        return `${person1Name.toUpperCase()} VEDIC JYOTISH CHART (SIDEREAL ONLY):

═══════════════════════════════════════════════════════════════════════════════
CRITICAL: THIS IS PURE VEDIC ASTROLOGY - ZERO WESTERN CONCEPTS ALLOWED
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
- Use "Nakshatra" (27 lunar mansions, not zodiac signs)
- Use "Dasha" for planetary periods (Vimshottari system)

═══════════════════════════════════════════════════════════════════════════════
CHART DATA (SIDEREAL - LAHIRI AYANAMSA):
═══════════════════════════════════════════════════════════════════════════════

LAGNA (SOUL PORTAL):
- Lagna Rashi: ${p1LagnaSign} ${Math.floor(p1AscSidereal % 30)}° ${Math.floor((p1AscSidereal % 1) * 60)}'
- Lagna Lord: ${p1LagnaLord}
- The Lagna is the portal through which the soul entered this body. It determines the dharmic direction and life path.

CHANDRA (MOON) - THE MIND ITSELF:
- Chandra Rashi: ${getZodiacSign(p1MoonSidereal)} ${Math.floor(p1MoonSidereal % 30)}° ${Math.floor((p1MoonSidereal % 1) * 60)}'
- Janma Nakshatra: ${p1MoonNakshatra} (Pada ${p1MoonPada}/4)
- Nakshatra Lord: ${p1MoonNakshatraLord}
- CRITICAL: In Jyotish, the Moon Rashi IS the mind. The Janma Nakshatra is MORE IMPORTANT than the Rashi - it reveals the soul's emotional nature, ruling deity, animal symbol, guna quality (sattva/rajas/tamas), and karmic patterns.

SURYA (SUN) - SOUL PURPOSE:
- Surya Rashi: ${getZodiacSign(p1SunSidereal)} ${Math.floor(p1SunSidereal % 30)}° ${Math.floor((p1SunSidereal % 1) * 60)}'
- Surya Nakshatra: ${getNakshatra(p1SunSidereal)}
- Represents the soul's purpose, dharma, and essential nature.

RAHU-KETU AXIS (KARMIC NODES):
- Rahu: ${getZodiacSign(p1RahuSidereal)} ${Math.floor(p1RahuSidereal % 30)}° - Where the soul is HUNGRY, overcompensating, obsessed this lifetime (material desires, worldly attachments)
- Ketu: ${getZodiacSign(p1KetuSidereal)} ${Math.floor(p1KetuSidereal % 30)}° - Where the soul is EXHAUSTED, done, cutting loose (past life mastery, spiritual detachment)

═══════════════════════════════════════════════════════════════════════════════
VEDIC ANALYSIS REQUIREMENTS (PURE JYOTISH ONLY):
═══════════════════════════════════════════════════════════════════════════════

1. LAGNA ANALYSIS:
   - Lagna lord strength (exaltation, debilitation, own sign, friend/enemy)
   - Lagna lord placement and aspects
   - Benefic vs malefic nature for this specific Lagna

2. NAKSHATRA ANALYSIS (MOST CRITICAL):
   - Janma Nakshatra deity and what the deity WANTS from this person
   - Nakshatra planetary ruler (links to Dasha system)
   - Pada (quarter) analysis - each pada has different flavor
   - Animal symbol (instinctual nature)
   - Guna quality (sattva/rajas/tamas)
   - Nakshatra is MORE IMPORTANT than Rashi in Jyotish

3. PLANETARY ANALYSIS:
   - All Grahas in sidereal positions only
   - Planetary strengths: exaltation (Uccha), debilitation (Neecha), own sign (Swakshetra)
   - Friend/enemy relationships between planets
   - Key house lords: 1st (Lagna), 4th, 7th, 9th, 10th Bhava lords

4. DASHA SYSTEM (VIMSHOTTARI):
   - Current Mahadasha (based on Moon Nakshatra lord)
   - Current Antardasha (sub-period)
   - Upcoming periods and their implications
   - Dasha activation of Yogas and Doshas

5. YOGAS (PLANETARY COMBINATIONS):
   - Raja Yoga (power, success, authority)
   - Dhana Yoga (wealth, prosperity)
   - Difficult yogas if present (Kemadruma, etc.)
   - Yogas must be analyzed in sidereal positions only

6. KARMIC INDICATORS:
   - Rahu-Ketu axis (past life patterns, current lessons)
   - 8th Bhava (longevity, transformation, hidden matters)
   - 12th Bhava (spiritual liberation, losses, moksha)
   - Atmakaraka (soul significator - planet with highest degree)

7. HOUSE SYSTEM:
   - Use Vedic Bhava system (not Western house meanings)
   - Each Bhava has specific Vedic significations
   - Bhava lords and their condition

═══════════════════════════════════════════════════════════════════════════════
ABSOLUTE REQUIREMENTS:
═══════════════════════════════════════════════════════════════════════════════

- Use ONLY sidereal positions (Lahiri ayanamsa)
- Use ONLY Vedic terminology (Rashi, Lagna, Nakshatra, Graha, Bhava, Dasha)
- Focus on Nakshatras, Dashas, and Vedic house system
- DO NOT reference tropical zodiac, Western astrology, or Western house meanings
- DO NOT use "Sun sign", "Moon sign", "Ascendant" - use Vedic terms only
- This is PURE JYOTISH - zero mixing with Western concepts`;
      }

      return `${person1Name.toUpperCase()} VEDIC JYOTISH CHART (SIDEREAL ONLY):

═══════════════════════════════════════════════════════════════════════════════
CRITICAL: PURE VEDIC ASTROLOGY - ZERO WESTERN CONCEPTS ALLOWED
═══════════════════════════════════════════════════════════════════════════════

FORBIDDEN: "Sun sign", "Moon sign", "Ascendant", "Rising", "house", tropical zodiac, Western astrology

REQUIRED: "Rashi", "Lagna", "Nakshatra", "Graha", "Bhava", "Dasha" (Vedic terms only)

LAGNA (SOUL PORTAL):
- Lagna Rashi: ${p1LagnaSign} ${Math.floor(p1AscSidereal % 30)}° - Lagna Lord: ${p1LagnaLord}

CHANDRA (MOON) - THE MIND:
- Chandra Rashi: ${getZodiacSign(p1MoonSidereal)} ${Math.floor(p1MoonSidereal % 30)}° 
- Janma Nakshatra: ${p1MoonNakshatra} (Pada ${p1MoonPada}/4) - Lord: ${p1MoonNakshatraLord}

SURYA (SUN) - SOUL PURPOSE:
- Surya Rashi: ${getZodiacSign(p1SunSidereal)} ${Math.floor(p1SunSidereal % 30)}° - Nakshatra: ${getNakshatra(p1SunSidereal)}

RAHU-KETU AXIS (KARMIC NODES):
- Rahu: ${getZodiacSign(p1RahuSidereal)} ${Math.floor(p1RahuSidereal % 30)}° | Ketu: ${getZodiacSign(p1KetuSidereal)} ${Math.floor(p1KetuSidereal % 30)}°

${person2Name!.toUpperCase()} VEDIC JYOTISH CHART (SIDEREAL ONLY):

LAGNA (SOUL PORTAL):
- Lagna Rashi: ${p2LagnaSign} ${Math.floor(p2AscSidereal % 30)}° - Lagna Lord: ${p2LagnaLord}

CHANDRA (MOON) - THE MIND:
- Chandra Rashi: ${getZodiacSign(p2MoonSidereal)} ${Math.floor(p2MoonSidereal % 30)}° 
- Janma Nakshatra: ${p2MoonNakshatra} (Pada ${p2MoonPada}/4) - Lord: ${p2MoonNakshatraLord}

SURYA (SUN) - SOUL PURPOSE:
- Surya Rashi: ${getZodiacSign(p2SunSidereal)} ${Math.floor(p2SunSidereal % 30)}° - Nakshatra: ${getNakshatra(p2SunSidereal)}

RAHU-KETU AXIS (KARMIC NODES):
- Rahu: ${getZodiacSign(p2RahuSidereal)} ${Math.floor(p2RahuSidereal % 30)}° | Ketu: ${getZodiacSign(p2KetuSidereal)} ${Math.floor(p2KetuSidereal % 30)}°

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

    if (job.type !== 'nuclear_v2' && job.type !== 'extended') {
      return { success: false, error: `TextWorker only supports nuclear_v2 and extended right now (got ${job.type})` };
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
    const docType: 'person1' | 'person2' | 'overlay' | 'verdict' = task.input?.docType || (docNum === 16 ? 'verdict' : 'person1');
    const system: string | null = task.input?.system ?? null;
    const title: string = task.input?.title || (docType === 'verdict' ? 'Final Verdict' : 'Untitled');

    // Update progress: text generation started
    await supabase.rpc('update_job_progress', {
      p_job_id: jobId,
      p_progress: {
        phase: 'text',
        message: `📝 ${title}...`,
        currentStep: `TEXT: Doc ${docNum}/16`,
        docsComplete: Number(task.input?.docsComplete || 0),
        docsTotal: 16,
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
    };

    const p2BirthData = person2 ? {
      birthDate: person2.birthDate,
      birthTime: person2.birthTime,
      birthPlace: `${Number(person2.latitude).toFixed(2)}°N, ${Number(person2.longitude).toFixed(2)}°E`,
    } : null;

    // ═══════════════════════════════════════════════════════════════════════════
    // CRITICAL FIX: Use SYSTEM-SPECIFIC chart data, not generic Western data!
    // Each system needs its own language: Vedic=Nakshatras, HD=Gates, GK=Gene Keys, etc.
    // ═══════════════════════════════════════════════════════════════════════════
    const chartData = buildChartDataForSystem(
      system || 'western',  // Use the actual system from task input
      person1.name,
      p1Placements,
      person2?.name || null,
      p2Placements,
      p1BirthData,
      p2BirthData
    );

    console.log(`📊 [TextWorker] Building ${system} chart data for doc ${docNum} (not Western unless system=western)`);

    let prompt = '';
    let label = `job:${jobId}:doc:${docNum}`;

    if (docType === 'verdict') {
      // Build summary from completed text tasks
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

    } else {
      if (!system || !(NUCLEAR_V2_SYSTEMS as readonly string[]).includes(system)) {
        throw new Error(`Invalid or missing system for doc ${docNum}: ${system}`);
      }

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
          relationshipContext: params.relationshipContext, // Optional context for interpretive emphasis
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
          personalContext: params.personalContext, // Pass through for individual reading personalization
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
          personalContext: params.personalContext, // Pass through for individual reading personalization
        });
        label += `:p2:${system}`;
      } else if (docType === 'individual') {
        // Single-person deep dive (single system). Ensure name + correct chartData key are provided.
        const safeSystem = system || 'western';
        prompt = buildIndividualPrompt({
          type: 'individual',
          style,
          spiceLevel: spiceLevel as SpiceLevel, // Cast number to SpiceLevel union type
          system: safeSystem as any,
          voiceMode: 'other',
          person: {
            name: person1.name,
            ...p1BirthData,
          } as any, // Cast to match PersonData
          // Provide chart data under the correct system key (not always western)
          chartData: { [safeSystem]: chartData } as any,
          personalContext: params.personalContext, // Pass through for individual reading personalization
        });
        // personName is already embedded in the prompt via buildIndividualPrompt() config
        label += `:individual:${system}`;
      } else {
        throw new Error(`Unknown docType: ${docType}`);
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

    // Use centralized LLM service (provider set by LLM_PROVIDER env)
    const text = await llm.generate(prompt, label, { maxTokens: 8192, temperature: 0.8 });
    const wordCount = text.split(/\s+/).filter(Boolean).length;

    if (wordCount < 200) {
      throw new Error(`LLM returned too little text (${wordCount} words)`);
    }

    const excerpt = text.slice(0, 600);

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
