/**
 * FRONTEND IMPORT SCRIPT
 * 
 * Run this from the frontend to import geocoded people into profileStore.
 * 
 * Usage:
 * 1. First run backend script: npx tsx src/scripts/importPeople.ts
 * 2. Copy the output JSON here
 * 3. Run this script or call importPeople() from app code
 */

import { useProfileStore } from '../store/profileStore';

// Geocoded people data
const GEOCODED_PEOPLE = [
  {
    "name": "Charmaine",
    "isUser": false,
    "gender": "female" as const,
    "birthData": {
      "birthDate": "1983-11-23",
      "birthTime": "06:25",
      "birthCity": "Hong Kong",
      "timezone": "Asia/Hong_Kong",
      "latitude": 22.3193,
      "longitude": 114.1694
    },
    "placements": {
      "sunSign": "Sagittarius",
      "sunDegree": "0°2'",
      "moonSign": "Cancer",
      "moonDegree": "0°43'",
      "risingSign": "Scorpio",
      "risingDegree": "25°51'"
    }
  },
  {
    "name": "Iya",
    "isUser": false,
    "gender": "female" as const,
    "birthData": {
      "birthDate": "1998-03-24",
      "birthTime": "10:45",
      "birthCity": "Tagum, Davao del Norte, Philippines",
      "timezone": "Asia/Manila",
      "latitude": 7.4474,
      "longitude": 125.8078
    },
    "placements": {
      "sunSign": "Aries",
      "sunDegree": "3°15'",
      "moonSign": "Aquarius",
      "moonDegree": "7°55'",
      "risingSign": "Gemini",
      "risingDegree": "22°19'"
    }
  },
  {
    "name": "Jonathan",
    "isUser": false,
    "gender": "male" as const,
    "birthData": {
      "birthDate": "1987-11-08",
      "birthTime": "10:44",
      "birthCity": "London, United Kingdom",
      "timezone": "Europe/London",
      "latitude": 51.5074,
      "longitude": -0.1278
    },
    "placements": {
      "sunSign": "Scorpio",
      "sunDegree": "15°29'",
      "moonSign": "Gemini",
      "moonDegree": "18°21'",
      "risingSign": "Sagittarius",
      "risingDegree": "25°27'"
    }
  },
  {
    "name": "Eva",
    "isUser": false,
    "gender": "female" as const,
    "birthData": {
      "birthDate": "1974-07-09",
      "birthTime": "04:15",
      "birthCity": "Jaffa, Tel Aviv, Israel",
      "timezone": "Asia/Jerusalem",
      "latitude": 32.0543,
      "longitude": 34.7516
    },
    "placements": {
      "sunSign": "Cancer",
      "sunDegree": "16°28'",
      "moonSign": "Pisces",
      "moonDegree": "5°52'",
      "risingSign": "Gemini",
      "risingDegree": "26°9'"
    }
  },
  {
    "name": "Fabrice Renaudin",
    "isUser": false,
    "gender": "male" as const,
    "birthData": {
      "birthDate": "1972-04-26",
      "birthTime": "08:00",
      "birthCity": "Aix-en-Provence, France",
      "timezone": "Europe/Paris",
      "latitude": 43.5297,
      "longitude": 5.4474
    },
    "placements": {
      "sunSign": "Taurus",
      "sunDegree": "6°8'",
      "moonSign": "Libra",
      "moonDegree": "11°41'",
      "risingSign": "Gemini",
      "risingDegree": "19°33'"
    }
  },
  {
    "name": "Luca",
    "isUser": false,
    "gender": "male" as const,
    "birthData": {
      "birthDate": "1958-07-11",
      "birthTime": "10:30",
      "birthCity": "Bologna, Italy",
      "timezone": "Europe/Rome",
      "latitude": 44.4949,
      "longitude": 11.3426
    },
    "placements": {
      "sunSign": "Cancer",
      "sunDegree": "18°34'",
      "moonSign": "Taurus",
      "moonDegree": "14°36'",
      "risingSign": "Virgo",
      "risingDegree": "24°22'"
    }
  },
  {
    "name": "Martina",
    "isUser": false,
    "gender": "female" as const,
    "birthData": {
      "birthDate": "1955-05-06",
      "birthTime": "12:00",
      "birthCity": "Falun, Sweden",
      "timezone": "Europe/Stockholm",
      "latitude": 60.6066,
      "longitude": 15.6263
    },
    "placements": {
      "sunSign": "Taurus",
      "sunDegree": "15°8'",
      "moonSign": "Scorpio",
      "moonDegree": "10°0'",
      "risingSign": "Virgo",
      "risingDegree": "1°55'"
    }
  },
  {
    "name": "Anand",
    "isUser": false,
    "gender": "male" as const,
    "birthData": {
      "birthDate": "1981-03-11",
      "birthTime": "19:00",
      "birthCity": "Dehradun, Uttarakhand, India",
      "timezone": "Asia/Kolkata",
      "latitude": 30.3165,
      "longitude": 78.0322
    },
    "placements": {
      "sunSign": "Pisces",
      "sunDegree": "20°53'",
      "moonSign": "Gemini",
      "moonDegree": "1°4'",
      "risingSign": "Virgo",
      "risingDegree": "29°41'"
    }
  },
  {
    "name": "Akasha Akasha",
    "isUser": false,
    "gender": "female" as const,
    "birthData": {
      "birthDate": "1982-10-16",
      "birthTime": "06:10",
      "birthCity": "Dachau, Bavaria, Germany",
      "timezone": "Europe/Berlin",
      "latitude": 48.2599,
      "longitude": 11.4342
    },
    "placements": {
      "sunSign": "Libra",
      "sunDegree": "22°30'",
      "moonSign": "Libra",
      "moonDegree": "12°49'",
      "risingSign": "Libra",
      "risingDegree": "17°5'"
    }
  }
];

export function importPeople() {
  const { addPerson, updatePerson, people } = useProfileStore.getState();
  
  console.log(`📋 Importing ${GEOCODED_PEOPLE.length} people into profileStore...`);
  
  let successCount = 0;
  let failCount = 0;
  
  for (const person of GEOCODED_PEOPLE) {
    try {
      // Check if person already exists by name
      const existing = people.find(p => p.name === person.name);
      
      if (existing) {
        // Update existing person with new data (including gender!)
        updatePerson(existing.id, person);
        console.log(`🔄 Updated: ${person.name} (ID: ${existing.id})`);
      } else {
        // Add new person
        const personId = addPerson(person);
        console.log(`✅ Imported: ${person.name} (ID: ${personId})`);
      }
      successCount++;
    } catch (error: any) {
      console.error(`❌ Failed to import ${person.name}:`, error.message);
      failCount++;
    }
  }
  
  console.log(`\n✅ Import complete!`);
  console.log(`   Success: ${successCount}`);
  console.log(`   Failed: ${failCount}`);
  
  return { successCount, failCount };
}
