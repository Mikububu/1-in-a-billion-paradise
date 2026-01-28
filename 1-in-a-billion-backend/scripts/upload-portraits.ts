/**
 * UPLOAD PORTRAITS VIA API
 * 
 * This script uploads photos and generates AI portraits for people via the backend API.
 * 
 * Usage:
 * 1. Put your photos in a folder (e.g., ./portraits/)
 * 2. Name them: michael.jpg, tmiku.jpg, pupui.jpg (matching person names in lowercase)
 * 3. Run: npx ts-node scripts/upload-portraits.ts
 */

import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';
import fetch from 'node-fetch';

const SUPABASE_URL = process.env.SUPABASE_URL!;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:8787';

// Folder containing photos (name them after the person, e.g., michael.jpg)
const PHOTOS_FOLDER = path.join(__dirname, '../../portraits');

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

async function uploadPortraits() {
  console.log('🎨 Starting portrait upload and generation...\n');

  // 1. Get all people from Supabase
  const { data: people, error } = await supabase
    .from('library_people')
    .select('user_id, client_person_id, name')
    .order('name');

  if (error || !people || people.length === 0) {
    console.error('❌ No people found in Supabase');
    return;
  }

  console.log(`Found ${people.length} people:\n`);
  people.forEach((p, i) => {
    console.log(`   ${i + 1}. ${p.name} (ID: ${p.client_person_id})`);
  });
  console.log('');

  // 2. Check if photos folder exists
  if (!fs.existsSync(PHOTOS_FOLDER)) {
    console.log(`📁 Creating photos folder: ${PHOTOS_FOLDER}`);
    fs.mkdirSync(PHOTOS_FOLDER, { recursive: true });
    console.log('\n⚠️  Please add photos to this folder:');
    console.log(`   ${PHOTOS_FOLDER}`);
    console.log('\n   Name them: michael.jpg, tmiku.jpg, etc. (lowercase, matching person names)');
    console.log('   Then run this script again.\n');
    return;
  }

  // 3. Process each person
  for (const person of people) {
    const nameLower = person.name.toLowerCase().replace(/\s+/g, '-');
    const possibleExtensions = ['.jpg', '.jpeg', '.png'];
    
    let photoPath: string | null = null;
    for (const ext of possibleExtensions) {
      const testPath = path.join(PHOTOS_FOLDER, nameLower + ext);
      if (fs.existsSync(testPath)) {
        photoPath = testPath;
        break;
      }
    }

    if (!photoPath) {
      console.log(`⏭️  Skipping ${person.name} - no photo found (looking for ${nameLower}.jpg/png)`);
      continue;
    }

    console.log(`\n📸 Processing ${person.name}...`);
    console.log(`   Photo: ${path.basename(photoPath)}`);

    try {
      // Read photo and convert to base64
      const photoBuffer = fs.readFileSync(photoPath);
      const photoBase64 = photoBuffer.toString('base64');

      // Call the API to generate portrait
      const response = await fetch(`${BACKEND_URL}/api/profile/portrait`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-User-Id': person.user_id,
        },
        body: JSON.stringify({
          photoBase64,
          personId: person.client_person_id,
        }),
      });

      const result: any = await response.json();

      if (result.success) {
        console.log(`   ✅ Portrait generated!`);
        console.log(`   URL: ${result.imageUrl}`);
        if (result.cost) {
          console.log(`   Cost: $${result.cost.toFixed(4)}`);
        }
      } else {
        console.error(`   ❌ Failed: ${result.error}`);
      }
    } catch (error: any) {
      console.error(`   ❌ Error: ${error.message}`);
    }
  }

  console.log('\n✨ Portrait generation complete!\n');
}

uploadPortraits()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('\n💥 Script error:', error);
    process.exit(1);
  });
