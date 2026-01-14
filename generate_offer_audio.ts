/**
 * Generate pre-recorded offer screen audio files using Chatterbox TTS
 */
import { config } from 'dotenv';
import { join } from 'path';
import axios from 'axios';
import { createClient } from '@supabase/supabase-js';

config({ path: join(__dirname, '.env') });

const DAVID_VOICE_URL = 'https://qdfikbgwuauertfmkmzk.supabase.co/storage/v1/object/public/voices/david.wav';
const BACKEND_URL = process.env.BACKEND_URL || 'https://1-in-a-billion-backend.fly.dev';

// The 3 offer screen texts
const OFFER_TEXTS = [
  // Page 1: "We search for you! Every Week!"
  `Dear soul of the sun, welcome to a quiet promise we make to you and keep every single week. ` +
  `With a yearly subscription of $9.90, you enter a living system where our background algorithms work continuously, comparing you with others through rare and guarded sources of Vedic astrology, seeking resonance, harmony, and that elusive closeness to a billion. ` +
  `This work happens gently and silently, and whenever someone appears whose alignment comes close, you receive a weekly update as a sign that the search is alive and unfolding.`,

  // Page 2: "One complete personal reading"
  `Your first year includes something personal and intentional. ` +
  `As part of your subscription, you receive one complete personal reading created only for you, drawn from one of our five systems Vedic astrology, Western astrology, Kabbalah, Human Design, or Gene Keys. ` +
  `This is a deep individual reading focused solely on your own structure, timing, and inner design, delivered as an intimate audio experience of approximately 15 to 20 minutes. ` +
  `This reading becomes your energetic anchor within our database, allowing future comparisons to be more precise, more meaningful, and more true to who you are.`,

  // Page 3: "Become part of a movement of Souls"
  `Join the movement of conscious connections. ` +
  `Let us use technology to deeply dive into the beautiful depth of human connections. ` +
  `For $9.90 per year, you receive ongoing discovery and quiet precision. ` +
  `Your subscription includes a personal audio reading of approximately 15 to 20 minutes, focused entirely on you and drawn from one of our five systems. ` +
  `This reading becomes the foundation that allows the system to work more accurately for you, as meaningful connections are continuously explored and revealed as your path unfolds.`,
];

async function warmUpRunPod() {
  console.log('🔥 Warming up RunPod endpoint...');
  console.log('   This may take 30-60 seconds on cold start...\n');

  try {
    // Send a small warm-up request
    const warmUpText = 'Hello. This is a test.';
    const response = await axios.post(
      `${BACKEND_URL}/api/audio/generate-tts`,
      {
        text: warmUpText,
        provider: 'chatterbox',
        audioUrl: DAVID_VOICE_URL,
        exaggeration: 0.5,
      },
      {
        timeout: 120000, // 2 minutes for cold start
      }
    );

    if (response.data.success) {
      console.log('✅ RunPod endpoint is warmed up and ready!\n');
      return true;
    } else {
      console.warn('⚠️  Warm-up request completed but returned an error:', response.data.message);
      console.log('   Continuing anyway...\n');
      return true;
    }
  } catch (error: any) {
    console.error('❌ Warm-up failed:', error.message);
    console.log('   Trying to continue anyway...\n');
    return false;
  }
}

async function generateOfferAudio() {
  console.log('🎤 GENERATING OFFER SCREEN AUDIO FILES');
  console.log('═══════════════════════════════════════════════════════════\n');

  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseServiceKey) {
    console.error('❌ Supabase not configured (missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY)');
    process.exit(1);
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  // Warm up RunPod first
  await warmUpRunPod();

  const generatedUrls: string[] = [];

  for (let i = 0; i < OFFER_TEXTS.length; i++) {
    const pageNum = i + 1;
    const text = OFFER_TEXTS[i];
    
    console.log(`\n🎤 Generating audio for page ${pageNum}...`);
    console.log(`   Text length: ${text.length} characters`);

    try {
      // Generate TTS using backend API
      console.log(`   📡 Calling TTS API...`);
      const response = await axios.post(
        `${BACKEND_URL}/api/audio/generate-tts`,
        {
          text,
          provider: 'chatterbox',
          audioUrl: DAVID_VOICE_URL,
          exaggeration: 0.5,
        },
        {
          timeout: 240000, // 4 minutes
        }
      );

      if (!response.data.success || !response.data.audioBase64) {
        throw new Error(response.data.message || 'TTS generation failed');
      }

      const audioBase64 = response.data.audioBase64;
      const audioBuffer = Buffer.from(audioBase64, 'base64');
      console.log(`   ✅ Audio generated: ${Math.round(audioBuffer.length / 1024)}KB`);

      // Upload to Supabase Storage
      const storagePath = `offer-audio/page_${pageNum}.mp3`;
      console.log(`   ☁️  Uploading to Supabase: ${storagePath}...`);

      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('voices') // Using 'voices' bucket (public)
        .upload(storagePath, audioBuffer, {
          contentType: 'audio/mpeg',
          upsert: true, // Overwrite if exists
        });

      if (uploadError) {
        throw new Error(`Upload failed: ${uploadError.message}`);
      }

      // Get public URL
      const { data: urlData } = supabase.storage
        .from('voices')
        .getPublicUrl(storagePath);

      const publicUrl = urlData.publicUrl;
      generatedUrls.push(publicUrl);

      console.log(`   ✅ Uploaded successfully`);
      console.log(`   🔗 URL: ${publicUrl}`);

    } catch (error: any) {
      console.error(`   ❌ Error generating audio for page ${pageNum}:`, error.message);
      throw error;
    }
  }

  console.log('\n\n✅ ALL AUDIO FILES GENERATED SUCCESSFULLY!');
  console.log('═══════════════════════════════════════════════════════════\n');
  console.log('📋 Generated URLs:');
  generatedUrls.forEach((url, i) => {
    console.log(`   Page ${i + 1}: ${url}`);
  });

  console.log('\n📝 Update PostHookOfferScreen.tsx with these URLs:');
  console.log('const OFFER_AUDIO_URLS = [');
  generatedUrls.forEach((url, i) => {
    console.log(`    '${url}',${i < generatedUrls.length - 1 ? '' : ' // No comma on last item'}`);
  });
  console.log('];');
}

generateOfferAudio()
  .then(() => {
    console.log('\n✅ Done!');
    process.exit(0);
  })
  .catch((err) => {
    console.error('\n❌ Fatal error:', err);
    process.exit(1);
  });
