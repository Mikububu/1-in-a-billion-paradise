/**
 * Script to find and fix a person's name - remove second name(s)
 * Usage: npx tsx fix_person_name.ts "Fabrice"
 * 
 * Names are stored in a single 'name' field (no separate surname field)
 * This script will remove everything after the first space
 */

import { createSupabaseServiceClient } from './src/services/supabaseClient';
import { config } from 'dotenv';
import { join } from 'path';

config({ path: join(__dirname, '.env') });

const searchName = process.argv[2] || 'Fabrice';

async function fixPersonName() {
  const supabase = createSupabaseServiceClient();

  if (!supabase) {
    console.error('❌ Supabase not configured');
    process.exit(1);
  }

  console.log(`🔍 Searching for "${searchName}" in library_people...\n`);

  try {
    // Get ALL people (no limit) - search across entire database
    const { data: allPeople, error: peopleError } = await supabase
      .from('library_people')
      .select('user_id, client_person_id, name, is_user, created_at')
      .order('created_at', { ascending: false });

    if (peopleError) {
      console.error('❌ Error fetching people:', peopleError);
      process.exit(1);
    }

    // Find matches (case-insensitive, partial match)
    const matches = (allPeople || []).filter((p: any) => 
      p.name?.toLowerCase().includes(searchName.toLowerCase())
    );

    if (matches.length === 0) {
      console.log(`❌ No people found with "${searchName}" in name`);
      console.log(`\n📋 Total people in database: ${allPeople?.length || 0}`);
      console.log(`\n💡 Showing all people names for reference:\n`);
      if (allPeople) {
        const uniqueNames = [...new Set(allPeople.map((p: any) => p.name))].sort();
        uniqueNames.forEach((name: string) => {
          console.log(`   - "${name}"`);
        });
      }
      console.log(`\n💡 Try running: npx tsx fix_person_name.ts "ExactName"`);
      process.exit(1);
    }

    console.log(`📋 Found ${matches.length} person(s) with "${searchName}":\n`);
    matches.forEach((p: any, idx: number) => {
      const nameParts = p.name.trim().split(/\s+/);
      console.log(`${idx + 1}. Current name: "${p.name}"`);
      console.log(`   - Parts: ${nameParts.length} (${nameParts.join(', ')})`);
      if (nameParts.length > 1) {
        console.log(`   - First name: "${nameParts[0]}"`);
        console.log(`   - Second name(s): "${nameParts.slice(1).join(' ')}"`);
        console.log(`   - Will update to: "${nameParts[0]}"`);
      } else {
        console.log(`   - ✅ Already has only first name, no update needed`);
      }
      console.log(`   - user_id: ${p.user_id}`);
      console.log(`   - client_person_id: ${p.client_person_id}`);
      console.log(`   - is_user: ${p.is_user}`);
      console.log('');
    });

    // Update each match to have only first name
    let updated = 0;
    for (const person of matches) {
      const nameParts = person.name.trim().split(/\s+/);
      const firstName = nameParts[0];
      
      if (nameParts.length === 1) {
        console.log(`⏭️  "${person.name}" already has only first name, skipping.`);
        continue;
      }

      console.log(`🔄 Updating "${person.name}" to "${firstName}"...`);

      const { error: updateError } = await supabase
        .from('library_people')
        .update({ 
          name: firstName,
          updated_at: new Date().toISOString()
        })
        .eq('user_id', person.user_id)
        .eq('client_person_id', person.client_person_id);

      if (updateError) {
        console.error(`❌ Error updating "${person.name}":`, updateError);
      } else {
        console.log(`✅ Successfully updated "${person.name}" to "${firstName}"`);
        updated++;
      }
    }

    if (updated > 0) {
      console.log(`\n✅ Done! Updated ${updated} person(s).`);
    } else {
      console.log(`\n✅ Done! No updates needed.`);
    }

  } catch (err: any) {
    console.error('❌ Unexpected error:', err);
    process.exit(1);
  }
}

fixPersonName().catch(console.error);
