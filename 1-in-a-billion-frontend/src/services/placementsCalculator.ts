/**
 * PLACEMENTS CALCULATOR
 * Calculates Sun/Moon/Rising signs using Swiss Ephemeris via backend
 */

import { env } from '@/config/env';

export interface Placements {
  sunSign: string;
  sunDegree?: any;
  moonSign: string;
  moonDegree?: any;
  risingSign: string;
  risingDegree?: any;
}

export function normalizePlacements(raw: any): Placements | null {
  if (!raw || typeof raw !== 'object') return null;

  // Support a few historical/backend variants
  const sunSign =
    raw.sunSign ||
    raw.sun?.sign ||
    raw.sun?.signName ||
    raw.SunSign ||
    raw.sun_sign;
  const moonSign =
    raw.moonSign ||
    raw.moon?.sign ||
    raw.moon?.signName ||
    raw.MoonSign ||
    raw.moon_sign;
  const risingSign =
    raw.risingSign ||
    raw.ascendantSign ||
    raw.ascSign ||
    raw.ascendant?.sign ||
    raw.RisingSign ||
    raw.rising_sign;

  const sunDegree = raw.sunDegree || raw.sun_degree || raw.sun?.degree || raw.sun?.position;
  const moonDegree = raw.moonDegree || raw.moon_degree || raw.moon?.degree || raw.moon?.position;
  const risingDegree =
    raw.risingDegree ||
    raw.ascendantDegree ||
    raw.asc_degree ||
    raw.ascendant?.degree ||
    raw.rising_degree;

  if (!sunSign || !moonSign || !risingSign) return null;

  return {
    sunSign,
    sunDegree,
    moonSign,
    moonDegree,
    risingSign,
    risingDegree,
  };
}

export interface BirthData {
  birthDate: string;
  birthTime: string;
  timezone: string;
  latitude: number;
  longitude: number;
}

/**
 * Calculate placements from birth data using Swiss Ephemeris
 * @param birthData Birth date, time, location
 * @returns Placements object with Sun/Moon/Rising signs, or null if calculation fails
 */
export async function calculatePlacements(
  birthData: BirthData,
  system: 'western' | 'vedic' = 'western'
): Promise<Placements | null> {
  try {
    // IMPORTANT: Placements must come from Swiss Ephemeris (backend) — never from LLM endpoints.
    // In dev on iOS Simulator, `localhost` should work, so we try it automatically if the primary
    // CORE_API_URL (often Fly) is missing the endpoint / not reachable.
    if (__DEV__) {
      console.log(`🔮 Calculating positions [${system}] (Swiss Ephemeris)...`);
    }

    const placementsPayload = {
      birthDate: birthData.birthDate,
      birthTime: birthData.birthTime,
      timezone: birthData.timezone,
      latitude: birthData.latitude,
      longitude: birthData.longitude,
      system, // 'western' (Tropical) or 'vedic' (Sidereal/Lahiri)
    };

    const baseCandidates = [
      env.CORE_API_URL,
      // Dev/simulator fallbacks:
      'http://localhost:8787',
      'http://127.0.0.1:8787',
    ];
    const bases = Array.from(new Set(baseCandidates.filter(Boolean)));

    for (const base of bases) {
      try {
        const res = await fetch(`${base}/api/reading/placements`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(placementsPayload),
        });

        if (!res.ok) continue;
        const data = await res.json();
        const normalized = normalizePlacements(data?.placements ?? data);
        if (!normalized) continue;

        if (__DEV__) {
          console.log('✅ Placements:', {
            base,
            sun: normalized.sunSign,
            moon: normalized.moonSign,
            rising: normalized.risingSign,
          });
        }
        return normalized;
      } catch {
        // Try next base
      }
    }

    // No console.error here: this used to surface as a red LogBox and felt like "the app is broken".
    // The UI can still function without placements; we'll just skip backfill.
    if (__DEV__) {
      console.log('⚠️ Placements calculation failed (all bases).', { bases });
    }
    return null;
  } catch (error) {
    if (__DEV__) {
      console.log('⚠️ Error calculating placements:', error);
    }
    return null;
  }
}

/**
 * Backfill placements for people who don't have them yet
 * Call this from DevResetButton or a utility screen
 */
export async function backfillMissingPlacements(
  people: Array<{ id: string; name: string; birthData: any; placements?: any }>,
  updatePerson: (id: string, updates: any) => void,
  force: boolean = false
): Promise<{ updated: number; failed: number }> {
  console.log('🔄 BACKFILLING MISSING PLACEMENTS' + (force ? ' (FORCE MODE)' : ''));

  let updated = 0;
  let failed = 0;

  for (const person of people) {
    // Skip if already has placements (unless force mode)
    if (!force && person.placements?.sunSign && person.placements?.moonSign && person.placements?.risingSign) {
      console.log(`✓ ${person.name}: Already has placements`);
      continue;
    }

    // Skip if missing birth data
    const bd = person.birthData;
    if (!bd?.birthDate || !bd?.birthTime || !bd?.timezone || typeof bd?.latitude !== 'number' || typeof bd?.longitude !== 'number') {
      console.log(`⚠️  ${person.name}: Missing birth data`);
      failed++;
      continue;
    }

    console.log(`🔮 ${person.name}: Calculating placements...`);
    const placements = await calculatePlacements({
      birthDate: bd.birthDate,
      birthTime: bd.birthTime,
      timezone: bd.timezone,
      latitude: bd.latitude,
      longitude: bd.longitude,
    });

    if (placements) {
      updatePerson(person.id, { placements });
      console.log(`✅ ${person.name}: ☉${placements.sunSign} ☽${placements.moonSign} ↑${placements.risingSign}`);
      updated++;
    } else {
      console.log(`❌ ${person.name}: Calculation failed`);
      failed++;
    }

    // Small delay to avoid hammering the backend
    await new Promise(resolve => setTimeout(resolve, 500));
  }

  console.log(`\n📊 BACKFILL COMPLETE: ${updated} updated, ${failed} failed`);
  return { updated, failed };
}

