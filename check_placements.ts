import 'dotenv/config';
import { createSupabaseServiceClient } from './src/services/supabaseClient';

async function main() {
  const supabase = createSupabaseServiceClient();
  if (!supabase) {
    throw new Error('Supabase not configured');
  }

  console.log('📊 Checking placements for all library_people...\n');

  // Get all people
  const { data: people, error } = await supabase
    .from('library_people')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) {
    console.error('❌ Query failed:', error);
    return;
  }

  if (!people || people.length === 0) {
    console.log('No people found in database');
    return;
  }

  console.log(`Found ${people.length} people\n`);

  let withPlacements = 0;
  let withoutPlacements = 0;
  let withUTCTimezone = 0;

  const peopleNeedingFix: any[] = [];

  people.forEach((person: any) => {
    const hasValidPlacements = person.placements && 
      person.placements.sunSign && 
      person.placements.moonSign && 
      person.placements.risingSign;

    if (hasValidPlacements) {
      withPlacements++;
      console.log(`✅ ${person.name}: ${person.placements.sunSign} ☉ / ${person.placements.moonSign} ☽ / ${person.placements.risingSign} ↑`);
    } else {
      withoutPlacements++;
      
      // Check what birth data exists
      const hasBirthData = person.birth_data;
      const birthData = hasBirthData ? (typeof person.birth_data === 'string' ? JSON.parse(person.birth_data) : person.birth_data) : null;
      
      const date = birthData?.birthDate;
      const time = birthData?.birthTime;
      const lat = birthData?.latitude;
      const lng = birthData?.longitude;
      const timezone = birthData?.timezone;
      const city = birthData?.birthCity;
      
      console.log(`❌ ${person.name}: NO PLACEMENTS - Birth: ${date || 'missing'}, ${time || 'missing'}, ${city || 'no city'}, Coords: ${lat ? `${lat},${lng}` : 'missing'}, TZ: ${timezone || 'missing'}`);
      
      if (date && time && lat && lng) {
        peopleNeedingFix.push({
          personId: person.id,
          name: person.name,
          birthDate: date,
          birthTime: time,
          birthCity: city,
          latitude: lat,
          longitude: lng,
          timezone: timezone || 'UTC',
        });
      }
    }

    const birthDataCheck = person.birth_data ? (typeof person.birth_data === 'string' ? JSON.parse(person.birth_data) : person.birth_data) : null;
    const lngCheck = birthDataCheck?.longitude;
    const timezoneCheck = birthDataCheck?.timezone;
    if (timezoneCheck === 'UTC' && lngCheck && Math.abs(lngCheck) > 15) {
      withUTCTimezone++;
      console.log(`   ⚠️  TIMEZONE BUG: Has UTC but longitude ${lngCheck} suggests different timezone`);
    }
  });

  console.log(`\n📈 Summary:`);
  console.log(`   ✅ With placements: ${withPlacements}`);
  console.log(`   ❌ Without placements: ${withoutPlacements}`);
  console.log(`   ⚠️  With UTC timezone bug: ${withUTCTimezone}`);

  if (peopleNeedingFix.length > 0) {
    console.log(`\n🔧 ${peopleNeedingFix.length} people need placements calculated:`);
    peopleNeedingFix.forEach(p => {
      console.log(`   - ${p.name} (${p.birthDate}, ${p.birthTime}, ${p.birthCity || 'no city'}, TZ: ${p.timezone})`);
    });
  }
}

main().catch(console.error);
