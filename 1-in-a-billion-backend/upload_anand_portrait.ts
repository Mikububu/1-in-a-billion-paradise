import 'dotenv/config';
import fs from 'fs';
import { createSupabaseServiceClient } from './src/services/supabaseClient';

/**
 * Upload Anand's AI portrait and check couple image generation
 */
async function main() {
  const supabase = createSupabaseServiceClient();
  if (!supabase) {
    throw new Error('Supabase not configured');
  }

  const userId = 'e34061de-755c-4b5e-9b0d-a6c7aa8bddc2'; // Michael's user ID
  
  console.log('🔍 Step 1: Finding Anand in library_people...\n');
  
  // Find Anand's record
  const { data: anandRecord, error: findError } = await supabase
    .from('library_people')
    .select('*')
    .eq('user_id', userId)
    .ilike('name', '%Anand%')
    .single();

  if (findError || !anandRecord) {
    console.error('❌ Could not find Anand in library_people:', findError);
    return;
  }

  console.log('✅ Found Anand:');
  console.log(`   Name: ${anandRecord.name}`);
  console.log(`   Client Person ID: ${anandRecord.client_person_id}`);
  console.log(`   Current claymation_url: ${anandRecord.claymation_url || 'None'}`);
  console.log(`   Current original_photo_url: ${anandRecord.original_photo_url || 'None'}\n`);

  const personId = anandRecord.client_person_id;

  console.log('📤 Step 2: Uploading AI portrait to Supabase Storage...\n');
  
  // Read the portrait file
  const portraitPath = '/Users/michaelperinwogenburg/Desktop/Anand_e34061de_AI_portrait.png';
  
  if (!fs.existsSync(portraitPath)) {
    console.error(`❌ Portrait file not found: ${portraitPath}`);
    return;
  }

  const portraitBuffer = fs.readFileSync(portraitPath);
  console.log(`   File size: ${(portraitBuffer.length / 1024).toFixed(2)} KB`);

  // Upload to Supabase Storage at the correct path
  const storagePath = `${userId}/${personId}/AI-generated-portrait.png`;
  
  console.log(`   Uploading to: profile-images/${storagePath}`);

  const { error: uploadError } = await supabase.storage
    .from('profile-images')
    .upload(storagePath, portraitBuffer, {
      contentType: 'image/png',
      upsert: true,
    });

  if (uploadError) {
    console.error('❌ Upload failed:', uploadError);
    return;
  }

  // Get public URL
  const { data: urlData } = supabase.storage
    .from('profile-images')
    .getPublicUrl(storagePath);

  const aiPortraitUrl = urlData.publicUrl;
  console.log(`✅ Uploaded successfully!`);
  console.log(`   URL: ${aiPortraitUrl}\n`);

  console.log('📝 Step 3: Updating library_people record...\n');

  const { error: updateError } = await supabase
    .from('library_people')
    .update({
      claymation_url: aiPortraitUrl,
      updated_at: new Date().toISOString(),
    })
    .eq('user_id', userId)
    .eq('client_person_id', personId);

  if (updateError) {
    console.error('❌ Update failed:', updateError);
    return;
  }

  console.log('✅ Updated library_people record!\n');

  console.log('🔍 Step 4: Checking for couple images...\n');

  // Check if there are any synastry pairs involving Anand
  const { data: synastryPairs, error: synastryError } = await supabase
    .from('synastry_pairs')
    .select('*')
    .eq('user_id', userId)
    .or(`person1_id.eq.${personId},person2_id.eq.${personId}`)
    .order('created_at', { ascending: false });

  if (synastryError) {
    console.error('❌ Error checking synastry pairs:', synastryError);
    return;
  }

  if (!synastryPairs || synastryPairs.length === 0) {
    console.log('ℹ️  No synastry pairs found for Anand\n');
    console.log('✅ Upload complete! No couple images to generate yet.');
    return;
  }

  console.log(`✅ Found ${synastryPairs.length} synastry pair(s) involving Anand:\n`);

  for (const pair of synastryPairs) {
    console.log(`   Pair: ${pair.person1_id} + ${pair.person2_id}`);
    
    // Get both people's portraits
    const { data: person1, error: p1Error } = await supabase
      .from('library_people')
      .select('name, claymation_url')
      .eq('user_id', userId)
      .eq('client_person_id', pair.person1_id)
      .single();

    const { data: person2, error: p2Error } = await supabase
      .from('library_people')
      .select('name, claymation_url')
      .eq('user_id', userId)
      .eq('client_person_id', pair.person2_id)
      .single();

    if (person1 && person2) {
      console.log(`     ${person1.name}: ${person1.claymation_url ? '✅ Has portrait' : '❌ Missing portrait'}`);
      console.log(`     ${person2.name}: ${person2.claymation_url ? '✅ Has portrait' : '❌ Missing portrait'}`);
      
      if (person1.claymation_url && person2.claymation_url) {
        // Check if couple image exists
        const { data: coupleImage, error: coupleError } = await supabase
          .from('couple_claymations')
          .select('couple_image_url, created_at')
          .eq('user_id', userId)
          .eq('person1_id', pair.person1_id)
          .eq('person2_id', pair.person2_id)
          .maybeSingle();

        if (coupleImage) {
          console.log(`     ✅ Couple image exists: ${coupleImage.couple_image_url}`);
          console.log(`        Created: ${coupleImage.created_at}`);
        } else {
          console.log(`     ⚠️  Couple image NOT found - should be generated automatically when PDF is requested`);
          console.log(`        You can manually trigger it via: POST /api/couples/image`);
        }
      } else {
        console.log(`     ⚠️  Cannot generate couple image - both portraits needed`);
      }
    }
    console.log('');
  }

  console.log('🎉 Upload complete!\n');
  console.log('ℹ️  Note: Couple images are generated automatically when:');
  console.log('   1. A synastry PDF is requested (via PDF generation)');
  console.log('   2. You manually call POST /api/couples/image');
  console.log('   3. The pdfWorker runs and both portraits exist\n');
}

main().catch(console.error);
