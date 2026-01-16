import 'dotenv/config';
import { createSupabaseServiceClient } from './src/services/supabaseClient';

/**
 * Update Michael's library_people record with the claymation URL
 */
async function main() {
  const supabase = createSupabaseServiceClient();
  if (!supabase) {
    throw new Error('Supabase not configured');
  }

  const userId = 'e34061de-755c-4b5e-9b0d-a6c7aa8bddc2';
  
  const originalUrl = 'https://qdfikbgwuauertfmkmzk.supabase.co/storage/v1/object/public/profile-images/e34061de-755c-4b5e-9b0d-a6c7aa8bddc2/self/original.jpg';
  const claymationUrl = 'https://qdfikbgwuauertfmkmzk.supabase.co/storage/v1/object/public/profile-images/e34061de-755c-4b5e-9b0d-a6c7aa8bddc2/self/claymation.png';

  console.log('📝 Updating library_people record...');
  console.log(`   User ID: ${userId}`);
  console.log(`   Claymation URL: ${claymationUrl}\n`);

  const { data, error } = await supabase
    .from('library_people')
    .update({
      claymation_url: claymationUrl,
      original_photo_url: originalUrl,
      updated_at: new Date().toISOString(),
    })
    .eq('user_id', userId)
    .eq('is_user', true)
    .select();

  if (error) {
    console.error('❌ Update failed:', error);
    return;
  }

  console.log('✅ Updated successfully!');
  console.log('📊 Record:', data);
  console.log('\n🎉 Your claymation portrait should now appear in the app!');
}

main().catch(console.error);
