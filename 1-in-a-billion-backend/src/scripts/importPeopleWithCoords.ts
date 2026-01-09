/**
 * IMPORT PEOPLE WITH PRE-GEOCODED COORDINATES
 * 
 * Uses manually researched coordinates for accuracy
 */

interface PersonData {
  name: string;
  birthDate: string;
  birthTime: string;
  birthCity: string;
  latitude: number;
  longitude: number;
  timezone: string;
}

const PEOPLE_WITH_COORDS: PersonData[] = [
  {
    name: 'Charmaine',
    birthDate: '1983-11-23',
    birthTime: '06:25',
    birthCity: 'Hong Kong',
    latitude: 22.3193,
    longitude: 114.1694,
    timezone: 'Asia/Hong_Kong',
  },
  {
    name: 'Iya',
    birthDate: '1998-03-24',
    birthTime: '10:45',
    birthCity: 'Tagum, Davao, Philippines',
    latitude: 7.4478,
    longitude: 125.8078,
    timezone: 'Asia/Manila',
  },
  {
    name: 'Jonathan',
    birthDate: '1987-11-08',
    birthTime: '10:44',
    birthCity: 'London, United Kingdom',
    latitude: 51.5074,
    longitude: -0.1278,
    timezone: 'Europe/London',
  },
  {
    name: 'Eva',
    birthDate: '1974-07-09',
    birthTime: '04:15',
    birthCity: 'Jaffa, Tel Aviv, Israel',
    latitude: 32.0543,
    longitude: 34.7516,
    timezone: 'Asia/Jerusalem',
  },
  {
    name: 'Fabrice Renaudin',
    birthDate: '1972-04-26',
    birthTime: '08:00',
    birthCity: 'Aix-en-Provence, France',
    latitude: 43.5297,
    longitude: 5.4474,
    timezone: 'Europe/Paris',
  },
  {
    name: 'Luca',
    birthDate: '1958-07-11',
    birthTime: '10:30',
    birthCity: 'Bologna, Italy',
    latitude: 44.4949,
    longitude: 11.3426,
    timezone: 'Europe/Rome',
  },
  {
    name: 'Martina',
    birthDate: '1955-05-06',
    birthTime: '12:00',
    birthCity: 'Falun, Sweden',
    latitude: 60.6069,
    longitude: 15.6267,
    timezone: 'Europe/Stockholm',
  },
  {
    name: 'Anand',
    birthDate: '1981-03-11',
    birthTime: '19:00',
    birthCity: 'Dehradun, Uttarakhand, India',
    latitude: 30.3165,
    longitude: 78.0322,
    timezone: 'Asia/Kolkata',
  },
  {
    name: 'Akasha Akasha',
    birthDate: '1982-10-16',
    birthTime: '06:10',
    birthCity: 'Dachau bei München, Germany',
    latitude: 48.2600,
    longitude: 11.4342,
    timezone: 'Europe/Berlin',
  },
];

async function main() {
  console.log('🚀 Generating import data with pre-geocoded coordinates...\n');
  console.log(`📋 Processing ${PEOPLE_WITH_COORDS.length} people\n`);

  const results = PEOPLE_WITH_COORDS.map(person => ({
    name: person.name,
    isUser: false,
    birthData: {
      birthDate: person.birthDate,
      birthTime: person.birthTime,
      birthCity: person.birthCity,
      timezone: person.timezone,
      latitude: person.latitude,
      longitude: person.longitude,
    },
  }));

  console.log('✅ Data formatted!\n');
  console.log('📄 Results:\n');
  console.log(JSON.stringify(results, null, 2));
  
  // Save to file
  const fs = require('fs');
  const path = require('path');
  const outputPath = path.join(__dirname, 'importedPeople.json');
  fs.writeFileSync(outputPath, JSON.stringify(results, null, 2));
  console.log(`\n💾 Saved to: ${outputPath}`);
  
  // Also save as TypeScript for direct import
  const tsContent = `export const PEOPLE_TO_IMPORT = ${JSON.stringify(results, null, 2)};`;
  const tsPath = path.join(__dirname, '../../1-in-a-billion-frontend/src/data/importedPeople.ts');
  fs.writeFileSync(tsPath, tsContent);
  console.log(`💾 Also saved to: ${tsPath}`);
}

main().catch(err => {
  console.error('❌ Fatal error:', err);
  process.exit(1);
});
