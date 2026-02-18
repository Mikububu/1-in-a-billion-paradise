/**
 * DOWNLOAD MICHAEL FILES
 * 
 * Downloads all missing Michael files.
 */

import { createSupabaseServiceClient } from '../services/supabaseClient';
import { config } from 'dotenv';
import { join } from 'path';
import fs from 'fs/promises';
import path from 'path';

config({ path: join(__dirname, '../../.env') });

const PROJECT_ROOT = path.resolve(__dirname, '../../..');
const OUTPUT_DIR = process.env.MEDIA_OUT_DIR || path.join(PROJECT_ROOT, 'runtime', 'media');

async function ensureOutputDir() {
  await fs.mkdir(OUTPUT_DIR, { recursive: true });
}

async function downloadFile(supabase: any, bucket: string, storagePath: string, localPath: string): Promise<boolean> {
  try {
    console.log(`   📥 Downloading: ${path.basename(storagePath)}...`);
    
    const { data, error } = await supabase.storage.from(bucket).download(storagePath);
    
    if (error) {
      console.error(`      ❌ Error: ${error.message}`);
      return false;
    }

    const dir = path.dirname(localPath);
    await fs.mkdir(dir, { recursive: true });
    
    const arrayBuffer = await data.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    await fs.writeFile(localPath, buffer);
    
    const sizeMB = (buffer.length / (1024 * 1024)).toFixed(2);
    console.log(`      ✅ Downloaded (${sizeMB} MB)`);
    return true;
  } catch (error: any) {
    console.error(`      ❌ Error: ${error.message}`);
    return false;
  }
}

async function downloadMichaelFiles() {
  const supabase = createSupabaseServiceClient();
  if (!supabase) {
    console.error('❌ Supabase not configured');
    process.exit(1);
  }

  console.log('📥 DOWNLOADING MICHAEL FILES');
  console.log('═══════════════════════════════════════════════════════════\n');
  await ensureOutputDir();

  try {
    // Get all media artifacts
    const { data: artifacts, error } = await supabase
      .from('job_artifacts')
      .select('id, job_id, artifact_type, storage_path, bucket_name, file_size_bytes')
      .in('artifact_type', ['pdf', 'audio_mp3', 'audio_m4a', 'audio_song'])
      .not('storage_path', 'is', null);

    if (error) throw error;

    // Find Michael files
    const michaelFiles = artifacts?.filter((a: any) => {
      const fileName = a.storage_path.split('/').pop().toLowerCase();
      return fileName.includes('michael') || fileName.includes('person_2');
    }) || [];

    console.log(`✅ Found ${michaelFiles.length} Michael-related file(s) in database\n`);

    if (michaelFiles.length === 0) {
      console.log('❌ No Michael files found in database!');
      return;
    }

    // Check what's missing
    const userDir = path.join(OUTPUT_DIR, 'e34061de-755c-4b5e-9b0d-a6c7aa8bddc2');
    const missingFiles: any[] = [];

    for (const file of michaelFiles) {
      const fileName = file.storage_path.split('/').pop();
      const typeDir = path.join(userDir, file.artifact_type);
      const localPath = path.join(typeDir, fileName);

      try {
        await fs.access(localPath);
        // File exists
      } catch {
        // File missing
        missingFiles.push(file);
      }
    }

    console.log(`📊 Missing files: ${missingFiles.length} out of ${michaelFiles.length}\n`);

    if (missingFiles.length === 0) {
      console.log('✅ All Michael files are already downloaded!');
      return;
    }

    // Download missing files
    console.log('📥 Downloading missing files...\n');
    
    let downloaded = 0;
    let failed = 0;

    for (let i = 0; i < missingFiles.length; i++) {
      const file = missingFiles[i];
      const fileName = file.storage_path.split('/').pop();
      const bucket = file.bucket_name || 'job-artifacts';
      const typeDir = path.join(userDir, file.artifact_type);
      const localPath = path.join(typeDir, fileName);

      console.log(`[${i + 1}/${missingFiles.length}] ${fileName}`);
      const success = await downloadFile(supabase, bucket, file.storage_path, localPath);
      
      if (success) {
        downloaded++;
      } else {
        failed++;
      }
    }

    console.log('\n═══════════════════════════════════════════════════════════');
    console.log('🎉 DOWNLOAD COMPLETE!');
    console.log(`   ✅ Downloaded: ${downloaded} file(s)`);
    console.log(`   ❌ Failed: ${failed} file(s)`);
    console.log('═══════════════════════════════════════════════════════════\n');

  } catch (error: any) {
    console.error('❌ Fatal error:', error);
    process.exit(1);
  }
}

downloadMichaelFiles().catch(err => {
  console.error('❌ Fatal error:', err);
  process.exit(1);
});
