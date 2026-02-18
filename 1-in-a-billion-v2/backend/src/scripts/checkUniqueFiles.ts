/**
 * CHECK UNIQUE FILES
 */

import { createSupabaseServiceClient } from '../services/supabaseClient';
import { config } from 'dotenv';
import { join } from 'path';
import fs from 'fs';
import path from 'path';

config({ path: join(__dirname, '../../.env') });

const PROJECT_ROOT = path.resolve(__dirname, '../../..');
const OUTPUT_DIR = process.env.MEDIA_OUT_DIR || path.join(PROJECT_ROOT, 'runtime', 'media');

async function checkUniqueFiles() {
  const supabase = createSupabaseServiceClient();

  if (!supabase) {
    console.error('❌ Supabase not configured');
    process.exit(1);
  }

  try {
    const { data } = await supabase
      .from('job_artifacts')
      .select('storage_path, artifact_type')
      .in('artifact_type', ['pdf', 'audio_mp3', 'audio_song'])
      .not('storage_path', 'is', null);
    
    const allNames = (data || []).map((a: any) => String(a.storage_path.split('/').pop() || ''));
    const unique: string[] = Array.from(new Set<string>(allNames));
    console.log('📊 DATABASE:');
    console.log(`   Total entries: ${data?.length || 0}`);
    console.log(`   Unique filenames: ${unique.length}`);
    console.log(`   Duplicate entries: ${(data?.length || 0) - unique.length}\n`);
    
    const byType: Record<string, Set<string>> = {};
    (data || []).forEach((a: any) => {
      const type = String(a.artifact_type || '');
      const name = String(a.storage_path.split('/').pop() || '');
      if (!byType[type]) byType[type] = new Set();
      byType[type].add(name);
    });
    
    console.log('Unique files by type:');
    Object.entries(byType).forEach(([type, set]) => {
      console.log(`   ${type}: ${set.size} unique files`);
    });
    
    const baseDir = path.join(OUTPUT_DIR, 'e34061de-755c-4b5e-9b0d-a6c7aa8bddc2');
    const onDisk = new Set<string>();
    
    ['pdf', 'audio_mp3', 'audio_song'].forEach(type => {
      const typeDir = path.join(baseDir, type);
      try {
        fs.readdirSync(typeDir).forEach(f => onDisk.add(f));
      } catch {}
    });
    
    console.log(`\n📁 ON DISK:`);
    console.log(`   Unique files: ${onDisk.size}\n`);
    
    const missing: string[] = unique.filter((f: string) => !onDisk.has(f));
    console.log(`❌ MISSING: ${missing.length} unique files\n`);
    
    if (missing.length > 0) {
      console.log('Missing files:');
      missing.forEach((f: string) => console.log(`   - ${f}`));
    } else {
      console.log('✅ All unique files are downloaded!');
    }
    
    process.exit(0);
  } catch (error: any) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

checkUniqueFiles();
