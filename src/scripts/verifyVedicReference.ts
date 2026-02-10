/**
 * VEDIC REFERENCE VERIFICATION
 *
 * A small regression test to ensure our Jyotish (sidereal) calculations remain stable.
 * This uses Swiss Ephemeris sidereal mode (Lahiri) and checks a known reference chart.
 *
 * Reference profile:
 * - Akasha Akasha (importPeople.ts fixture)
 * - 1982-10-16 06:10 Europe/Berlin
 * - Dachau, Bavaria, Germany (48.2599, 11.4342)
 *
 * Expected (matches common Kundli apps with Lahiri ayanamsa):
 * - Lagna: Virgo
 * - Chandra Rashi: Virgo
 * - Janma Nakshatra: Hasta, Pada 3
 */

import { swissEngine } from '../services/swissEphemeris';

function assertEqual(label: string, actual: any, expected: any) {
  if (actual !== expected) {
    throw new Error(`${label} mismatch: expected "${expected}", got "${actual}"`);
  }
}

async function main() {
  const r = await swissEngine.computePlacements({
    birthDate: '1982-10-16',
    birthTime: '06:10',
    timezone: 'Europe/Berlin',
    latitude: 48.2599,
    longitude: 11.4342,
    relationshipIntensity: 5,
    relationshipMode: 'sensual',
    primaryLanguage: 'en',
  });

  if (!r.sidereal) {
    throw new Error('Missing sidereal output (Vedic computation failed)');
  }

  assertEqual('Lagna', r.sidereal.lagnaSign, 'Virgo');
  assertEqual('Chandra Rashi', r.sidereal.chandraRashi, 'Virgo');
  assertEqual('Janma Nakshatra', r.sidereal.janmaNakshatra, 'Hasta');
  assertEqual('Janma Pada', r.sidereal.janmaPada, 3);

  // eslint-disable-next-line no-console
  console.log('✅ Vedic reference verification passed:', {
    lagna: r.sidereal.lagnaSign,
    chandraRashi: r.sidereal.chandraRashi,
    nakshatra: r.sidereal.janmaNakshatra,
    pada: r.sidereal.janmaPada,
    ayanamsaUt: r.ayanamsaUt,
  });
}

main().catch((e) => {
  // eslint-disable-next-line no-console
  console.error('❌ Vedic reference verification failed:', e?.message || e);
  process.exit(1);
});

