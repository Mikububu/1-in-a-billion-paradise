import 'dotenv/config';
import { createSupabaseServiceClient } from './src/services/supabaseClient';
import { getCoupleImage } from './src/services/coupleImageService';

async function main() {
  const supabase = createSupabaseServiceClient();
  if (!supabase) throw new Error('Supabase not configured');

  const userId = 'e34061de-755c-4b5e-9b0d-a6c7aa8bddc2';

  console.log('🔍 Finding Akasha and Anand...\n');

  const { data: akasha } = await supabase
    .from('library_people')
    .select('client_person_id, name, claymation_url')
    .eq('user_id', userId)
    .ilike('name', '%Akasha%')
    .single();

  const { data: anand } = await supabase
    .from('library_people')
    .select('client_person_id, name, claymation_url')
    .eq('user_id', userId)
    .ilike('name', '%Anand%')
    .single();

  if (!akasha || !anand) {
    console.error('❌ Could not find Akasha or Anand');
    return;
  }

  console.log(`✅ Akasha: ${akasha.client_person_id}`);
  console.log(`   Portrait: ${akasha.claymation_url}\n`);
  
  console.log(`✅ Anand: ${anand.client_person_id}`);
  console.log(`   Portrait: ${anand.claymation_url}\n`);

  if (!akasha.claymation_url || !anand.claymation_url) {
    console.error('❌ Both people need portraits to generate a couple image');
    return;
  }

  console.log('🎨 Generating couple image...\n');

  const result = await getCoupleImage(
    userId,
    akasha.client_person_id,
    anand.client_person_id,
    akasha.claymation_url,
    anand.claymation_url,
    false // don't force regenerate if it exists
  );

  if (result.success) {
    console.log('✅ Couple image generated successfully!');
    console.log(`   URL: ${result.coupleImageUrl}\n`);
  } else {
    console.error('❌ Failed to generate couple image:', result.error);
  }
}

main().catch(console.error);
