import 'dotenv/config';
import { createSupabaseServiceClient } from './src/services/supabaseClient';

async function main() {
  const supabase = createSupabaseServiceClient();
  if (!supabase) throw new Error('Supabase not configured');

  const userId = 'e34061de-755c-4b5e-9b0d-a6c7aa8bddc2';
  const anandPersonId = 'restored-anand-1768533420974';

  console.log('🔍 Checking couple_claymations table for Anand...\n');

  // Check couple images involving Anand (as person1 OR person2)
  const { data: couples, error } = await supabase
    .from('couple_claymations')
    .select('*')
    .eq('user_id', userId)
    .or(`person1_id.eq.${anandPersonId},person2_id.eq.${anandPersonId}`);

  if (error) {
    console.error('❌ Error:', error);
    return;
  }

  if (!couples || couples.length === 0) {
    console.log('ℹ️  No couple images found involving Anand\n');
    console.log('📋 Let me check all library_people to see who Anand could pair with:\n');
    
    const { data: allPeople } = await supabase
      .from('library_people')
      .select('client_person_id, name, claymation_url, is_user')
      .eq('user_id', userId)
      .order('name');
    
    if (allPeople) {
      console.log('People in library:');
      for (const person of allPeople) {
        const hasPortrait = person.claymation_url ? '✅' : '❌';
        const userLabel = person.is_user ? ' (USER)' : '';
        console.log(`  ${hasPortrait} ${person.name}${userLabel}`);
      }
    }
    
    console.log('\n💡 Couple images are generated automatically when:');
    console.log('   1. A synastry reading PDF is generated');
    console.log('   2. Both people have AI portraits (claymation_url)');
    console.log('   3. The system calls composeCoupleImage() during PDF generation\n');
    
    console.log('🔍 Checking jobs table for recent PDF generation attempts...\n');
    
    const { data: recentJobs } = await supabase
      .from('jobs')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(5);
      
    if (recentJobs && recentJobs.length > 0) {
      console.log('Recent jobs:');
      for (const job of recentJobs) {
        console.log(`  ${job.status} - ${job.doc_type} - ${new Date(job.created_at).toISOString()}`);
        if (job.person1_id || job.person2_id) {
          console.log(`    Person 1: ${job.person1_id}`);
          console.log(`    Person 2: ${job.person2_id}`);
        }
      }
    } else {
      console.log('No recent jobs found');
    }
    
  } else {
    console.log(`✅ Found ${couples.length} couple image(s):\n`);
    for (const couple of couples) {
      console.log(`Couple Image:`);
      console.log(`  Person 1: ${couple.person1_id}`);
      console.log(`  Person 2: ${couple.person2_id}`);
      console.log(`  Image URL: ${couple.couple_image_url}`);
      console.log(`  Created: ${couple.created_at}\n`);
    }
  }
}

main().catch(console.error);
