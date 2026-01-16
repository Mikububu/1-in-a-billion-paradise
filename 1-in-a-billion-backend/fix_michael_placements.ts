import 'dotenv/config';
import { createSupabaseServiceClient } from './src/services/supabaseClient';
import { swissEngine } from './src/services/swissEphemeris';

async function main() {
  const supabase = createSupabaseServiceClient();
  if (!supabase) throw new Error('Supabase not configured');

  const userId = 'e34061de-755c-4b5e-9b0d-a6c7aa8bddc2';
  
  // Get the person record
  const { data: people } = await supabase
    .from('library_people')
    .select('*')
    .eq('user_id', userId)
    .eq('is_user', true)
    .single();

  if (!people) {
    console.log('❌ No person found');
    return;
  }

  console.log('📅 Current birth data:', people.birth_data);
  console.log('❌ Wrong placements:', people.placements);

  // Recalculate using Swiss Ephemeris
  const bd = people.birth_data;
  const placements = await swissEngine.computePlacements({
    birthDate: bd.birthDate,
    birthTime: bd.birthTime,
    timezone: bd.timezone,
    latitude: bd.latitude,
    longitude: bd.longitude,
    relationshipIntensity: 5,
    relationshipMode: 'sensual',
    primaryLanguage: 'en',
  } as any);

  const newPlacements = {
    sunSign: placements.sunSign,
    moonSign: placements.moonSign,
    risingSign: placements.risingSign,
    sunDegree: placements.sunDegree,
    moonDegree: placements.moonDegree,
    risingDegree: placements.ascendantDegree,
  };

  console.log('\n✅ Correct placements:', newPlacements);

  // Update in Supabase
  const { error } = await supabase
    .from('library_people')
    .update({ placements: newPlacements, hook_readings: null })
    .eq('user_id', userId)
    .eq('is_user', true);

  if (error) {
    console.error('❌ Update failed:', error);
  } else {
    console.log('\n🎉 Updated! Hook readings cleared (will regenerate with correct data)');
  }
}

main().catch(console.error);
