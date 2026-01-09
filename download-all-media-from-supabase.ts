#!/usr/bin/env ts-node

/**
 * DOWNLOAD ALL MEDIA FROM SUPABASE TO DESKTOP
 * 
 * This script connects to Supabase, fetches all job artifacts (PDFs, audio, songs),
 * and downloads them to your desktop in organized folders.
 * 
 * Usage:
 *   ts-node download-all-media-from-supabase.ts
 * 
 * Requirements:
 *   - Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY environment variables
 *   - Or create a .env file in the backend directory
 */

import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';
import * as https from 'https';
import * as http from 'http';
import { promisify } from 'util';

// Load environment variables
require('dotenv').config({ path: path.join(__dirname, '1-in-a-billion-backend', '.env') });

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('❌ Error: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set');
  console.error('   Set them as environment variables or in .env file');
  process.exit(1);
}

// Create Supabase client with service role (bypasses RLS)
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

// Get desktop path
const getDesktopPath = () => {
  const homeDir = process.env.HOME || process.env.USERPROFILE || '';
  if (process.platform === 'darwin') {
    return path.join(homeDir, 'Desktop');
  } else if (process.platform === 'win32') {
    return path.join(homeDir, 'Desktop');
  } else {
    return path.join(homeDir, 'Desktop');
  }
};

// Download file from URL
const downloadFile = async (url: string, filePath: string): Promise<void> => {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(filePath);
    const protocol = url.startsWith('https') ? https : http;
    
    protocol.get(url, (response) => {
      if (response.statusCode === 301 || response.statusCode === 302) {
        // Handle redirects
        return downloadFile(response.headers.location!, filePath).then(resolve).catch(reject);
      }
      
      if (response.statusCode !== 200) {
        file.close();
        fs.unlinkSync(filePath);
        reject(new Error(`Failed to download: ${response.statusCode} ${response.statusMessage}`));
        return;
      }
      
      response.pipe(file);
      file.on('finish', () => {
        file.close();
        resolve();
      });
    }).on('error', (err) => {
      file.close();
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
      reject(err);
    });
  });
};

// Get signed URL from Supabase storage
const getSignedUrl = async (bucket: string, path: string, expiresIn: number = 3600): Promise<string> => {
  const { data, error } = await supabase.storage
    .from(bucket)
    .createSignedUrl(path, expiresIn);
  
  if (error) {
    throw new Error(`Failed to create signed URL: ${error.message}`);
  }
  
  return data.signedUrl;
};

// Main function
const main = async () => {
  console.log('🚀 Starting download of all media files from Supabase...\n');

  // Create output folder on desktop
  const desktopPath = getDesktopPath();
  const outputFolder = path.join(desktopPath, `Supabase_Media_${new Date().toISOString().split('T')[0]}`);
  
  // Create subfolders
  const pdfFolder = path.join(outputFolder, 'PDFs');
  const audioFolder = path.join(outputFolder, 'Audio');
  const songsFolder = path.join(outputFolder, 'Songs');
  
  [outputFolder, pdfFolder, audioFolder, songsFolder].forEach(folder => {
    if (!fs.existsSync(folder)) {
      fs.mkdirSync(folder, { recursive: true });
    }
  });

  console.log(`📁 Output folder: ${outputFolder}\n`);

  // Fetch all job artifacts
  console.log('📥 Fetching all artifacts from Supabase...');
  const { data: artifacts, error: fetchError } = await supabase
    .from('job_artifacts')
    .select('*')
    .order('created_at', { ascending: false });

  if (fetchError) {
    console.error('❌ Error fetching artifacts:', fetchError);
    process.exit(1);
  }

  console.log(`✅ Found ${artifacts.length} artifacts\n`);

  // Group by type
  const pdfs = artifacts.filter(a => a.artifact_type === 'pdf');
  const audios = artifacts.filter(a => a.artifact_type.startsWith('audio'));
  const songs = artifacts.filter(a => a.artifact_type === 'audio_song' || (a.metadata && a.metadata.isSong));

  console.log(`📄 PDFs: ${pdfs.length}`);
  console.log(`🎵 Audio: ${audios.length}`);
  console.log(`🎶 Songs: ${songs.length}\n`);

  let downloadedCount = 0;
  let failedCount = 0;
  const errors: string[] = [];

  // Download PDFs
  console.log('📥 Downloading PDFs...');
  for (const artifact of pdfs) {
    try {
      const signedUrl = await getSignedUrl(artifact.bucket_name, artifact.storage_path);
      const fileName = path.basename(artifact.storage_path) || `pdf_${artifact.id}.pdf`;
      const filePath = path.join(pdfFolder, `${artifact.job_id}_${fileName}`);
      
      await downloadFile(signedUrl, filePath);
      downloadedCount++;
      process.stdout.write('.');
    } catch (error: any) {
      failedCount++;
      errors.push(`PDF ${artifact.id}: ${error.message}`);
      process.stdout.write('F');
    }
  }
  console.log(`\n✅ PDFs: ${downloadedCount} downloaded, ${failedCount} failed\n`);

  // Download Audio (excluding songs)
  const audioOnly = audios.filter(a => !songs.includes(a));
  downloadedCount = 0;
  failedCount = 0;
  
  console.log('📥 Downloading Audio files...');
  for (const artifact of audioOnly) {
    try {
      const signedUrl = await getSignedUrl(artifact.bucket_name, artifact.storage_path);
      const ext = artifact.artifact_type === 'audio_m4a' ? '.m4a' : '.mp3';
      const fileName = path.basename(artifact.storage_path) || `audio_${artifact.id}${ext}`;
      const filePath = path.join(audioFolder, `${artifact.job_id}_${fileName}`);
      
      await downloadFile(signedUrl, filePath);
      downloadedCount++;
      process.stdout.write('.');
    } catch (error: any) {
      failedCount++;
      errors.push(`Audio ${artifact.id}: ${error.message}`);
      process.stdout.write('F');
    }
  }
  console.log(`\n✅ Audio: ${downloadedCount} downloaded, ${failedCount} failed\n`);

  // Download Songs
  downloadedCount = 0;
  failedCount = 0;
  
  console.log('📥 Downloading Songs...');
  for (const artifact of songs) {
    try {
      const signedUrl = await getSignedUrl(artifact.bucket_name, artifact.storage_path);
      const ext = artifact.artifact_type === 'audio_m4a' ? '.m4a' : '.mp3';
      const fileName = path.basename(artifact.storage_path) || `song_${artifact.id}${ext}`;
      const filePath = path.join(songsFolder, `${artifact.job_id}_${fileName}`);
      
      await downloadFile(signedUrl, filePath);
      downloadedCount++;
      process.stdout.write('.');
    } catch (error: any) {
      failedCount++;
      errors.push(`Song ${artifact.id}: ${error.message}`);
      process.stdout.write('F');
    }
  }
  console.log(`\n✅ Songs: ${downloadedCount} downloaded, ${failedCount} failed\n`);

  // Create summary file
  const summary = `Supabase Media Download Summary

Date: ${new Date().toLocaleString()}
Total Artifacts: ${artifacts.length}

PDFs: ${pdfs.length} (downloaded: ${pdfs.length - errors.filter(e => e.startsWith('PDF')).length})
Audio: ${audioOnly.length} (downloaded: ${audioOnly.length - errors.filter(e => e.startsWith('Audio')).length})
Songs: ${songs.length} (downloaded: ${songs.length - errors.filter(e => e.startsWith('Song')).length})

Failed Downloads: ${errors.length}
${errors.length > 0 ? '\nErrors:\n' + errors.join('\n') : 'All files downloaded successfully!'}

Files saved to: ${outputFolder}
`;

  fs.writeFileSync(path.join(outputFolder, 'Download_Summary.txt'), summary);

  console.log('✅ Download complete!');
  console.log(`📁 Files saved to: ${outputFolder}`);
  console.log(`📊 Summary: ${artifacts.length} artifacts processed`);
  if (errors.length > 0) {
    console.log(`⚠️  ${errors.length} files failed to download. Check Download_Summary.txt for details.`);
  }
};

// Run
main().catch((error) => {
  console.error('❌ Fatal error:', error);
  process.exit(1);
});
