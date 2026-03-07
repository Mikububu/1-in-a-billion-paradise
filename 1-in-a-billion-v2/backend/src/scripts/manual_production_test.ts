
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import axios from 'axios';
import { swissEngine } from '../services/swissEphemeris';
import { env } from '../config/env';
import { generateReadingPDF } from '../services/pdf/pdfGenerator';

// Load environment variables
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const PROJECT_ROOT = path.resolve(__dirname, '../../..');
const OUTPUT_DIR = process.env.MEDIA_OUT_DIR || path.join(PROJECT_ROOT, 'runtime', 'media');

async function runTest() {
  console.log('🚀 Starting Manual Production Test for Michael...');

  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
    console.log(`📁 Created output directory: ${OUTPUT_DIR}`);
  }

  // 1. Setup Person Data
  const michael = {
    name: 'Michael',
    birthDate: '1968-08-23',
    birthTime: '13:45',
    timezone: 'Europe/Vienna',
    latitude: 46.6103,
    longitude: 13.8558,
  };

  try {
    // 2. Calculate Placements
    console.log('\n🔮 Calculating Placements...');
    const placements = await swissEngine.computePlacements({
      birthDate: michael.birthDate,
      birthTime: michael.birthTime,
      timezone: michael.timezone,
      latitude: michael.latitude,
      longitude: michael.longitude,
      relationshipIntensity: 5,
      relationshipMode: 'sensual',
      primaryLanguage: 'en',
    });
    console.log('✅ Placements calculated:', {
      sun: placements.sunSign,
      moon: placements.moonSign,
      rising: placements.risingSign
    });

    // 3. Generate Text (Western) — readings now go through textWorker pipeline
    console.log('\n📝 Generating placeholder text for PDF/audio test...');
    const textContent = 'Test reading content — production readings are generated via the textWorker job pipeline.';
    const textPath = path.join(OUTPUT_DIR, 'reading.txt');
    fs.writeFileSync(textPath, textContent);
    console.log(`✅ Text generated and saved to ${textPath} (${textContent.length} chars)`);

    // 4. Generate Audio (Chatterbox via RunPod)
    console.log('\n🎙️ Generating Audio...');
    // We call the local API because it handles the complex stitching logic
    // Ensure `npm run dev` is running on port 8787!
    try {
      const audioResponse = await axios.post(
        'http://localhost:8787/api/audio/generate-tts',
        {
          text: textContent,
          provider: 'chatterbox', // Use RunPod
          exaggeration: 0.3,
        },
        {
          headers: { 'Content-Type': 'application/json' },
          timeout: 20 * 60 * 1000, // 20 minutes
        }
      );

      if (audioResponse.data.success && audioResponse.data.audioBase64) {
        const audioBuffer = Buffer.from(audioResponse.data.audioBase64, 'base64');
        const audioPath = path.join(OUTPUT_DIR, 'reading.mp3');
        fs.writeFileSync(audioPath, audioBuffer);
        console.log(`✅ Audio generated and saved to ${audioPath} (${(audioBuffer.length / 1024 / 1024).toFixed(2)} MB)`);
      } else {
        console.error('❌ Audio generation failed (API returned failure):', audioResponse.data);
      }
    } catch (error: any) {
      console.error('❌ Audio generation failed (Network/Timeout):', error.message);
      if (error.response) console.error('Response data:', error.response.data);
    }

    // 5. Generate PDF
    console.log('\n📄 Generating PDF...');
    const pdfResult = await generateReadingPDF({
      type: 'single',
      title: 'Western Astrology Reading',
      subtitle: 'Prepared for Michael',
      person1: {
        name: michael.name,
        birthDate: michael.birthDate,
        sunSign: placements.sunSign,
        moonSign: placements.moonSign,
        risingSign: placements.risingSign
      },
      chapters: [{
        title: 'Western Analysis',
        system: 'western',
        person1Reading: textContent
      }],
      generatedAt: new Date(),
    });

    // Copy the generated PDF to our output dir
    const destPdfPath = path.join(OUTPUT_DIR, 'reading.pdf');
    fs.copyFileSync(pdfResult.filePath, destPdfPath);
    console.log(`✅ PDF generated and saved to ${destPdfPath} (${pdfResult.pageCount} pages)`);

    console.log('\n🎉 Test Complete! Artifacts are in:', OUTPUT_DIR);

  } catch (error) {
    console.error('\n❌ Test Failed:', error);
  }
}

runTest();
