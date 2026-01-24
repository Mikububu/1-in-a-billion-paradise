/**
 * REAL-TIME READING DOWNLOADER
 * 
 * Automatically downloads ALL readings (PDFs, Audio, Songs) as they're created
 * Output: ~/Desktop/OUTPUT/<person_name>/
 * 
 * Usage:
 *   npx ts-node watch-all-readings.ts
 */

import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';
import { config } from 'dotenv';

config();

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const OUTPUT_DIR = path.join(process.env.HOME!, 'Desktop', 'OUTPUT');
const USER_ID = 'e34061de-755c-4b5e-9b0d-a6c7aa8bddc2'; // Your user ID

// Track what we've already downloaded
const downloaded = new Set<string>();

function ensureDir(dir: string) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

async function getActiveJobs() {
  const { data: jobs } = await supabase
    .from('jobs')
    .select('id, type, params, status, created_at')
    .eq('user_id', USER_ID)
    .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()) // Last 24 hours
    .order('created_at', { ascending: false });

  return jobs || [];
}

async function downloadArtifacts() {
  const jobs = await getActiveJobs();
  
  for (const job of jobs) {
    const params = job.params as any;
    const person1 = params?.person1?.name || 'Person1';
    const person2 = params?.person2?.name;
    
    const folderName = person2 ? `${person1}_${person2}` : person1;
    const jobFolder = path.join(OUTPUT_DIR, folderName);
    ensureDir(jobFolder);

    // Get all artifacts (PDFs, audio, songs)
    const { data: artifacts } = await supabase
      .from('job_artifacts')
      .select('id, artifact_type, storage_path, created_at')
      .eq('job_id', job.id)
      .in('artifact_type', ['pdf', 'audio_mp3', 'audio_m4a', 'audio_song']);

    if (!artifacts) continue;

    for (const artifact of artifacts) {
      const key = `${job.id}:${artifact.id}`;
      if (downloaded.has(key)) continue;

      try {
        // Download from Supabase
        const { data, error } = await supabase.storage
          .from('job-artifacts')
          .download(artifact.storage_path);

        if (error || !data) {
          console.error(`   ❌ Failed: ${artifact.storage_path}`);
          continue;
        }

        // Save to disk
        const filename = path.basename(artifact.storage_path);
        const filepath = path.join(jobFolder, filename);
        
        const buffer = Buffer.from(await data.arrayBuffer());
        fs.writeFileSync(filepath, buffer);

        const sizeKB = Math.floor(buffer.length / 1024);
        const type = artifact.artifact_type.includes('song') ? '🎵' : 
                     artifact.artifact_type.includes('audio') ? '🎤' : '📄';
        console.log(`${type} ${folderName}/${filename} (${sizeKB}KB)`);
        
        downloaded.add(key);
      } catch (err: any) {
        console.error(`   ❌ Error: ${err.message}`);
      }
    }
  }
}

async function watchLoop() {
  console.log('👀 Watching for new readings...');
  console.log(`📁 Output: ${OUTPUT_DIR}\n`);
  
  ensureDir(OUTPUT_DIR);

  while (true) {
    try {
      await downloadArtifacts();
      await new Promise(resolve => setTimeout(resolve, 5000)); // Check every 5 seconds
    } catch (err: any) {
      console.error('❌ Error:', err.message);
      await new Promise(resolve => setTimeout(resolve, 10000));
    }
  }
}

watchLoop();
