import 'dotenv/config';
import { config } from 'dotenv';
import { join } from 'path';

config({ path: join(__dirname, '.env') });

const API_URL = process.env.CORE_API_URL || 'https://1-in-a-billion-backend.fly.dev';

async function testParallelAudio() {
  console.log('🎵 Testing parallel audio stitching...\n');
  console.log(`📍 API URL: ${API_URL}`);
  console.log(`⚙️  AUDIO_PARALLEL_MODE: ${process.env.AUDIO_PARALLEL_MODE || 'not set (defaults to false)'}\n`);

  // Test text - long enough to require chunking (300 chars per chunk)
  const testText = `
The stars align in mysterious ways, revealing the hidden patterns of your soul. 
Each planet carries a message, each house holds a secret. Your journey through 
the cosmos is written in the language of light and shadow. The Sun illuminates 
your core essence, while the Moon reveals your deepest emotional currents. 
Mercury guides your thoughts, Venus shapes your desires, and Mars fuels your 
will to action. Jupiter expands your horizons, Saturn teaches you discipline, 
and the outer planets whisper of transformation. In this reading, we explore 
the intricate dance of these celestial forces as they weave together to create 
the unique tapestry of your existence. Every moment is a choice, every choice 
a path, and every path leads back to the center of who you truly are.
  `.trim();

  console.log(`📝 Test text: ${testText.length} characters`);
  console.log(`📦 Expected chunks: ~${Math.ceil(testText.length / 300)}\n`);

  const startTime = Date.now();

  try {
    const response = await fetch(`${API_URL}/api/audio/generate-tts`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        text: testText,
        provider: 'chatterbox',
        title: 'Test Audio',
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`API error (${response.status}): ${errorText}`);
    }

    // Check if response is JSON or audio
    const contentType = response.headers.get('content-type');
    
    if (contentType?.includes('application/json')) {
      const data = await response.json();
      console.log('📥 Response:', data);
      
      if (data.audioBase64) {
        const audioSize = Buffer.from(data.audioBase64, 'base64').length;
        const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
        
        console.log(`\n✅ Audio generated successfully!`);
        console.log(`   Duration: ${data.duration}s`);
        console.log(`   Size: ${(audioSize / 1024).toFixed(1)} KB`);
        console.log(`   Generation time: ${elapsed}s`);
        console.log(`\n🚀 Mode: ${process.env.AUDIO_PARALLEL_MODE === 'true' ? 'PARALLEL ⚡' : 'SEQUENTIAL 🐢'}`);
        
        if (process.env.AUDIO_PARALLEL_MODE === 'true') {
          console.log(`   Expected speedup: 3-5x faster than sequential!`);
        }
      }
    } else {
      // Binary audio response
      const audioBuffer = await response.arrayBuffer();
      const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
      
      console.log(`\n✅ Audio generated successfully!`);
      console.log(`   Size: ${(audioBuffer.byteLength / 1024).toFixed(1)} KB`);
      console.log(`   Generation time: ${elapsed}s`);
      console.log(`\n🚀 Mode: ${process.env.AUDIO_PARALLEL_MODE === 'true' ? 'PARALLEL ⚡' : 'SEQUENTIAL 🐢'}`);
    }

  } catch (error: any) {
    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    console.error(`\n❌ Error after ${elapsed}s:`, error.message);
  }
}

testParallelAudio().catch(console.error);
