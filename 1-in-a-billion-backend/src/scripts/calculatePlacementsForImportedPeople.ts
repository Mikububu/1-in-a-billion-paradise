/**
 * CALCULATE PLACEMENTS FOR IMPORTED PEOPLE
 * 
 * Calculates Swiss Ephemeris placements for all imported people
 * and updates them in Supabase (if configured) and exports JSON for offline storage.
 */

import { swissEngine } from '../services/swissEphemeris';
import { createSupabaseServiceClient } from '../services/supabaseClient';
import fs from 'fs';
import path from 'path';

const IMPORTED_PEOPLE = [
  { id: 'charmaine', name: 'Charmaine', gender: 'female', birthDate: '1983-11-23', birthTime: '06:25', birthCity: 'Hong Kong', timezone: 'Asia/Hong_Kong', latitude: 22.3193, longitude: 114.1694 },
  { id: 'iya', name: 'Iya', gender: 'female', birthDate: '1998-03-24', birthTime: '10:45', birthCity: 'Tagum, Davao del Norte, Philippines', timezone: 'Asia/Manila', latitude: 7.4474, longitude: 125.8078 },
  { id: 'jonathan', name: 'Jonathan', gender: 'male', birthDate: '1987-11-08', birthTime: '10:44', birthCity: 'London, United Kingdom', timezone: 'Europe/London', latitude: 51.5074, longitude: -0.1278 },
  { id: 'eva', name: 'Eva', gender: 'female', birthDate: '1974-07-09', birthTime: '04:15', birthCity: 'Jaffa, Tel Aviv, Israel', timezone: 'Asia/Jerusalem', latitude: 32.0543, longitude: 34.7516 },
  { id: 'fabrice', name: 'Fabrice Renaudin', gender: 'male', birthDate: '1972-04-26', birthTime: '08:00', birthCity: 'Aix-en-Provence, France', timezone: 'Europe/Paris', latitude: 43.5297, longitude: 5.4474 },
  { id: 'luca', name: 'Luca', gender: 'male', birthDate: '1958-07-11', birthTime: '10:30', birthCity: 'Bologna, Italy', timezone: 'Europe/Rome', latitude: 44.4949, longitude: 11.3426 },
  { id: 'martina', name: 'Martina', gender: 'female', birthDate: '1955-05-06', birthTime: '12:00', birthCity: 'Falun, Sweden', timezone: 'Europe/Stockholm', latitude: 60.6066, longitude: 15.6263 },
  { id: 'anand', name: 'Anand', gender: 'male', birthDate: '1981-03-11', birthTime: '19:00', birthCity: 'Dehradun, Uttarakhand, India', timezone: 'Asia/Kolkata', latitude: 30.3165, longitude: 78.0322 },
  { id: 'akasha', name: 'Akasha Akasha', gender: 'female', birthDate: '1982-10-16', birthTime: '06:10', birthCity: 'Dachau, Bavaria, Germany', timezone: 'Europe/Berlin', latitude: 48.2599, longitude: 11.4342 },
];

async function calculateAndStorePlacements() {
  console.log('🔮 Calculating placements for 9 imported people...\n');

  const results = [];
  const supabase = createSupabaseServiceClient();

  for (let i = 0; i < IMPORTED_PEOPLE.length; i++) {
    const person = IMPORTED_PEOPLE[i];
    console.log(`\n[${i + 1}/9] ${person.name}`);
    console.log(`   📅 ${person.birthDate} at ${person.birthTime}`);
    console.log(`   📍 ${person.birthCity}`);

    try {
      // Calculate Western placements
      const chart = await swissEngine.computePlacements({
        birthDate: person.birthDate,
        birthTime: person.birthTime,
        timezone: person.timezone,
        latitude: person.latitude,
        longitude: person.longitude,
      } as any);

      console.log(`   ☀️ Sun: ${chart.sunSign} ${chart.sunDegree.degree}°`);
      console.log(`   🌙 Moon: ${chart.moonSign} ${chart.moonDegree.degree}°`);
      console.log(`   ⬆️ Rising: ${chart.risingSign} ${chart.ascendantDegree.degree}°`);

      const personWithPlacements = {
        ...person,
        placements: {
          sunSign: chart.sunSign,
          sunDegree: `${chart.sunDegree.degree}°${chart.sunDegree.minute}'`,
          moonSign: chart.moonSign,
          moonDegree: `${chart.moonDegree.degree}°${chart.moonDegree.minute}'`,
          risingSign: chart.risingSign,
          risingDegree: `${chart.ascendantDegree.degree}°${chart.ascendantDegree.minute}'`,
        },
      };

      results.push(personWithPlacements);

      // Optional: Save to Supabase profiles table if you have one
      // (This would require a profiles table schema update)

    } catch (error: any) {
      console.error(`   ❌ Failed: ${error.message}`);
    }
  }

  console.log('\n\n✅ Calculation complete!\n');
  console.log('📄 Results with placements:\n');
  console.log(JSON.stringify(results, null, 2));

  // Save to file
  const outputPath = path.join(__dirname, 'importedPeopleWithPlacements.json');
  fs.writeFileSync(outputPath, JSON.stringify(results, null, 2));
  console.log(`\n💾 Saved to: ${outputPath}`);
}

calculateAndStorePlacements().catch(err => {
  console.error('❌ Fatal error:', err);
  process.exit(1);
});
