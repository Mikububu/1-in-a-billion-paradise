/**
 * Trace where "Fabrice Renaudin" is stored
 * This will show ALL places the name appears in the database
 */

import { createSupabaseServiceClient } from './src/services/supabaseClient';
import { config } from 'dotenv';
import { join } from 'path';

config({ path: join(__dirname, '.env') });

async function traceFabriceName() {
  const supabase = createSupabaseServiceClient();

  if (!supabase) {
    console.error('❌ Supabase not configured');
    process.exit(1);
  }

  console.log('🔍 Tracing "Fabrice Renaudin" in ALL possible locations...\n');

  try {
    // 1. Check library_people table
    console.log('1️⃣ Checking library_people table:');
    const { data: people, error: peopleError } = await supabase
      .from('library_people')
      .select('user_id, client_person_id, name, updated_at')
      .or('name.ilike.%fabrice%,name.ilike.%renaudin%');

    if (peopleError) {
      console.error('   ❌ Error:', peopleError.message);
    } else if (people && people.length > 0) {
      people.forEach((p: any) => {
        console.log(`   📋 Found: "${p.name}"`);
        console.log(`      user_id: ${p.user_id}`);
        console.log(`      client_person_id: ${p.client_person_id}`);
        console.log(`      updated_at: ${p.updated_at}`);
        console.log('');
      });
    } else {
      console.log('   ✅ No matches found (or already updated to "Fabrice")\n');
    }

    // 2. Check jobs.params.person1.name
    console.log('2️⃣ Checking jobs.params.person1.name:');
    const { data: jobs1, error: jobs1Error } = await supabase
      .from('jobs')
      .select('id, user_id, type, status, params, updated_at')
      .or('params->person1->>name.ilike.%fabrice%,params->person1->>name.ilike.%renaudin%');

    if (jobs1Error) {
      console.error('   ❌ Error:', jobs1Error.message);
    } else if (jobs1 && jobs1.length > 0) {
      jobs1.forEach((job: any) => {
        const p1Name = job.params?.person1?.name;
        console.log(`   📋 Job ${job.id} (${job.type}, ${job.status}):`);
        console.log(`      person1.name: "${p1Name}"`);
        console.log(`      user_id: ${job.user_id}`);
        console.log(`      updated_at: ${job.updated_at}`);
        console.log('');
      });
    } else {
      console.log('   ✅ No matches found\n');
    }

    // 3. Check jobs.params.person2.name
    console.log('3️⃣ Checking jobs.params.person2.name:');
    const { data: jobs2, error: jobs2Error } = await supabase
      .from('jobs')
      .select('id, user_id, type, status, params, updated_at')
      .or('params->person2->>name.ilike.%fabrice%,params->person2->>name.ilike.%renaudin%');

    if (jobs2Error) {
      console.error('   ❌ Error:', jobs2Error.message);
    } else if (jobs2 && jobs2.length > 0) {
      jobs2.forEach((job: any) => {
        const p2Name = job.params?.person2?.name;
        console.log(`   📋 Job ${job.id} (${job.type}, ${job.status}):`);
        console.log(`      person2.name: "${p2Name}"`);
        console.log(`      user_id: ${job.user_id}`);
        console.log(`      updated_at: ${job.updated_at}`);
        console.log('');
      });
    } else {
      console.log('   ✅ No matches found\n');
    }

    // 4. Check jobs.input (legacy format)
    console.log('4️⃣ Checking jobs.input (legacy format):');
    const { data: allJobs, error: allJobsError } = await supabase
      .from('jobs')
      .select('id, user_id, type, status, input, updated_at')
      .limit(100);

    if (!allJobsError && allJobs) {
      const inputMatches = allJobs.filter((job: any) => {
        try {
          const input = typeof job.input === 'string' ? JSON.parse(job.input) : job.input;
          const p1Name = input?.person1?.name || '';
          const p2Name = input?.person2?.name || '';
          return p1Name.toLowerCase().includes('fabrice') || 
                 p1Name.toLowerCase().includes('renaudin') ||
                 p2Name.toLowerCase().includes('fabrice') || 
                 p2Name.toLowerCase().includes('renaudin');
        } catch {
          return false;
        }
      });

      if (inputMatches.length > 0) {
        inputMatches.forEach((job: any) => {
          const input = typeof job.input === 'string' ? JSON.parse(job.input) : job.input;
          console.log(`   📋 Job ${job.id} (${job.type}, ${job.status}):`);
          console.log(`      input.person1.name: "${input?.person1?.name || 'N/A'}"`);
          console.log(`      input.person2.name: "${input?.person2?.name || 'N/A'}"`);
          console.log('');
        });
      } else {
        console.log('   ✅ No matches found\n');
      }
    }

    // 5. Summary
    console.log('📊 SUMMARY:');
    console.log('   The name "Fabrice Renaudin" is likely stored in:');
    console.log('   - jobs.params.person1.name (PRIMARY SOURCE for MyLibraryScreen)');
    console.log('   - library_people.name (secondary, used for matching)');
    console.log('   - AsyncStorage cache (app-side, needs clearing)');
    console.log('\n   💡 MyLibraryScreen reads names from job.params FIRST, then falls back to library_people');
    console.log('   💡 This is why updating library_people alone doesn\'t change the display');

  } catch (err: any) {
    console.error('❌ Unexpected error:', err);
    process.exit(1);
  }
}

traceFabriceName().catch(console.error);
