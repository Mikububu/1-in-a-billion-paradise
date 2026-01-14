import path from 'path';
import fs from 'fs';
import { DateTime } from 'luxon';
import swe from 'swisseph';
import { ReadingPayload } from '../types';

/**
 * SWISS EPHEMERIS CONFIGURATION
 * 
 * Swiss Ephemeris is the ONLY source of truth for astrological calculations.
 * The LLM NEVER calculates positions - it only generates text based on these results.
 * 
 * Ephemeris files contain planetary position data and must be accessible in production.
 */

// Try multiple paths for ephemeris files (deployment flexibility)
const EPHE_PATHS = [
  path.resolve(__dirname, '../../ephe'),                    // Production: /backend/ephe
  path.resolve(__dirname, '../../node_modules/swisseph/ephe'), // Dev: node_modules
  path.resolve(process.cwd(), 'ephe'),                      // Docker: relative to cwd
  '/app/ephe',                                              // Docker absolute
  './ephe',                                                 // Fallback
];

// Find the first valid ephemeris path
function findEphePath(): string {
  console.log('🔍 [Swiss Ephemeris] Searching for ephemeris files...');
  console.log(`[Swiss] Current working directory: ${process.cwd()}`);
  console.log(`[Swiss] __dirname: ${__dirname}`);

  for (const testPath of EPHE_PATHS) {
    try {
      console.log(`[Swiss] Testing path: ${testPath}`);
      const pathExists = fs.existsSync(testPath);
      console.log(`[Swiss]   - Path exists: ${pathExists}`);

      if (pathExists) {
        const markerFile = path.join(testPath, 'sepl_18.se1');
        const markerExists = fs.existsSync(markerFile);
        console.log(`[Swiss]   - Marker file (sepl_18.se1) exists: ${markerExists}`);

        if (markerExists) {
          // List all files in the directory for debugging
          try {
            const files = fs.readdirSync(testPath);
            console.log(`[Swiss]   - Files found (${files.length}):`, files.join(', '));
          } catch (listErr) {
            console.warn(`[Swiss]   - Could not list files:`, listErr);
          }

          console.log(`✅ [Swiss Ephemeris] Using ephe path: ${testPath}`);
          return testPath;
        }
      }
    } catch (err) {
      console.warn(`[Swiss]   - Error testing path ${testPath}:`, err);
    }
  }

  // Default fallback
  const defaultPath = EPHE_PATHS[0] ?? './ephe';
  console.error(`❌ [Swiss Ephemeris] No valid ephe path found! Using fallback: ${defaultPath}`);
  console.error('[Swiss] This will likely cause calculation failures!');
  return defaultPath;
}

const ephePath: string = findEphePath();
swe.swe_set_ephe_path(ephePath);

const SIGNS = [
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

// Default flags for tropical calculations.
const flags = swe.SEFLG_SWIEPH | swe.SEFLG_SPEED;
// Default flags for sidereal (Jyotish) calculations.
// SEFLG_SIDEREAL tells Swiss Ephemeris to use sidereal zodiac.
const siderealFlags = flags | swe.SEFLG_SIDEREAL;

/**
 * Ensure sidereal mode is set to Lahiri.
 * This should be called before any sidereal calculations.
 */
function ensureSiderealMode() {
  try {
    // Lahiri ayanamsa is the most common "Kundli app" default.
    swe.swe_set_sid_mode(swe.SE_SIDM_LAHIRI, 0, 0);
  } catch (e) {
    console.warn('[Swiss Ephemeris] Failed to set sidereal mode (Lahiri):', e);
  }
}

// Initial configuration
ensureSiderealMode();

const toSign = (longitude: number): string => {
  const normalized = (longitude % 360 + 360) % 360;
  const index = Math.floor(normalized / 30);
  return SIGNS[index] ?? 'Unknown';
};

const toSignIndex = (longitude: number): number => {
  const normalized = (longitude % 360 + 360) % 360;
  return Math.floor(normalized / 30) % 12;
};

const toDegrees = (longitude: number): { sign: string; degree: number; minute: number } => {
  const normalized = (longitude % 360 + 360) % 360;
  const signIndex = Math.floor(normalized / 30);
  const degreeInSign = normalized % 30;
  const degree = Math.floor(degreeInSign);
  const minute = Math.floor((degreeInSign - degree) * 60);
  return {
    sign: SIGNS[signIndex] ?? 'Unknown',
    degree,
    minute,
  };
};

/**
 * Calculate which house a planet is in based on house cusps
 * Swiss Ephemeris returns cusps array where cusps[0] = house 1, cusps[1] = house 2, etc.
 * Returns house number (1-12) or undefined if calculation fails
 */
const getHouse = (planetLongitude: number, houseCusps: number[]): number | undefined => {
  if (!houseCusps || houseCusps.length < 13) return undefined; // Swiss Ephemeris returns 13 elements (0-12, where 0 is unused)

  const normalized = (planetLongitude % 360 + 360) % 360;

  // Swiss Ephemeris cusps: cusps[1] = house 1, cusps[2] = house 2, ..., cusps[12] = house 12
  // Check each house (1-12)
  for (let house = 1; house <= 12; house++) {
    const cuspIdx = house; // cusps[1] = house 1 cusp
    const nextCuspIdx = house === 12 ? 1 : house + 1; // Wrap around

    const cusp = (houseCusps[cuspIdx] % 360 + 360) % 360;
    const nextCusp = (houseCusps[nextCuspIdx] % 360 + 360) % 360;

    // Handle house boundary crossing 0° (when next cusp < current cusp)
    if (cusp > nextCusp) {
      // House spans across 0° (e.g., house 12: 350° to 10°)
      if (normalized >= cusp || normalized < nextCusp) {
        return house;
      }
    } else {
      // Normal case (e.g., house 1: 10° to 40°)
      if (normalized >= cusp && normalized < nextCusp) {
        return house;
      }
    }
  }

  return undefined;
};

/**
 * Get decan (1st, 2nd, or 3rd third of the sign)
 * 0-10° = 1st decan, 10-20° = 2nd decan, 20-30° = 3rd decan
 */
const getDecan = (degree: number): 1 | 2 | 3 => {
  if (degree < 10) return 1;
  if (degree < 20) return 2;
  return 3;
};

/**
 * Convert birth data to Julian Day for Swiss Ephemeris
 * Handles timezone conversion properly (critical for historical dates!)
 */
const toJulianDay = (payload: ReadingPayload): number => {
  // Parse the date in the given timezone
  const date = DateTime.fromISO(`${payload.birthDate}T${payload.birthTime}`, {
    zone: payload.timezone
  });

  if (!date.isValid) {
    throw new Error(`Invalid birth date/time: ${payload.birthDate} ${payload.birthTime} in ${payload.timezone}`);
  }

  // Convert to UTC for Swiss Ephemeris
  const utc = date.toUTC();
  const fractionalHour = utc.hour + utc.minute / 60 + utc.second / 3600;

  // Calculate Julian Day
  const jd = swe.swe_julday(utc.year, utc.month, utc.day, fractionalHour, swe.SE_GREG_CAL);

  console.log(`Swiss Ephemeris: ${payload.birthDate} ${payload.birthTime} ${payload.timezone} -> JD ${jd}`);

  return jd;
};

export type PlacementSummary = {
  // Tropical (Western) summary
  sunSign: string;
  moonSign: string;
  risingSign: string;
  sunLongitude: number; // tropical ecliptic longitude (0-360)
  moonLongitude: number; // tropical ecliptic longitude (0-360)
  ascendantLongitude: number; // tropical ascendant longitude (0-360)
  sunDegree?: { sign: string; degree: number; minute: number; decan: 1 | 2 | 3 };
  moonDegree?: { sign: string; degree: number; minute: number; decan: 1 | 2 | 3 };
  ascendantDegree?: { sign: string; degree: number; minute: number; decan: 1 | 2 | 3 };
  sunHouse?: number;
  moonHouse?: number;

  // Sidereal (Vedic/Jyotish) summary
  ayanamsaUt?: number; // degrees
  sidereal?: {
    ayanamsaName: string;
    sunLongitude: number; // sidereal ecliptic longitude (0-360)
    moonLongitude: number; // sidereal ecliptic longitude (0-360)
    ascendantLongitude: number; // sidereal ascendant longitude (0-360)
    rahuLongitude?: number; // mean node (sidereal) - most common default
    ketuLongitude?: number; // 180° opposite Rahu (mean)
    rahuTrueLongitude?: number; // true node (sidereal) - some apps use this
    ketuTrueLongitude?: number; // 180° opposite true Rahu
    lagnaSign: string;
    chandraRashi: string;
    suryaRashi: string;
    janmaNakshatra: string;
    janmaPada: 1 | 2 | 3 | 4;
    // Full graha list for deterministic Vedic analysis (no guessing in prompts).
    // House numbers are WHOLE-SIGN (Rashi houses) based on sidereal lagna sign.
    grahas: Array<{
      key: 'sun' | 'moon' | 'mars' | 'mercury' | 'jupiter' | 'venus' | 'saturn' | 'rahu' | 'ketu';
      longitude: number; // sidereal ecliptic longitude (0-360)
      sign: string;
      degree: number;
      minute: number;
      bhava: number; // 1-12 (whole sign from lagna)
      nakshatra?: string;
      pada?: 1 | 2 | 3 | 4;
      isTrueNode?: boolean; // only for Rahu/Ketu when true node used
    }>;
  };
};

type VedicGrahaKey = NonNullable<PlacementSummary['sidereal']>['grahas'][number]['key'];

export class SwissEphemerisEngine {
  /**
   * Compute Sun, Moon, and Rising signs using Swiss Ephemeris
   * This is the ONLY accurate method - LLMs must NEVER calculate these!
   */
  async computePlacements(payload: ReadingPayload): Promise<PlacementSummary> {
    const jdUt = toJulianDay(payload);

    // Calculate Sun position
    const sun = swe.swe_calc_ut(jdUt, swe.SE_SUN, flags);
    if ('error' in sun) {
      throw new Error(`Swiss Ephemeris Sun calculation failed: ${sun.error}`);
    }
    const sunLongitude = (sun as { longitude: number }).longitude;

    // Calculate Moon position
    const moon = swe.swe_calc_ut(jdUt, swe.SE_MOON, flags);
    if ('error' in moon) {
      throw new Error(`Swiss Ephemeris Moon calculation failed: ${moon.error}`);
    }
    const moonLongitude = (moon as { longitude: number }).longitude;

    // Calculate Houses (Ascendant/Rising + House Cusps) - Tropical Western
    const houses = swe.swe_houses(jdUt, payload.latitude, payload.longitude, 'P'); // Placidus
    if ('error' in houses) {
      throw new Error(`Swiss Ephemeris Houses calculation failed: ${houses.error}`);
    }
    const ascendant = houses.ascendant;
    const houseCusps = houses.house; // Array of 12 house cusps (1-12)

    // Calculate exact degrees with decans
    const sunDeg = toDegrees(sunLongitude);
    const moonDeg = toDegrees(moonLongitude);
    const ascDeg = toDegrees(ascendant);

    // Calculate which houses Sun and Moon are in
    const sunHouse = getHouse(sunLongitude, houseCusps);
    const moonHouse = getHouse(moonLongitude, houseCusps);

    const result: PlacementSummary = {
      sunSign: toSign(sunLongitude),
      moonSign: toSign(moonLongitude),
      risingSign: toSign(ascendant),
      sunLongitude: (sunLongitude % 360 + 360) % 360,
      moonLongitude: (moonLongitude % 360 + 360) % 360,
      ascendantLongitude: (ascendant % 360 + 360) % 360,
      sunDegree: {
        ...sunDeg,
        decan: getDecan(sunDeg.degree),
      },
      moonDegree: {
        ...moonDeg,
        decan: getDecan(moonDeg.degree),
      },
      ascendantDegree: {
        ...ascDeg,
        decan: getDecan(ascDeg.degree),
      },
      sunHouse,
      moonHouse,
    };

    // Sidereal (Vedic) extras: compute sidereal longitudes + sidereal houses/ascendant.
    // NOTE: We keep these attached so the LLM never "guesses" sidereal math.
    try {
      console.log(`[Swiss Ephemeris] Starting sidereal computation for JD ${jdUt}...`);
      
      // Ensure Lahiri ayanamsha is active
      ensureSiderealMode();

      const ayanamsaUt = swe.swe_get_ayanamsa_ut(jdUt);
      console.log(`[Swiss Ephemeris] Current Ayanamsa: ${ayanamsaUt}°`);
      
      const ayanamsaName = swe.swe_get_ayanamsa_name(swe.SE_SIDM_LAHIRI);

      const sunSid = swe.swe_calc_ut(jdUt, swe.SE_SUN, siderealFlags);
      if ('error' in sunSid) throw new Error(`Sun Sidereal: ${sunSid.error}`);
      
      const moonSid = swe.swe_calc_ut(jdUt, swe.SE_MOON, siderealFlags);
      if ('error' in moonSid) throw new Error(`Moon Sidereal: ${moonSid.error}`);
      
      const rahuSid = swe.swe_calc_ut(jdUt, swe.SE_MEAN_NODE, siderealFlags);
      if ('error' in rahuSid) throw new Error(`Rahu Sidereal: ${rahuSid.error}`);
      
      const rahuTrueSid = swe.swe_calc_ut(jdUt, swe.SE_TRUE_NODE, siderealFlags);
      if ('error' in rahuTrueSid) throw new Error(`Rahu True Sidereal: ${rahuTrueSid.error}`);

      const mercurySid = swe.swe_calc_ut(jdUt, swe.SE_MERCURY, siderealFlags);
      if ('error' in mercurySid) throw new Error(`Mercury Sidereal: ${mercurySid.error}`);
      
      const venusSid = swe.swe_calc_ut(jdUt, swe.SE_VENUS, siderealFlags);
      if ('error' in venusSid) throw new Error(`Venus Sidereal: ${venusSid.error}`);
      
      const marsSid = swe.swe_calc_ut(jdUt, swe.SE_MARS, siderealFlags);
      if ('error' in marsSid) throw new Error(`Mars Sidereal: ${marsSid.error}`);
      
      const jupiterSid = swe.swe_calc_ut(jdUt, swe.SE_JUPITER, siderealFlags);
      if ('error' in jupiterSid) throw new Error(`Jupiter Sidereal: ${jupiterSid.error}`);
      
      const saturnSid = swe.swe_calc_ut(jdUt, swe.SE_SATURN, siderealFlags);
      if ('error' in saturnSid) throw new Error(`Saturn Sidereal: ${saturnSid.error}`);

      // Vedic charts are commonly presented as whole-sign houses (Rashi chart).
      // Using swe_houses_ex with SEFLG_SIDEREAL returns a sidereal ascendant longitude.
      const housesSid = swe.swe_houses_ex(jdUt, siderealFlags, payload.latitude, payload.longitude, 'W');
      if ('error' in housesSid) {
        console.warn(`[Swiss Ephemeris] Sidereal houses failed, falling back to Tropical - Ayanamsa math: ${housesSid.error}`);
        // Manual fallback for houses if swe_houses_ex fails with sidereal flag
        const housesTrop = swe.swe_houses(jdUt, payload.latitude, payload.longitude, 'W');
        if ('error' in housesTrop) throw new Error(`House calculation failed: ${housesTrop.error}`);
        
        // Manual sidereal adjustment
        (housesSid as any).ascendant = (housesTrop.ascendant - ayanamsaUt + 360) % 360;
        (housesSid as any).house = housesTrop.house.map(h => (h - ayanamsaUt + 360) % 360);
      }

      const sunSidLon = ((sunSid as any).longitude % 360 + 360) % 360;
      const moonSidLon = ((moonSid as any).longitude % 360 + 360) % 360;
      const ascSidLon = ((housesSid as any).ascendant % 360 + 360) % 360;
      const rahuSidLon = ((rahuSid as any).longitude % 360 + 360) % 360;
      const ketuSidLon = (rahuSidLon + 180) % 360;
      const rahuTrueSidLon = ((rahuTrueSid as any).longitude % 360 + 360) % 360;
      const ketuTrueSidLon = (rahuTrueSidLon + 180) % 360;
      const mercurySidLon = (((mercurySid as any).longitude as number) % 360 + 360) % 360;
      const venusSidLon = (((venusSid as any).longitude as number) % 360 + 360) % 360;
      const marsSidLon = (((marsSid as any).longitude as number) % 360 + 360) % 360;
      const jupiterSidLon = (((jupiterSid as any).longitude as number) % 360 + 360) % 360;
      const saturnSidLon = (((saturnSid as any).longitude as number) % 360 + 360) % 360;

      console.log(`[Swiss Ephemeris] Sidereal positions calculated: Lagna=${toSign(ascSidLon)} ${ascSidLon % 30}°, Sun=${toSign(sunSidLon)} ${sunSidLon % 30}°`);

      // Nakshatra math: 27 nakshatras × 13°20' each; 4 padas × 3°20' each.
      const NAK_LEN = 360 / 27; // 13.3333333333...
      const PADA_LEN = NAK_LEN / 4; // 3.3333333333...
      const nakshatras = [
        'Ashwini', 'Bharani', 'Krittika', 'Rohini', 'Mrigashira', 'Ardra',
        'Punarvasu', 'Pushya', 'Ashlesha', 'Magha', 'Purva Phalguni', 'Uttara Phalguni',
        'Hasta', 'Chitra', 'Swati', 'Vishakha', 'Anuradha', 'Jyeshtha',
        'Mula', 'Purva Ashadha', 'Uttara Ashadha', 'Shravana', 'Dhanishtha', 'Shatabhisha',
        'Purva Bhadrapada', 'Uttara Bhadrapada', 'Revati',
      ];
      const nakIdx = Math.floor(moonSidLon / NAK_LEN) % 27;
      const janmaNakshatra = nakshatras[nakIdx] || 'Unknown';
      const pada = (Math.floor((moonSidLon % NAK_LEN) / PADA_LEN) + 1) as 1 | 2 | 3 | 4;

      const lagnaSignIndex = toSignIndex(ascSidLon);
      const wholeSignBhava = (planetLon: number) => ((toSignIndex(planetLon) - lagnaSignIndex + 12) % 12) + 1;

      const toGraha = (
        key: VedicGrahaKey,
        lon: number,
        extra?: Partial<NonNullable<PlacementSummary['sidereal']>['grahas'][number]>
      ) => {
        const d = toDegrees(lon);
        return {
          key,
          longitude: lon,
          sign: d.sign,
          degree: d.degree,
          minute: d.minute,
          bhava: wholeSignBhava(lon),
          ...extra,
        };
      };

      result.ayanamsaUt = ayanamsaUt;
      result.sidereal = {
        ayanamsaName,
        sunLongitude: sunSidLon,
        moonLongitude: moonSidLon,
        ascendantLongitude: ascSidLon,
        rahuLongitude: rahuSidLon,
        ketuLongitude: ketuSidLon,
        rahuTrueLongitude: rahuTrueSidLon,
        ketuTrueLongitude: ketuTrueSidLon,
        lagnaSign: toSign(ascSidLon),
        chandraRashi: toSign(moonSidLon),
        suryaRashi: toSign(sunSidLon),
        janmaNakshatra,
        janmaPada: pada,
        grahas: [
          toGraha('sun', sunSidLon),
          toGraha('moon', moonSidLon, { nakshatra: janmaNakshatra, pada }),
          toGraha('mars', marsSidLon),
          toGraha('mercury', mercurySidLon),
          toGraha('jupiter', jupiterSidLon),
          toGraha('venus', venusSidLon),
          toGraha('saturn', saturnSidLon),
          toGraha('rahu', rahuSidLon),
          toGraha('ketu', ketuSidLon),
          // True node variants are included for Kundli-style configurability
          // (some apps let users choose True vs Mean Rahu). We keep them separate.
          toGraha('rahu', rahuTrueSidLon, { isTrueNode: true }),
          toGraha('ketu', ketuTrueSidLon, { isTrueNode: true }),
        ],
      };
    } catch (e) {
      console.warn('[Swiss Ephemeris] Sidereal computation failed:', e);
    }

    console.log(`Swiss Ephemeris Results:`, JSON.stringify(result, null, 2));

    return result;
  }

  /**
   * Verify the ephemeris files are loaded correctly
   */
  async healthCheck(): Promise<{ status: 'ok' | 'error'; message: string }> {
    try {
      // Test calculation for a known date
      const testResult = await this.computePlacements({
        birthDate: '2000-01-01',
        birthTime: '12:00',
        timezone: 'UTC',
        latitude: 0,
        longitude: 0,
        relationshipIntensity: 5,
        relationshipMode: 'sensual',
        primaryLanguage: 'en',
      });

      if (testResult.sunSign === 'Capricorn') {
        return { status: 'ok', message: `Ephemeris loaded from: ${ephePath}` };
      }
      return { status: 'error', message: 'Unexpected test result' };
    } catch (error) {
      return { status: 'error', message: String(error) };
    }
  }
}

export const swissEngine = new SwissEphemerisEngine();
