/**
 * DOWNLOAD ALL READINGS MEDIA (Complete Version)
 * 
 * Downloads all reading media files and continues even if some fail.
 */

import { createSupabaseServiceClient } from '../services/supabaseClient';
import { config } from 'dotenv';
import { join } from 'path';
import fs from 'fs/promises';
import path from 'path';

config({ path: join(__dirname, '../../.env') });

const OUTPUT_DIR = path.join(process.env.HOME || '/Users/michaelperinwogenburg', 'Desktop', 'Reading media results');

async function ensureOutputDir() {
  await fs.mkdir(OUTPUT_DIR, { recursive: true });
}

async function downloadFile(supabase: any, bucket: string, storagePath: string, localPath: string): Promise<boolean> {
  try {
    const { data, error } = await supabase.storage.from(bucket).download(storagePath);
    if (error) {
      console.error(`   ❌ ${path.basename(storagePath)}: ${error.message}`);
      return false;
    }
    const dir = path.dirname(localPath);
    await fs.mkdir(dir, { recursive: true });
    const arrayBuffer = await data.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    await fs.writeFile(localPath, buffer);
    return true;
  } catch (error: any) {
    console.error(`   ❌ ${path.basename(storagePath)}: ${error.message}`);
    return false;
  }
}

async function downloadCompleteMedia() {
  const supabase = createSupabaseServiceClient();
  if (!supabase) {
    console.error('❌ Supabase not configured');
    process.exit(1);
  }

  console.log('📥 DOWNLOADING ALL READINGS MEDIA');
  console.log('═══════════════════════════════════════════════════════════\n');
  await ensureOutputDir();
  console.log(`📁 Output: ${OUTPUT_DIR}\n`);

  try {
    const { data: artifacts, error } = await supabase
      .from('job_artifacts')
      .select('id, job_id, artifact_type, storage_path, bucket_name, file_size_bytes, created_at')
      .not('storage_path', 'is', null)
      .in('artifact_type', ['pdf', 'audio_mp3', 'audio_m4a', 'audio_song'])
      .order('created_at', { ascending: false });

    if (error) throw error;
    if (!artifacts || artifacts.length === 0) {
      console.log('✅ No media artifacts found');
      return;
    }

    console.log(`✅ Found ${artifacts.length} media artifact(s)\n`);

    const jobIds = [...new Set(artifacts.map((a: any) => a.job_id))];
    const { data: jobs, error: jobsError } = await supabase
      .from('jobs')
      .select('id, user_id, params, created_at')
      .in('id', jobIds);

    if (jobsError) throw jobsError;
    const jobMap = new Map((jobs || []).map((j: any) => [j.id, j]));

    const byUser: Record<string, any[]> = {};
    for (const artifact of artifacts) {
      const job = jobMap.get(artifact.job_id);
      const userId = (job as any)?.user_id || 'unknown';
      if (!byUser[userId]) byUser[userId] = [];
      byUser[userId].push({ ...artifact, job });
    }

    let totalDownloaded = 0;
    let totalFailed = 0;
    let totalBytes = 0;

    for (const [userId, userArtifacts] of Object.entries(byUser)) {
      console.log(`👤 User: ${userId} (${userArtifacts.length} files)`);
      const userDir = path.join(OUTPUT_DIR, userId);

      for (const artifact of userArtifacts) {
        const bucket = artifact.bucket_name || 'job-artifacts';
        const storagePath = artifact.storage_path;
        const fileName = path.basename(storagePath);
        const typeDir = path.join(userDir, artifact.artifact_type);
        const localPath = path.join(typeDir, fileName);
        const sizeMB = (artifact.file_size_bytes || 0) / (1024 * 1024);
        
        process.stdout.write(`   📥 ${fileName} (${sizeMB.toFixed(2)} MB)... `);
        const success = await downloadFile(supabase, bucket, storagePath, localPath);
        
        if (success) {
          totalDownloaded++;
          totalBytes += artifact.file_size_bytes || 0;
          console.log('✅');
        } else {
          totalFailed++;
          console.log('❌');
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

downloadCompleteMedia().catch(err => {
  console.error('❌ Fatal error:', err);
  process.exit(1);
});
