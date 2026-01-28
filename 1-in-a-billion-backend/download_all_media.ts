import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';
import https from 'https';
import http from 'http';

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const DEST_FOLDER = '/Users/michaelperinwogenburg/Desktop/Akasha and Anand';

async function downloadFile(url: string, destPath: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const protocol = url.startsWith('https') ? https : http;
    const file = fs.createWriteStream(destPath);
    
    protocol.get(url, (response) => {
      if (response.statusCode !== 200) {
        reject(new Error(`Failed to download: ${response.statusCode}`));
        return;
      }
      
      response.pipe(file);
      file.on('finish', () => {
        file.close();
        resolve();
      });
    }).on('error', (err) => {
      fs.unlinkSync(destPath);
      reject(err);
    });
  });
}

async function downloadAllMedia() {
  const jobId = 'fd3af2d1-d93a-48d3-a918-685db893dd7a';
  
  console.log('📦 Downloading all media for Akasha and Anand...\n');
  console.log(`   Destination: ${DEST_FOLDER}\n`);
  
  // Get all artifacts
  const { data: artifacts } = await supabase
    .from('job_artifacts')
    .select('artifact_type, storage_path, bucket_name, metadata')
    .eq('job_id', jobId);
  
  if (!artifacts || artifacts.length === 0) {
    console.log('❌ No artifacts found!');
    return;
  }
  
  const pdfs = artifacts.filter(a => a.artifact_type === 'pdf');
  const audio = artifacts.filter(a => a.artifact_type === 'audio');
  const songs = artifacts.filter(a => a.artifact_type === 'audio_song');
  
  console.log(`Found:`);
  console.log(`  📄 ${pdfs.length} PDFs`);
  console.log(`  🎙️ ${audio.length} Audio files`);
  console.log(`  🎵 ${songs.length} Songs\n`);
  
  // Create subfolders
  fs.mkdirSync(path.join(DEST_FOLDER, 'PDFs'), { recursive: true });
  fs.mkdirSync(path.join(DEST_FOLDER, 'Audio'), { recursive: true });
  fs.mkdirSync(path.join(DEST_FOLDER, 'Songs'), { recursive: true });
  
  // Download PDFs
  console.log('📄 Downloading PDFs...');
  for (const pdf of pdfs) {
    const { data } = supabase.storage
      .from(pdf.bucket_name)
      .getPublicUrl(pdf.storage_path);
    
    const meta = pdf.metadata || {};
    const fileName = `${String(meta.docNum).padStart(2, '0')}_${meta.system}_${meta.docType}.pdf`;
    const destPath = path.join(DEST_FOLDER, 'PDFs', fileName);
    
    try {
      await downloadFile(data.publicUrl, destPath);
      console.log(`   ✅ ${fileName}`);
    } catch (err: any) {
      console.log(`   ❌ ${fileName}: ${err.message}`);
    }
  }
  
  // Download Songs
  console.log('\n🎵 Downloading Songs...');
  for (const song of songs) {
    const { data } = supabase.storage
      .from(song.bucket_name)
      .getPublicUrl(song.storage_path);
    
    const meta = song.metadata || {};
    const fileName = `${String(meta.docNum).padStart(2, '0')}_${meta.system}_${meta.songTitle || 'song'}.mp3`;
    const destPath = path.join(DEST_FOLDER, 'Songs', fileName);
    
    try {
      await downloadFile(data.publicUrl, destPath);
      console.log(`   ✅ ${fileName}`);
    } catch (err: any) {
      console.log(`   ❌ ${fileName}: ${err.message}`);
    }
  }
  
  // Download Audio (if any)
  if (audio.length > 0) {
    console.log('\n🎙️ Downloading Audio files...');
    for (const aud of audio) {
      const { data } = supabase.storage
        .from(aud.bucket_name)
        .getPublicUrl(aud.storage_path);
      
      const meta = aud.metadata || {};
      const fileName = `${String(meta.docNum).padStart(2, '0')}_${meta.system}_audio.mp3`;
      const destPath = path.join(DEST_FOLDER, 'Audio', fileName);
      
      try {
        await downloadFile(data.publicUrl, destPath);
        console.log(`   ✅ ${fileName}`);
      } catch (err: any) {
        console.log(`   ❌ ${fileName}: ${err.message}`);
      }
    }
  }
  
  console.log(`\n✨ Download complete! Check folder: ${DEST_FOLDER}`);
  console.log(`\n📊 Summary:`);
  console.log(`   PDFs: ${fs.readdirSync(path.join(DEST_FOLDER, 'PDFs')).length}`);
  console.log(`   Songs: ${fs.readdirSync(path.join(DEST_FOLDER, 'Songs')).length}`);
  if (audio.length > 0) {
    console.log(`   Audio: ${fs.readdirSync(path.join(DEST_FOLDER, 'Audio')).length}`);
  }
}

downloadAllMedia().catch(console.error);
