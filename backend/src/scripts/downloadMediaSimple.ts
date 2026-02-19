/**
 * DOWNLOAD MEDIA - SIMPLE VERSION
 * 
 * Downloads media files with better error handling and progress tracking.
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
  console.log(`📁 Output: ${OUTPUT_DIR}\n`);
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

async function downloadMediaSimple() {
  const supabase = createSupabaseServiceClient();
  if (!supabase) {
    console.error('❌ Supabase not configured');
    process.exit(1);
  }

  console.log('📥 DOWNLOADING ALL READINGS MEDIA');
  console.log('═══════════════════════════════════════════════════════════\n');
  await ensureOutputDir();

  try {
    // Get all media artifacts
    console.log('📊 Fetching artifact list...');
    const { data: artifacts, error } = await supabase
      .from('job_artifacts')
      .select('id, job_id, artifact_type, storage_path, bucket_name, file_size_bytes')
      .not('storage_path', 'is', null)
      .in('artifact_type', ['pdf', 'audio_mp3', 'audio_m4a', 'audio_song'])
      .order('created_at', { ascending: false });

    if (error) throw error;
    if (!artifacts || artifacts.length === 0) {
      console.log('✅ No media artifacts found');
      return;
    }

    console.log(`✅ Found ${artifacts.length} media artifact(s)\n`);

    // Get job info
    const jobIds = [...new Set(artifacts.map((a: any) => a.job_id))];
    console.log(`📊 Fetching job info for ${jobIds.length} job(s)...`);
    
    const { data: jobs, error: jobsError } = await supabase
      .from('jobs')
      .select('id, user_id')
      .in('id', jobIds);

    if (jobsError) throw jobsError;
    const jobMap = new Map((jobs || []).map((j: any) => [j.id, j]));
    console.log(`✅ Found ${jobs?.length || 0} job(s)\n`);

    // Group by user
    const byUser: Record<string, any[]> = {};
    for (const artifact of artifacts) {
      const job = jobMap.get(artifact.job_id);
      const userId = (job as any)?.user_id || 'unknown';
      if (!byUser[userId]) byUser[userId] = [];
      byUser[userId].push({ ...artifact, job });
    }

    console.log(`📊 Organizing by ${Object.keys(byUser).length} user(s)...\n`);

    let totalDownloaded = 0;
    let totalFailed = 0;
    let totalBytes = 0;

    for (const [userId, userArtifacts] of Object.entries(byUser)) {
      console.log(`👤 User: ${userId}`);
      console.log(`   ${userArtifacts.length} file(s) to download\n`);
      
      const userDir = path.join(OUTPUT_DIR, userId);

      for (let i = 0; i < userArtifacts.length; i++) {
        const artifact = userArtifacts[i];
        const bucket = artifact.bucket_name || 'job-artifacts';
        const storagePath = artifact.storage_path;
        const fileName = path.basename(storagePath);
        const typeDir = path.join(userDir, artifact.artifact_type);
        const localPath = path.join(typeDir, fileName);
        
        // Check if file already exists
        try {
          await fs.access(localPath);
          console.log(`   ⏭️  Skipping (already exists): ${fileName}`);
          totalDownloaded++;
          totalBytes += artifact.file_size_bytes || 0;
          continue;
        } catch {
          // File doesn't exist, download it
        }

        console.log(`   [${i + 1}/${userArtifacts.length}] ${fileName}`);
        const success = await downloadFile(supabase, bucket, storagePath, localPath);
        
        if (success) {
          totalDownloaded++;
          totalBytes += artifact.file_size_bytes || 0;
        } else {
          totalFailed++;
        }
      }
      console.log('');
    }

    const totalMB = totalBytes / (1024 * 1024);
    const totalGB = totalMB / 1024;
    
    console.log('═══════════════════════════════════════════════════════════');
    console.log('🎉 DOWNLOAD COMPLETE!');
    console.log(`   ✅ Downloaded: ${totalDownloaded} file(s)`);
    console.log(`   ❌ Failed: ${totalFailed} file(s)`);
    console.log(`   💾 Total size: ${totalMB.toFixed(2)} MB (${totalGB.toFixed(2)} GB)`);
    console.log(`   📁 Location: ${OUTPUT_DIR}`);
    console.log('═══════════════════════════════════════════════════════════\n');

  } catch (error: any) {
    console.error('❌ Fatal error:', error);
    process.exit(1);
  }
}

downloadMediaSimple().catch(err => {
  console.error('❌ Fatal error:', err);
  process.exit(1);
});
