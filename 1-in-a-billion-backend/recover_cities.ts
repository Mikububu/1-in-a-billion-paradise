/**
 * CITY RECOVERY SCRIPT
 * 
 * Recovers lost city names by reverse geocoding from coordinates.
 * Run: npx tsx recover_cities.ts
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

interface PersonRow {
  user_id: string;
  client_person_id: string;
  name: string;
  birth_data: {
    birthCity?: string;
    latitude?: number;
    longitude?: number;
    timezone?: string;
    birthDate?: string;
    birthTime?: string;
  };
}

async function reverseGeocode(lat: number, lon: number): Promise<string | null> {
  try {
    // Using OpenStreetMap Nominatim (free, no API key needed)
    const url = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}&zoom=10`;
    const response = await fetch(url, {
      headers: {
        'User-Agent': '1-in-a-Billion-CityRecovery/1.0',
      },
    });
    
    if (!response.ok) {
      console.warn(`⚠️ Geocoding failed for ${lat},${lon}: ${response.status}`);
      return null;
    }
    
    const data = await response.json();
    
    // Build city name from address components
    const address = data.address || {};
    const city = address.city || address.town || address.village || address.municipality || address.county;
    const state = address.state || address.region;
    const country = address.country;
    
    if (city && country) {
      return state ? `${city}, ${state}, ${country}` : `${city}, ${country}`;
    } else if (country) {
      return country;
    }
    
    return null;
  } catch (error) {
    console.error(`❌ Error geocoding ${lat},${lon}:`, error);
    return null;
  }
}

async function recoverCities() {
  console.log('🔍 Fetching people with "Unknown" cities...\n');
  
  const { data: people, error } = await supabase
    .from('library_people')
    .select('user_id, client_person_id, name, birth_data')
    .eq('is_user', false)
    .order('name');
  
  if (error) {
    console.error('❌ Failed to fetch people:', error.message);
    process.exit(1);
  }
  
  if (!people || people.length === 0) {
    console.log('✅ No people found');
    return;
  }
  
  console.log(`Found ${people.length} people\n`);
  
  let recoveredCount = 0;
  let skippedCount = 0;
  
  for (const person of people as PersonRow[]) {
    const birthCity = person.birth_data?.birthCity;
    const lat = person.birth_data?.latitude;
    const lon = person.birth_data?.longitude;
    
    // Skip if city is already good
    if (birthCity && birthCity !== 'Unknown' && birthCity.trim().length > 0) {
      console.log(`✓ ${person.name}: Already has city "${birthCity}"`);
      skippedCount++;
      continue;
    }
    
    // Skip if no coordinates
    if (!lat || !lon || (lat === 0 && lon === 0)) {
      console.log(`⚠️ ${person.name}: No valid coordinates (${lat}, ${lon})`);
      skippedCount++;
      continue;
    }
    
    console.log(`🔄 ${person.name}: Recovering city from coordinates ${lat}, ${lon}...`);
    
    // Reverse geocode
    const recoveredCity = await reverseGeocode(lat, lon);
    
    if (!recoveredCity) {
      console.log(`❌ ${person.name}: Could not geocode coordinates`);
      skippedCount++;
      continue;
    }
    
    console.log(`✅ ${person.name}: Recovered "${recoveredCity}"`);
    
    // Update Supabase
    const updatedBirthData = {
      ...person.birth_data,
      birthCity: recoveredCity,
    };
    
    const { error: updateError } = await supabase
      .from('library_people')
      .update({
        birth_data: updatedBirthData,
        updated_at: new Date().toISOString(),
      })
      .eq('user_id', person.user_id)
      .eq('client_person_id', person.client_person_id);
    
    if (updateError) {
      console.error(`❌ ${person.name}: Failed to update:`, updateError.message);
      skippedCount++;
    } else {
      recoveredCount++;
    }
    
    // Rate limit: 1 request per second (Nominatim requirement)
    await new Promise(resolve => setTimeout(resolve, 1100));
  }
  
  console.log(`\n📊 Summary:`);
  console.log(`   Recovered: ${recoveredCount}`);
  console.log(`   Skipped: ${skippedCount}`);
  console.log(`   Total: ${people.length}`);
}

recoverCities().catch(error => {
  console.error('❌ Fatal error:', error);
  process.exit(1);
});
