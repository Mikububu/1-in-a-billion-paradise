/**
 * Upload pre-generated offer audio files to Supabase Storage
 */
import { config } from 'dotenv';
import { join } from 'path';
import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';

config({ path: join(__dirname, '.env') });

const AUDIO_FILES = [
  { local: '/Users/michaelperinwogenburg/Desktop/3 audios/1.mp3', remote: 'offer-audio/page_1.mp3' },
  { local: '/Users/michaelperinwogenburg/Desktop/3 audios/2.mp3', remote: 'offer-audio/page_2.mp3' },
  { local: '/Users/michaelperinwogenburg/Desktop/3 audios/3.mp3', remote: 'offer-audio/page_3.mp3' },
];

async function uploadOfferAudio() {
  console.log('☁️  UPLOADING OFFER AUDIO FILES TO SUPABASE');
  console.log('═══════════════════════════════════════════════════════════\n');

  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseServiceKey) {
    console.error('❌ Supabase not configured');
    process.exit(1);
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  const uploadedUrls: string[] = [];

  for (let i = 0; i < AUDIO_FILES.length; i++) {
    const file = AUDIO_FILES[i]!;
    const pageNum = i + 1;

    console.log(`\n📁 Uploading page ${pageNum}...`);
    console.log(`   Local:  ${file.local}`);
    console.log(`   Remote: ${file.remote}`);

    try {
      // Read file
      const audioBuffer = readFileSync(file.local);
      console.log(`   📊 File size: ${Math.round(audioBuffer.length / 1024)}KB`);

      // Upload to Supabase Storage
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('voices') // Public bucket
        .upload(file.remote, audioBuffer, {
          contentType: 'audio/mpeg',
          upsert: true, // Overwrite if exists
        });

      if (uploadError) {
        throw new Error(`Upload failed: ${uploadError.message}`);
      }

      // Get public URL
      const { data: urlData } = supabase.storage
        .from('voices')
        .getPublicUrl(file.remote);

      const publicUrl = urlData.publicUrl;
      uploadedUrls.push(publicUrl);

      console.log(`   ✅ Uploaded successfully`);
      console.log(`   🔗 ${publicUrl}`);

    } catch (error: any) {
      console.error(`   ❌ Error uploading page ${pageNum}:`, error.message);
      throw error;
    }
  }

  console.log('\n\n✅ ALL AUDIO FILES UPLOADED SUCCESSFULLY!');
  console.log('═══════════════════════════════════════════════════════════\n');
  console.log('📋 Public URLs:');
  uploadedUrls.forEach((url, i) => {
    console.log(`   Page ${i + 1}: ${url}`);
  });

  console.log('\n✅ Frontend PostHookOfferScreen.tsx is already configured with these URLs!');
}

uploadOfferAudio()
  .then(() => {
    console.log('\n✅ Done!');
    process.exit(0);
  })
  .catch((err) => {
    console.error('\n❌ Fatal error:', err);
    process.exit(1);
  });
