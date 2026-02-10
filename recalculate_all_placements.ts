import 'dotenv/config';
import { createSupabaseServiceClient } from './src/services/supabaseClient';
import { swissEngine } from './src/services/swissEphemeris';

async function main() {
  const supabase = createSupabaseServiceClient();
  if (!supabase) {
    throw new Error('Supabase not configured');
  }

  console.log('🔮 Recalculating placements for all library_people...\n');

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

  let updated = 0;
  let skipped = 0;
  let failed = 0;

  for (const person of people) {
    const hasBasicPlacements = person.placements && 
      person.placements.sunSign && 
      person.placements.moonSign && 
      person.placements.risingSign;

    const hasHumanDesign = person.placements?.humanDesign;
    const hasGeneKeys = person.placements?.geneKeys;

    // Only skip if they have FULL placements (including HD & GK)
    if (hasBasicPlacements && hasHumanDesign && hasGeneKeys) {
      console.log(`⏭️  ${person.name}: Already has full placements (including HD/GK) - skipping`);
      skipped++;
      continue;
    }

    if (hasBasicPlacements && (!hasHumanDesign || !hasGeneKeys)) {
      console.log(`🔄 ${person.name}: Has placements but missing HD/GK - recalculating`);
    }

    // Get birth data from JSON
    const birthData = person.birth_data ? 
      (typeof person.birth_data === 'string' ? JSON.parse(person.birth_data) : person.birth_data) 
      : null;

    if (!birthData || !birthData.birthDate || !birthData.birthTime || !birthData.latitude || !birthData.longitude) {
      console.log(`❌ ${person.name}: Missing required birth data - skipping`);
      failed++;
      continue;
    }

    console.log(`🔮 ${person.name}: Calculating placements...`);
    
    try {
      const placements = await swissEngine.computePlacements({
        birthDate: birthData.birthDate,
        birthTime: birthData.birthTime,
        timezone: birthData.timezone || 'UTC',
        latitude: birthData.latitude,
        longitude: birthData.longitude,
      });

      if (!placements) {
        console.log(`   ❌ Calculation failed`);
        failed++;
        continue;
      }

      console.log(`   ✅ ${placements.sunSign} ☉ / ${placements.moonSign} ☽ / ${placements.risingSign} ↑`);

      // Save to Supabase
      const { error: updateError } = await supabase
        .from('library_people')
        .update({
          placements: placements,
          updated_at: new Date().toISOString(),
        })
        .eq('user_id', person.user_id)
        .eq('client_person_id', person.client_person_id);

      if (updateError) {
        console.log(`   ❌ Failed to save:`, updateError.message);
        failed++;
      } else {
        console.log(`   ☁️  Saved to Supabase`);
        updated++;
      }
    } catch (err: any) {
      console.log(`   ❌ Error:`, err.message);
      failed++;
    }
  }

  console.log(`\n📊 Summary:`);
  console.log(`   ✅ Updated: ${updated}`);
  console.log(`   ⏭️  Skipped (already had placements): ${skipped}`);
  console.log(`   ❌ Failed: ${failed}`);
}

main().catch(console.error);
