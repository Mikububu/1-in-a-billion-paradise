/**
 * CHECK MICHAEL FILES
 * 
 * Lists all Michael files in database and checks what's downloaded.
 */

import { createSupabaseServiceClient } from '../services/supabaseClient';
import { config } from 'dotenv';
import { join } from 'path';
import fs from 'fs/promises';
import path from 'path';

config({ path: join(__dirname, '../../.env') });

const PROJECT_ROOT = path.resolve(__dirname, '../../..');
const OUTPUT_DIR = process.env.MEDIA_OUT_DIR || path.join(PROJECT_ROOT, 'runtime', 'media');

async function checkMichaelFiles() {
  const supabase = createSupabaseServiceClient();

  if (!supabase) {
    console.error('❌ Supabase not configured');
    process.exit(1);
  }

  console.log('🔍 CHECKING MICHAEL FILES');
  console.log('═══════════════════════════════════════════════════════════\n');

  try {
    // Get all media artifacts
    const { data: artifacts, error } = await supabase
      .from('job_artifacts')
      .select('id, job_id, artifact_type, storage_path, bucket_name, file_size_bytes')
      .in('artifact_type', ['pdf', 'audio_mp3', 'audio_m4a', 'audio_song'])
      .not('storage_path', 'is', null);

    if (error) throw error;

    // Find Michael files (Michael in filename, or Person_2 which might be Michael)
    const michaelFiles = artifacts?.filter((a: any) => {
      const fileName = a.storage_path.split('/').pop().toLowerCase();
      return fileName.includes('michael') || fileName.includes('person_2');
    }) || [];

    console.log(`📊 Total media artifacts: ${artifacts?.length || 0}`);
    console.log(`📊 Michael-related files in DB: ${michaelFiles.length}\n`);

    if (michaelFiles.length === 0) {
      console.log('❌ No Michael files found in database!');
      return;
    }

    // Group by type
    const byType: Record<string, any[]> = {};
    for (const file of michaelFiles) {
      const type = file.artifact_type || 'unknown';
      if (!byType[type]) byType[type] = [];
      byType[type].push(file);
    }

    console.log('📋 Michael files by type:\n');
    for (const [type, files] of Object.entries(byType)) {
      console.log(`${type}: ${files.length} file(s)`);
      for (const file of files) {
        const fileName = file.storage_path.split('/').pop();
        const sizeMB = (file.file_size_bytes || 0) / (1024 * 1024);
        console.log(`  - ${fileName} (${sizeMB.toFixed(2)} MB)`);
      }
      console.log('');
    }

    // Check what's downloaded
    console.log('📥 Checking downloaded files...\n');
    
    const userDir = path.join(OUTPUT_DIR, 'e34061de-755c-4b5e-9b0d-a6c7aa8bddc2');
    
    for (const [type, files] of Object.entries(byType)) {
      console.log(`${type} files:`);
      const typeDir = path.join(userDir, type);
      
      try {
        const downloadedFiles = await fs.readdir(typeDir);
        
        for (const file of files) {
          const fileName = file.storage_path.split('/').pop();
          const isDownloaded = downloadedFiles.includes(fileName);
          const status = isDownloaded ? '✅ Downloaded' : '❌ MISSING';
          console.log(`  ${status}: ${fileName}`);
          
          if (!isDownloaded) {
            console.log(`     Storage path: ${file.storage_path}`);
            console.log(`     Bucket: ${file.bucket_name || 'job-artifacts'}`);
          }
        }
      } catch (err: any) {
        console.log(`  ⚠️  Directory ${typeDir} doesn't exist`);
        for (const file of files) {
          const fileName = file.storage_path.split('/').pop();
          console.log(`  ❌ MISSING: ${fileName}`);
        }
      }
      console.log('');
    }

    // Summary
    let totalDownloaded = 0;
    let totalMissing = 0;
    
    for (const [type, files] of Object.entries(byType)) {
      const typeDir = path.join(userDir, type);
      try {
        const downloadedFiles = await fs.readdir(typeDir);
        for (const file of files) {
          const fileName = file.storage_path.split('/').pop();
          if (downloadedFiles.includes(fileName)) {
            totalDownloaded++;
          } else {
            totalMissing++;
          }
        }
      } catch {
        totalMissing += files.length;
      }
    }

    console.log('═══════════════════════════════════════════════════════════');
    console.log(`📊 SUMMARY:`);
    console.log(`   Total Michael files in DB: ${michaelFiles.length}`);
    console.log(`   ✅ Downloaded: ${totalDownloaded}`);
    console.log(`   ❌ Missing: ${totalMissing}`);
    console.log('═══════════════════════════════════════════════════════════\n');

  } catch (error: any) {
    console.error('❌ Fatal error:', error);
    process.exit(1);
  }
}

checkMichaelFiles().catch(err => {
  console.error('❌ Fatal error:', err);
  process.exit(1);
});
