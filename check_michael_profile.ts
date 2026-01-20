import 'dotenv/config';
import { createSupabaseServiceClient } from './src/services/supabaseClient';
import { swissEngine } from './src/services/swissEphemeris';

async function main() {
  const supabase = createSupabaseServiceClient();
  if (!supabase) {
    throw new Error('Supabase not configured');
  }

  console.log('🔍 Checking Michael\'s profile and Human Design calculation...\n');

  // Find Michael in library_people
  const { data: people, error } = await supabase
    .from('library_people')
    .select('*')
    .ilike('name', '%michael%');

  if (error) {
    console.error('❌ Error:', error);
    return;
  }

  if (!people || people.length === 0) {
    console.log('❌ No profile found for Michael');
    return;
  }

  console.log(`Found ${people.length} profile(s) for Michael:\n`);

  for (const person of people) {
    console.log(`📋 Profile: ${person.name}`);
    console.log(`   ID: ${person.id}`);
    console.log(`   Email: ${person.email || 'N/A'}`);
    console.log(`   User ID: ${person.user_id}`);
    
    const birthData = person.birth_data;
    if (birthData) {
      console.log('\n🎂 Birth Data:');
      console.log(`   Date: ${birthData.birthDate}`);
      console.log(`   Time: ${birthData.birthTime}`);
      console.log(`   City: ${birthData.birthCity}`);
      console.log(`   Timezone: ${birthData.timezone || 'MISSING'}`);
      console.log(`   Coordinates: ${birthData.latitude}, ${birthData.longitude}`);
    }

    if (person.placements) {
      console.log('\n✨ Current Placements:');
      console.log(`   Sun: ${person.placements.sunSign}`);
      console.log(`   Moon: ${person.placements.moonSign}`);
      console.log(`   Rising: ${person.placements.risingSign}`);
      
      if (person.placements.humanDesign) {
        console.log('\n🎯 Human Design (Current):');
        console.log(`   Type: ${person.placements.humanDesign.type}`);
        console.log(`   Strategy: ${person.placements.humanDesign.strategy}`);
        console.log(`   Authority: ${person.placements.humanDesign.authority}`);
        console.log(`   Profile: ${person.placements.humanDesign.profile}`);
        console.log(`   Incarnation Cross: ${person.placements.humanDesign.incarnationCross}`);
      }
    }

    // RECALCULATE with correct timezone
    if (birthData?.birthDate && birthData?.latitude && birthData?.longitude && birthData?.timezone) {
      console.log('\n🔄 Recalculating with current data...');
      
      try {
        const payload = {
          birthDate: birthData.birthDate,
          birthTime: birthData.birthTime || '12:00',
          timezone: birthData.timezone,
          latitude: birthData.latitude,
          longitude: birthData.longitude,
          relationshipIntensity: 5,
          relationshipMode: 'sensual' as const,
          primaryLanguage: 'en',
        };

        const newPlacements = await swissEngine.computePlacements(payload);
        
        console.log('\n✨ RECALCULATED Placements:');
        console.log(`   Sun: ${newPlacements.sunSign}`);
        console.log(`   Moon: ${newPlacements.moonSign}`);
        console.log(`   Rising: ${newPlacements.risingSign}`);
        
        if (newPlacements.humanDesign) {
          console.log('\n🎯 Human Design (RECALCULATED):');
          console.log(`   Type: ${newPlacements.humanDesign.type}`);
          console.log(`   Strategy: ${newPlacements.humanDesign.strategy}`);
          console.log(`   Authority: ${newPlacements.humanDesign.authority}`);
          console.log(`   Profile: ${newPlacements.humanDesign.profile}`);
          console.log(`   Incarnation Cross: ${newPlacements.humanDesign.incarnationCross}`);
          
          // Check if different
          if (person.placements?.humanDesign?.type !== newPlacements.humanDesign.type) {
            console.log(`\n⚠️  HUMAN DESIGN TYPE MISMATCH!`);
            console.log(`   Old: ${person.placements?.humanDesign?.type}`);
            console.log(`   New: ${newPlacements.humanDesign.type}`);
          }
        }

        // Compare all placements
        if (person.placements) {
          const differences = [];
          if (person.placements.sunSign !== newPlacements.sunSign) {
            differences.push(`Sun: ${person.placements.sunSign} → ${newPlacements.sunSign}`);
          }
          if (person.placements.moonSign !== newPlacements.moonSign) {
            differences.push(`Moon: ${person.placements.moonSign} → ${newPlacements.moonSign}`);
          }
          if (person.placements.risingSign !== newPlacements.risingSign) {
            differences.push(`Rising: ${person.placements.risingSign} → ${newPlacements.risingSign}`);
          }

          if (differences.length > 0) {
            console.log('\n⚠️  DIFFERENCES FOUND:');
            differences.forEach(d => console.log(`   ${d}`));
          } else {
            console.log('\n✅ All placements match current data');
          }
        }

      } catch (e: any) {
        console.error('❌ Recalculation error:', e.message);
      }
    }

    console.log('\n' + '='.repeat(70) + '\n');
  }
}

main().catch(console.error);
