/**
 * COMPARE DOWNLOADED FILES
 * 
 * Compares database files with what's actually downloaded.
 */

import { createSupabaseServiceClient } from '../services/supabaseClient';
import { config } from 'dotenv';
import { join } from 'path';
import fs from 'fs/promises';
import path from 'path';

config({ path: join(__dirname, '../../.env') });

const PROJECT_ROOT = path.resolve(__dirname, '../../..');
const OUTPUT_DIR = process.env.MEDIA_OUT_DIR || path.join(PROJECT_ROOT, 'runtime', 'media');

async function compareDownloaded() {
  const supabase = createSupabaseServiceClient();

  if (!supabase) {
    console.error('❌ Supabase not configured');
    process.exit(1);
  }

  console.log('🔍 COMPARING DATABASE VS DOWNLOADED');
  console.log('═══════════════════════════════════════════════════════════\n');

  try {
    // Get all media artifacts from database
    const { data: artifacts, error } = await supabase
      .from('job_artifacts')
      .select('id, job_id, artifact_type, storage_path, bucket_name, file_size_bytes')
      .in('artifact_type', ['pdf', 'audio_mp3', 'audio_m4a', 'audio_song'])
      .not('storage_path', 'is', null)
      .order('artifact_type', { ascending: true })
      .order('storage_path', { ascending: true });

    if (error) throw error;

    console.log(`📊 Total files in database: ${artifacts?.length || 0}\n`);

    // Group by user
    const { data: jobs, error: jobsError } = await supabase
      .from('jobs')
      .select('id, user_id')
      .in('id', [...new Set(artifacts?.map((a: any) => a.job_id) || [])]);

    if (jobsError) throw jobsError;
    const jobMap = new Map((jobs || []).map((j: any) => [j.id, j]));

    const byUser: Record<string, any[]> = {};
    for (const artifact of artifacts || []) {
      const job = jobMap.get(artifact.job_id);
      const userId = (job as any)?.user_id || 'unknown';
      if (!byUser[userId]) byUser[userId] = [];
      byUser[userId].push({ ...artifact, job });
    }

    // Check each user's files
    for (const [userId, userArtifacts] of Object.entries(byUser)) {
      console.log(`👤 User: ${userId}`);
      console.log(`   Files in database: ${userArtifacts.length}\n`);

      const userDir = path.join(OUTPUT_DIR, userId);
      
      // Check by type
      const byType: Record<string, any[]> = {};
      for (const artifact of userArtifacts) {
        const type = artifact.artifact_type || 'unknown';
        if (!byType[type]) byType[type] = [];
        byType[type].push(artifact);
      }

      let totalMissing = 0;
      let totalDownloaded = 0;

      for (const [type, files] of Object.entries(byType)) {
        const typeDir = path.join(userDir, type);
        let downloadedFiles: string[] = [];
        
        try {
          downloadedFiles = await fs.readdir(typeDir);
        } catch {
          // Directory doesn't exist
        }

        const missing: any[] = [];
        const downloaded: any[] = [];

        for (const file of files) {
          const fileName = file.storage_path.split('/').pop();
          if (downloadedFiles.includes(fileName)) {
            downloaded.push(file);
          } else {
            missing.push(file);
          }
        }

        totalDownloaded += downloaded.length;
        totalMissing += missing.length;

        console.log(`   📁 ${type.toUpperCase()}:`);
        console.log(`      ✅ Downloaded: ${downloaded.length}/${files.length}`);
        console.log(`      ❌ Missing: ${missing.length}/${files.length}`);

        if (missing.length > 0) {
          console.log(`\n      Missing files:`);
          for (const file of missing.slice(0, 10)) {
            const fileName = file.storage_path.split('/').pop();
            const sizeMB = (file.file_size_bytes || 0) / (1024 * 1024);
            console.log(`        ❌ ${fileName} (${sizeMB.toFixed(2)} MB)`);
          }
          if (missing.length > 10) {
            console.log(`        ... and ${missing.length - 10} more`);
          }
        }
        console.log('');
      }

      console.log(`   📊 SUMMARY:`);
      console.log(`      ✅ Downloaded: ${totalDownloaded}/${userArtifacts.length}`);
      console.log(`      ❌ Missing: ${totalMissing}/${userArtifacts.length}`);
      console.log('');
    }

    console.log('═══════════════════════════════════════════════════════════\n');

  } catch (error: any) {
    console.error('❌ Fatal error:', error);
    process.exit(1);
  }
}

compareDownloaded().catch(err => {
  console.error('❌ Fatal error:', err);
  process.exit(1);
});
