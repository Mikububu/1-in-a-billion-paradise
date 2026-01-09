/**
 * IMPORT PEOPLE SCRIPT
 * 
 * Imports a list of people with hardcoded geocoding data.
 */

interface PersonData {
  name: string;
  birthDate: string; // DD.MM.YYYY
  birthTime: string; // HH:MM
  birthCity: string;
  latitude: number;
  longitude: number;
  timezone: string;
}

const PEOPLE_TO_IMPORT: PersonData[] = [
  { name: 'Charmaine', birthDate: '23.11.1983', birthTime: '06:25', birthCity: 'Hong Kong', latitude: 22.3193, longitude: 114.1694, timezone: 'Asia/Hong_Kong' },
  { name: 'Iya', birthDate: '24.03.1998', birthTime: '10:45', birthCity: 'Tagum, Davao del Norte, Philippines', latitude: 7.4474, longitude: 125.8078, timezone: 'Asia/Manila' },
  { name: 'Jonathan', birthDate: '08.11.1987', birthTime: '10:44', birthCity: 'London, United Kingdom', latitude: 51.5074, longitude: -0.1278, timezone: 'Europe/London' },
  { name: 'Eva', birthDate: '09.07.1974', birthTime: '04:15', birthCity: 'Jaffa, Tel Aviv, Israel', latitude: 32.0543, longitude: 34.7516, timezone: 'Asia/Jerusalem' },
  { name: 'Fabrice Renaudin', birthDate: '26.04.1972', birthTime: '08:00', birthCity: 'Aix-en-Provence, France', latitude: 43.5297, longitude: 5.4474, timezone: 'Europe/Paris' },
  { name: 'Luca', birthDate: '11.07.1958', birthTime: '10:30', birthCity: 'Bologna, Italy', latitude: 44.4949, longitude: 11.3426, timezone: 'Europe/Rome' },
  { name: 'Martina', birthDate: '06.05.1955', birthTime: '12:00', birthCity: 'Falun, Sweden', latitude: 60.6066, longitude: 15.6263, timezone: 'Europe/Stockholm' },
  { name: 'Anand', birthDate: '11.03.1981', birthTime: '19:00', birthCity: 'Dehradun, Uttarakhand, India', latitude: 30.3165, longitude: 78.0322, timezone: 'Asia/Kolkata' },
  { name: 'Akasha Akasha', birthDate: '16.10.1982', birthTime: '06:10', birthCity: 'Dachau, Bavaria, Germany', latitude: 48.2599, longitude: 11.4342, timezone: 'Europe/Berlin' },
];

/**
 * Convert DD.MM.YYYY to YYYY-MM-DD
 */
function formatDate(ddmmyyyy: string): string {
  const [day, month, year] = ddmmyyyy.split('.');
  return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
}

/**
 * Sleep for rate limiting
 */
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function main() {
  console.log('🚀 Starting people import...\n');
  console.log(`📋 Processing ${PEOPLE_TO_IMPORT.length} people\n`);

  const results: any[] = [];

  for (let i = 0; i < PEOPLE_TO_IMPORT.length; i++) {
    const person = PEOPLE_TO_IMPORT[i];
    console.log(`[${i + 1}/${PEOPLE_TO_IMPORT.length}] ${person.name}`);
    console.log(`   📍 ${person.birthCity}`);
    console.log(`   🌐 ${person.latitude}, ${person.longitude}`);
    console.log(`   ⏰ ${person.timezone}`);
    
    // Format the data
    const formatted = {
      name: person.name,
      isUser: false,
      birthData: {
        birthDate: formatDate(person.birthDate),
        birthTime: person.birthTime,
        birthCity: person.birthCity,
        timezone: person.timezone,
        latitude: person.latitude,
        longitude: person.longitude,
      },
    };

    results.push(formatted);
  }

  console.log('\n\n✅ All people processed!\n');
  console.log('📄 Results (JSON format):\n');
  console.log(JSON.stringify(results, null, 2));
  
  // Save to file
  const fs = require('fs');
  const path = require('path');
  const outputPath = path.join(__dirname, 'importedPeople.json');
  fs.writeFileSync(outputPath, JSON.stringify(results, null, 2));
  console.log(`\n💾 Saved to: ${outputPath}`);
}

main().catch(err => {
  console.error('❌ Fatal error:', err);
  process.exit(1);
});
