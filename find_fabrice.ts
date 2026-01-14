/**
 * Script to find Fabrice in the database
 */

import { createSupabaseServiceClient } from './src/services/supabaseClient';
import { config } from 'dotenv';
import { join } from 'path';

config({ path: join(__dirname, '.env') });

async function findFabrice() {
  const supabase = createSupabaseServiceClient();

  if (!supabase) {
    console.error('❌ Supabase not configured');
    process.exit(1);
  }

  console.log('🔍 Searching for "Fabrice" everywhere...\n');

  try {
    // Search in library_people (case-insensitive, partial match)
    const { data: people, error: peopleError } = await supabase
      .from('library_people')
      .select('user_id, client_person_id, name, is_user, created_at')
      .order('created_at', { ascending: false })
      .limit(50);

    if (!peopleError && people) {
      const fabricePeople = people.filter((p: any) => 
        p.name?.toLowerCase().includes('fabrice')
      );
      
      if (fabricePeople.length > 0) {
        console.log(`📋 Found ${fabricePeople.length} person(s) with "Fabrice" in library_people:\n`);
        fabricePeople.forEach((p: any) => {
          console.log(`   Name: "${p.name}"`);
          console.log(`   user_id: ${p.user_id}`);
          console.log(`   client_person_id: ${p.client_person_id}`);
          console.log(`   is_user: ${p.is_user}`);
          console.log('');
        });
      } else {
        console.log('❌ No people found with "Fabrice" in library_people');
        console.log(`   (Checked ${people.length} recent people)\n`);
      }
    }

    // Search in jobs params
    console.log('🔍 Searching for "Fabrice" in jobs...\n');
    const { data: allJobs, error: jobsError } = await supabase
      .from('jobs')
      .select('id, user_id, params, type, status, created_at')
      .order('created_at', { ascending: false })
      .limit(100);

    if (!jobsError && allJobs) {
      const fabriceJobs = allJobs.filter((job: any) => {
        const params = job?.params || {};
        const p1Name = (params.person1?.name || '').toLowerCase();
        const p2Name = (params.person2?.name || '').toLowerCase();
        return p1Name.includes('fabrice') || p2Name.includes('fabrice');
      });

      if (fabriceJobs.length > 0) {
        console.log(`📋 Found ${fabriceJobs.length} job(s) with "Fabrice" in params:\n`);
        fabriceJobs.forEach((job: any) => {
          const params = job.params || {};
          console.log(`   Job ${job.id} (${job.type}, ${job.status}):`);
          console.log(`     Person1: "${params.person1?.name || 'N/A'}" (id: ${params.person1?.id || 'N/A'})`);
          console.log(`     Person2: "${params.person2?.name || 'N/A'}" (id: ${params.person2?.id || 'N/A'})`);
          console.log(`     user_id: ${job.user_id}`);
          console.log('');
        });
      } else {
        console.log('❌ No jobs found with "Fabrice" in params');
        console.log(`   (Checked ${allJobs.length} recent jobs)\n`);
      }
    }

    // Show all recent people names for reference
    if (people && people.length > 0) {
      console.log('📋 All recent people in database (for reference):');
      people.slice(0, 20).forEach((p: any) => {
        console.log(`   - "${p.name}"`);
      });
    }

  } catch (err: any) {
    console.error('❌ Unexpected error:', err);
    process.exit(1);
  }
}

findFabrice().catch(console.error);
