/**
 * PORTRAIT RECOVERY SCRIPT
 * 
 * Scans Supabase Storage for existing AI-generated portraits and
 * restores them to the library_people table.
 * 
 * Run: npx ts-node scripts/restore-portraits.ts
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const SUPABASE_URL = process.env.SUPABASE_URL || '';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('❌ Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

interface StorageFile {
  name: string;
  id: string;
  updated_at: string;
  created_at: string;
  metadata: any;
}

interface PersonRow {
  user_id: string;
  client_person_id: string;
  name: string;
  portrait_url: string | null;
  original_photo_url: string | null;
}

async function main() {
  console.log('🔍 Starting Portrait Recovery Script...\n');
  
  // Step 1: Get all people from library_people
  const { data: people, error: peopleError } = await supabase
    .from('library_people')
    .select('user_id, client_person_id, name, portrait_url, original_photo_url');
  
  if (peopleError) {
    console.error('❌ Failed to fetch people:', peopleError.message);
    process.exit(1);
  }
  
  console.log(`📋 Found ${people?.length || 0} people in library_people\n`);
  
  // Step 2: List all files in profile-images bucket
  const { data: bucketFolders, error: listError } = await supabase.storage
    .from('profile-images')
    .list('', { limit: 1000 });
  
  if (listError) {
    console.error('❌ Failed to list storage folders:', listError.message);
    process.exit(1);
  }
  
  console.log(`📁 Found ${bucketFolders?.length || 0} user folders in profile-images bucket\n`);
  
  let restoredCount = 0;
  let alreadyOkCount = 0;
  let notFoundCount = 0;
  
  // Step 3: For each user folder, check for portraits
  for (const folder of bucketFolders || []) {
    if (!folder.name || folder.name.startsWith('.')) continue;
    
    const userId = folder.name;
    
    // List subfolders (person IDs or 'self')
    const { data: personFolders } = await supabase.storage
      .from('profile-images')
      .list(userId, { limit: 100 });
    
    if (!personFolders) continue;
    
    for (const personFolder of personFolders) {
      if (!personFolder.name || personFolder.name.startsWith('.')) continue;
      
      const personId = personFolder.name;
      const portraitPath = `${userId}/${personId}/AI-generated-portrait.png`;
      const originalPath = `${userId}/${personId}/original.jpg`;
      
      // Check if portrait exists
      const { data: portraitUrl } = supabase.storage
        .from('profile-images')
        .getPublicUrl(portraitPath);
      
      const { data: originalUrl } = supabase.storage
        .from('profile-images')
        .getPublicUrl(originalPath);
      
      // Verify portrait file actually exists
      try {
        const headResp = await fetch(portraitUrl.publicUrl, { method: 'HEAD' });
        if (!headResp.ok) {
          console.log(`  ⏭️ No portrait found for ${userId}/${personId}`);
          continue;
        }
      } catch {
        continue;
      }
      
      // Find matching person in library_people
      const matchingPerson = (people || []).find((p: PersonRow) => 
        p.user_id === userId && 
        (p.client_person_id === personId || (personId === 'self' && p.client_person_id))
      );
      
      if (!matchingPerson) {
        console.log(`  ⚠️ No library_people entry found for ${userId}/${personId}`);
        notFoundCount++;
        continue;
      }
      
      // Check if already has correct portrait URL
      if (matchingPerson.portrait_url === portraitUrl.publicUrl) {
        console.log(`  ✅ ${matchingPerson.name}: Portrait URL already correct`);
        alreadyOkCount++;
        continue;
      }
      
      // Update the person's portrait URL
      const updatePayload: any = {
        portrait_url: portraitUrl.publicUrl,
        updated_at: new Date().toISOString(),
      };
      
      // Check if original photo exists too
      try {
        const origHead = await fetch(originalUrl.publicUrl, { method: 'HEAD' });
        if (origHead.ok && !matchingPerson.original_photo_url) {
          updatePayload.original_photo_url = originalUrl.publicUrl;
        }
      } catch {
        // Original doesn't exist, that's fine
      }
      
      const { error: updateError } = await supabase
        .from('library_people')
        .update(updatePayload)
        .eq('user_id', userId)
        .eq('client_person_id', matchingPerson.client_person_id);
      
      if (updateError) {
        console.log(`  ❌ Failed to update ${matchingPerson.name}: ${updateError.message}`);
      } else {
        console.log(`  🔄 RESTORED: ${matchingPerson.name} portrait URL updated`);
        restoredCount++;
      }
    }
  }
  
  console.log('\n' + '='.repeat(60));
  console.log('📊 RECOVERY SUMMARY');
  console.log('='.repeat(60));
  console.log(`✅ Already correct: ${alreadyOkCount}`);
  console.log(`🔄 Restored: ${restoredCount}`);
  console.log(`⚠️ Not in database: ${notFoundCount}`);
  console.log('='.repeat(60) + '\n');
}

main().catch(console.error);
