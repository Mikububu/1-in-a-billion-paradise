/**
 * ARTIFACT WATCHER - Downloads PDFs and audio only (no text files)
 */

import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';
import 'dotenv/config';

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const OUTPUT_DIR = path.join(process.env.HOME || '/Users/michaelperinwogenburg', 'Desktop', 'Akasha and Anand');
const POLL_INTERVAL = 5000;

const downloadedIds = new Set<string>();

async function downloadArtifacts(): Promise<void> {
  // Get PDF and audio artifacts only
  const { data: artifacts } = await supabase
    .from('job_artifacts')
    .select('id, storage_path, artifact_type, metadata')
    .in('artifact_type', ['pdf', 'audio_mp3', 'audio_m4a', 'audio_song'])
    .order('created_at', { ascending: true });
  
  if (!artifacts) return;
  
  for (const artifact of artifacts) {
    if (downloadedIds.has(artifact.id)) continue;
    
    const { data, error } = await supabase.storage
      .from('job-artifacts')
      .download(artifact.storage_path);
    
    if (error || !data) continue;
    
    const pathParts = artifact.storage_path.split('/');
    const filename = pathParts[pathParts.length - 1];
    const buffer = Buffer.from(await data.arrayBuffer());
    fs.writeFileSync(path.join(OUTPUT_DIR, filename), buffer);
    
    downloadedIds.add(artifact.id);
    
    const docType = artifact.metadata?.docType || '';
    const system = artifact.metadata?.system || '';
    console.log(`✅ ${filename} (${docType} ${system})`);
  }
}

async function main() {
  console.log('🎯 Watching for PDFs and audio...');
  console.log(`📂 ${OUTPUT_DIR}\n`);
  
  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  }
  
  // Initial download
  await downloadArtifacts();
  if (downloadedIds.size > 0) {
    console.log(`\nDownloaded ${downloadedIds.size} files. Watching for more...\n`);
  }
  
  // Poll for new
  setInterval(downloadArtifacts, POLL_INTERVAL);
  
  process.on('SIGINT', () => {
    console.log(`\n✅ Done. ${downloadedIds.size} files.`);
    process.exit(0);
  });
}

main().catch(console.error);
