/**
 * Force update Fabrice's name - bypass any triggers if needed
 */

import { createSupabaseServiceClient } from './src/services/supabaseClient';
import { config } from 'dotenv';
import { join } from 'path';

config({ path: join(__dirname, '.env') });

async function forceUpdateFabrice() {
  const supabase = createSupabaseServiceClient();

  if (!supabase) {
    console.error('❌ Supabase not configured');
    process.exit(1);
  }

  console.log('🔍 Searching for Fabrice in ALL possible variations...\n');

  try {
    // Get ALL people
    const { data: allPeople, error: peopleError } = await supabase
      .from('library_people')
      .select('*')
      .order('created_at', { ascending: false });

    if (peopleError) {
      console.error('❌ Error fetching people:', peopleError);
      process.exit(1);
    }

    console.log(`📋 Total people in database: ${allPeople?.length || 0}\n`);

    // Search for Fabrice with various patterns
    const fabriceMatches = (allPeople || []).filter((p: any) => {
      const name = (p.name || '').toLowerCase();
      return name.includes('fabrice') || 
             name.includes('renaudin') ||
             name.includes('febreze'); // Handle typo
    });

    if (fabriceMatches.length === 0) {
      console.log('❌ No matches found. Showing all people:\n');
      if (allPeople) {
        allPeople.forEach((p: any) => {
          console.log(`   - "${p.name}" (user_id: ${p.user_id?.substring(0, 8)}...)`);
        });
      }
      console.log('\n💡 Fabrice might be in a different Supabase project.');
      console.log('💡 Please check your .env file to ensure SUPABASE_URL points to the correct project.');
      process.exit(1);
    }

    console.log(`📋 Found ${fabriceMatches.length} match(es):\n`);
    fabriceMatches.forEach((p: any, idx: number) => {
      const nameParts = (p.name || '').trim().split(/\s+/);
      console.log(`${idx + 1}. Current: "${p.name}"`);
      console.log(`   - Parts: ${nameParts.length}`);
      if (nameParts.length > 1) {
        console.log(`   - Will update to: "${nameParts[0]}"`);
      }
      console.log(`   - user_id: ${p.user_id}`);
      console.log(`   - client_person_id: ${p.client_person_id}`);
      console.log('');
    });

    // Update each match
    for (const person of fabriceMatches) {
      const nameParts = (person.name || '').trim().split(/\s+/);
      const firstName = nameParts[0];
      
      if (nameParts.length === 1) {
        console.log(`✅ "${person.name}" already has only first name.`);
        continue;
      }

      console.log(`🔄 Updating "${person.name}" to "${firstName}"...`);

      // Try direct update first
      const { error: updateError } = await supabase
        .from('library_people')
        .update({ 
          name: firstName,
          updated_at: new Date().toISOString()
        })
        .eq('user_id', person.user_id)
        .eq('client_person_id', person.client_person_id);

      if (updateError) {
        console.error(`❌ Update failed:`, updateError);
        console.log(`\n💡 The update might be blocked by a database trigger.`);
        console.log(`💡 Try running this SQL directly in Supabase SQL Editor:\n`);
        console.log(`UPDATE library_people`);
        console.log(`SET name = '${firstName}', updated_at = NOW()`);
        console.log(`WHERE user_id = '${person.user_id}'`);
        console.log(`  AND client_person_id = '${person.client_person_id}';`);
      } else {
        // Verify the update
        const { data: updated, error: verifyError } = await supabase
          .from('library_people')
          .select('name')
          .eq('user_id', person.user_id)
          .eq('client_person_id', person.client_person_id)
          .single();

        if (verifyError) {
          console.error(`❌ Verification failed:`, verifyError);
        } else {
          console.log(`✅ Successfully updated to: "${updated.name}"`);
        }
      }
    }

  } catch (err: any) {
    console.error('❌ Unexpected error:', err);
    process.exit(1);
  }
}

forceUpdateFabrice().catch(console.error);
