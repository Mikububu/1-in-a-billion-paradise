/**
 * Script to list ALL people in the database to find Fabrice
 */

import { createSupabaseServiceClient } from './src/services/supabaseClient';
import { config } from 'dotenv';
import { join } from 'path';

config({ path: join(__dirname, '.env') });

async function searchAllPeople() {
  const supabase = createSupabaseServiceClient();

  if (!supabase) {
    console.error('❌ Supabase not configured');
    process.exit(1);
  }

  console.log('🔍 Fetching ALL people from library_people...\n');

  try {
    // Get ALL people - no limit
    const { data: allPeople, error: peopleError } = await supabase
      .from('library_people')
      .select('user_id, client_person_id, name, is_user, created_at, updated_at')
      .order('name', { ascending: true });

    if (peopleError) {
      console.error('❌ Error fetching people:', peopleError);
      process.exit(1);
    }

    console.log(`📋 Total people in database: ${allPeople?.length || 0}\n`);

    if (!allPeople || allPeople.length === 0) {
      console.log('❌ No people found in database');
      process.exit(1);
    }

    // Show all people
    console.log('📋 All people in database:\n');
    allPeople.forEach((p: any, idx: number) => {
      const hasMultipleNames = p.name.trim().split(/\s+/).length > 1;
      const marker = hasMultipleNames ? ' ⚠️  (has multiple names)' : '';
      console.log(`${idx + 1}. "${p.name}"${marker}`);
      console.log(`   user_id: ${p.user_id}`);
      console.log(`   client_person_id: ${p.client_person_id}`);
      console.log(`   is_user: ${p.is_user}`);
      console.log(`   created: ${p.created_at}`);
      console.log('');
    });

    // Search for Fabrice or Renaudin
    const fabriceMatches = allPeople.filter((p: any) => 
      p.name?.toLowerCase().includes('fabrice') || 
      p.name?.toLowerCase().includes('renaudin')
    );

    if (fabriceMatches.length > 0) {
      console.log(`\n⭐ Found ${fabriceMatches.length} match(es) with "Fabrice" or "Renaudin":\n`);
      fabriceMatches.forEach((p: any) => {
        const nameParts = p.name.trim().split(/\s+/);
        console.log(`   Name: "${p.name}"`);
        console.log(`   Parts: ${nameParts.length} (${nameParts.join(', ')})`);
        if (nameParts.length > 1) {
          console.log(`   - First name: "${nameParts[0]}"`);
          console.log(`   - Last name(s): "${nameParts.slice(1).join(' ')}"`);
        }
        console.log(`   user_id: ${p.user_id}`);
        console.log(`   client_person_id: ${p.client_person_id}`);
        console.log('');
      });
    } else {
      console.log('\n❌ No matches found for "Fabrice" or "Renaudin"');
    }

  } catch (err: any) {
    console.error('❌ Unexpected error:', err);
    process.exit(1);
  }
}

searchAllPeople().catch(console.error);
