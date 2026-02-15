/**
 * DOWNLOAD ALL READINGS TO DESKTOP (FLAT)
 * 
 * Downloads all audio, songs, and PDFs from Supabase storage
 * directly to Desktop folder - NO subfolders, just flat files.
 * 
 * Lists bucket directly (files may not be in job_artifacts table)
 * 
 * RUN: npx ts-node src/scripts/downloadAllToDesktop.ts
 */

import { createSupabaseServiceClient } from '../services/supabaseClient';
import { config } from 'dotenv';
import { join } from 'path';
import fs from 'fs/promises';
import path from 'path';

config({ path: join(__dirname, '../../.env') });

// Flat output to Desktop/Output folder
const OUTPUT_DIR = path.join(process.env.HOME || '/Users/michaelperinwogenburg', 'Desktop', 'Output');

async function downloadFile(supabase: any, bucket: string, storagePath: string, localPath: string): Promise<boolean> {
  try {
    const { data, error } = await supabase.storage.from(bucket).download(storagePath);
    if (error) {
      console.error(`   ❌ ${path.basename(storagePath)}: ${error.message}`);
      return false;
    }
    const arrayBuffer = await data.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    await fs.writeFile(localPath, buffer);
    return true;
  } catch (error: any) {
    console.error(`   ❌ ${path.basename(storagePath)}: ${error.message}`);
    return false;
  }
}

async function listAllFilesInBucket(supabase: any, bucket: string, prefix = ''): Promise<string[]> {
  const allFiles: string[] = [];
  
  try {
    const { data, error } = await supabase.storage.from(bucket).list(prefix, { limit: 1000 });
    if (error) {
      console.log(`   ⚠️ ${bucket}/${prefix}: ${error.message}`);
      return [];
    }

    for (const item of data || []) {
      const fullPath = prefix ? `${prefix}/${item.name}` : item.name;
      
      if (item.id === null) {
        // It's a folder - recurse
        const subFiles = await listAllFilesInBucket(supabase, bucket, fullPath);
        allFiles.push(...subFiles);
      } else {
        // It's a file
        allFiles.push(fullPath);
      }
    }
  } catch (err: any) {
    console.log(`   ⚠️ Error listing ${bucket}: ${err.message}`);
  }

  return allFiles;
}

async function downloadAllToDesktop() {
  const supabase = createSupabaseServiceClient();
  if (!supabase) {
    console.error('❌ Supabase not configured');
    process.exit(1);
  }

  console.log('');
  console.log('═══════════════════════════════════════════════════════════════════');
  console.log('📥 DOWNLOAD ALL READINGS TO DESKTOP (FLAT - NO FOLDERS)');
  console.log('═══════════════════════════════════════════════════════════════════');
  console.log(`📁 Output: ${OUTPUT_DIR}`);
  console.log('');

  // Focus on job-artifacts bucket
  const bucket = 'job-artifacts';
  console.log(`📂 Scanning bucket: ${bucket}`);
  
  const files = await listAllFilesInBucket(supabase, bucket);
  
  // Filter to media files
  const mediaExtensions = ['.m4a', '.mp3', '.wav', '.pdf'];
  const mediaFiles = files.filter(f => 
    mediaExtensions.some(ext => f.toLowerCase().endsWith(ext))
  );

  if (mediaFiles.length === 0) {
    console.log('   No media files found');
    console.log('');
    console.log('═══════════════════════════════════════════════════════════════════');
    console.log('No files to download');
    console.log('═══════════════════════════════════════════════════════════════════');
    return;
  }

  console.log(`   Found ${mediaFiles.length} media file(s)`);
  console.log('');

  let totalDownloaded = 0;
  let totalFailed = 0;
  const downloadedNames = new Set<string>();

  for (const storagePath of mediaFiles) {
    let fileName = path.basename(storagePath);
    
    // Make filename unique if already exists
    if (downloadedNames.has(fileName)) {
      const ext = path.extname(fileName);
      const base = path.basename(fileName, ext);
      let counter = 1;
      while (downloadedNames.has(`${base}_${counter}${ext}`)) {
        counter++;
      }
      fileName = `${base}_${counter}${ext}`;
    }
    downloadedNames.add(fileName);

    const localPath = path.join(OUTPUT_DIR, fileName);
    
    process.stdout.write(`   📥 ${fileName}... `);
    const success = await downloadFile(supabase, bucket, storagePath, localPath);
    
    if (success) {
      totalDownloaded++;
      console.log('✅');
    } else {
      totalFailed++;
      console.log('❌');
    }
  }

  console.log('');
  console.log('═══════════════════════════════════════════════════════════════════');
  console.log('🎉 DOWNLOAD COMPLETE!');
  console.log(`   ✅ Downloaded: ${totalDownloaded} file(s)`);
  console.log(`   ❌ Failed: ${totalFailed} file(s)`);
  console.log(`   📁 Location: ${OUTPUT_DIR}`);
  console.log('═══════════════════════════════════════════════════════════════════');
  console.log('');
}

downloadAllToDesktop().catch(err => {
  console.error('❌ Fatal error:', err);
  process.exit(1);
});
