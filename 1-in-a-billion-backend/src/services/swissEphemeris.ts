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

const flags = swe.SEFLG_SWIEPH | swe.SEFLG_SPEED;

const toSign = (longitude: number): string => {
  const normalized = (longitude % 360 + 360) % 360;
  const index = Math.floor(normalized / 30);
  return SIGNS[index] ?? 'Unknown';
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
  sunSign: string;
  moonSign: string;
  risingSign: string;
  sunDegree?: { sign: string; degree: number; minute: number; decan: 1 | 2 | 3 };
  moonDegree?: { sign: string; degree: number; minute: number; decan: 1 | 2 | 3 };
  ascendantDegree?: { sign: string; degree: number; minute: number; decan: 1 | 2 | 3 };
  sunHouse?: number;
  moonHouse?: number;
};

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

    // Calculate Houses (Ascendant/Rising + House Cusps)
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
