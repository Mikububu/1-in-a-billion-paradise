/**
 * Script to find and fix Fabrice's name - remove second name
 * Names are stored in a single 'name' field (no separate surname field)
 */

import { createSupabaseServiceClient } from './src/services/supabaseClient';
import { config } from 'dotenv';
import { join } from 'path';

config({ path: join(__dirname, '.env') });

async function fixFabriceName() {
  const supabase = createSupabaseServiceClient();

  if (!supabase) {
    console.error('❌ Supabase not configured');
    process.exit(1);
  }

  console.log('🔍 Searching for "Fabrice" in library_people...\n');

  try {
    // Get ALL people (no limit) to find Fabrice
    const { data: allPeople, error: peopleError } = await supabase
      .from('library_people')
      .select('user_id, client_person_id, name, is_user, created_at')
      .order('created_at', { ascending: false });

    if (peopleError) {
      console.error('❌ Error fetching people:', peopleError);
      process.exit(1);
    }

    // Find Fabrice (case-insensitive, partial match)
    const fabricePeople = (allPeople || []).filter((p: any) => 
      p.name?.toLowerCase().includes('fabrice')
    );

    if (fabricePeople.length === 0) {
      console.log('❌ No people found with "Fabrice" in name');
      console.log(`\n📋 Showing all ${allPeople?.length || 0} people in database for reference:\n`);
      if (allPeople) {
        allPeople.forEach((p: any) => {
          console.log(`   - "${p.name}" (user_id: ${p.user_id.substring(0, 8)}..., client_person_id: ${p.client_person_id.substring(0, 20)}...)`);
        });
      }
      console.log('\n💡 If Fabrice is not listed above, he may be in a different database or the name is spelled differently.');
      process.exit(1);
    }

    console.log(`📋 Found ${fabricePeople.length} person(s) with "Fabrice":\n`);
    fabricePeople.forEach((p: any, idx: number) => {
      const nameParts = p.name.trim().split(/\s+/);
      console.log(`${idx + 1}. Current name: "${p.name}"`);
      console.log(`   - Parts: ${nameParts.length} (${nameParts.join(', ')})`);
      if (nameParts.length > 1) {
        console.log(`   - First name: "${nameParts[0]}"`);
        console.log(`   - Second name(s): "${nameParts.slice(1).join(' ')}"`);
      }
      console.log(`   - user_id: ${p.user_id}`);
      console.log(`   - client_person_id: ${p.client_person_id}`);
      console.log(`   - is_user: ${p.is_user}`);
      console.log('');
    });

    // Update each Fabrice to have only first name
    for (const fabrice of fabricePeople) {
      const nameParts = fabrice.name.trim().split(/\s+/);
      const firstName = nameParts[0];
      
      if (nameParts.length === 1) {
        console.log(`✅ "${fabrice.name}" already has only first name, no update needed.`);
        continue;
      }

      console.log(`\n🔄 Updating "${fabrice.name}" to "${firstName}"...`);

      const { error: updateError } = await supabase
        .from('library_people')
        .update({ 
          name: firstName,
          updated_at: new Date().toISOString()
        })
        .eq('user_id', fabrice.user_id)
        .eq('client_person_id', fabrice.client_person_id);

      if (updateError) {
        console.error(`❌ Error updating "${fabrice.name}":`, updateError);
      } else {
        console.log(`✅ Successfully updated "${fabrice.name}" to "${firstName}"`);
      }
    }

    console.log('\n✅ Done!');

  } catch (err: any) {
    console.error('❌ Unexpected error:', err);
    process.exit(1);
  }
}

fixFabriceName().catch(console.error);
