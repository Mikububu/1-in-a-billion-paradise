import { swissEngine } from '../services/swissEphemeris';

async function test() {
  const akasha = {
    birthDate: '1982-10-16',
    birthTime: '06:10',
    timezone: 'Europe/Berlin', // Dachau is near Munich
    latitude: 48.2599,
    longitude: 11.4342,
    relationshipIntensity: 5,
    relationshipMode: 'sensual' as const,
    primaryLanguage: 'en',
  };

  console.log('--- AKASHA TEST ---');
  const result = await swissEngine.computePlacements(akasha);
  
  console.log('\n--- TROPICAL (WESTERN) ---');
  console.log(`Rising Sign: ${result.risingSign}`);
  console.log(`Sun Sign: ${result.sunSign}`);
  console.log(`Moon Sign: ${result.moonSign}`);

  if (result.sidereal) {
    console.log('\n--- SIDEREAL (VEDIC) ---');
    console.log(`Lagna (Rising): ${result.sidereal.lagnaSign}`);
    console.log(`Chandra Rashi (Moon): ${result.sidereal.chandraRashi}`);
    console.log(`Surya Rashi (Sun): ${result.sidereal.suryaRashi}`);
    console.log(`Janma Nakshatra: ${result.sidereal.janmaNakshatra} (Pada ${result.sidereal.janmaPada})`);
    
    console.log('\n--- SIDEREAL GRAHAS ---');
    result.sidereal.grahas.forEach(g => {
      console.log(`${g.key.toUpperCase()}: ${g.sign} ${g.degree}°${g.minute}' (Bhava ${g.bhava})`);
    });
  }
}

test().catch(console.error);
