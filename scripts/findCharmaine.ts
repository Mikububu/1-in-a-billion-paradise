/**
 * Find charmaine audio file in Supabase
 */
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as path from 'path';
import * as fs from 'fs';

dotenv.config({ path: path.join(__dirname, '..', '.env') });

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function main() {
  console.log('🔍 Searching for charmaine audio file...\n');

  // Search in job_artifacts table
  const { data: artifacts, error } = await supabase
    .from('job_artifacts')
    .select('id, job_id, artifact_type, storage_path, bucket_name, created_at')
    .or('storage_path.ilike.%charmaine%,storage_path.ilike.%western_astrology_doc1%')
    .limit(20);

  if (error) {
    console.error('Error:', error.message);
    return;
  }

  if (!artifacts || artifacts.length === 0) {
    console.log('❌ No artifacts found with "charmaine" or "western_astrology_doc1" in path');
    
    // Try broader search - recent audio artifacts
    console.log('\n📋 Listing recent audio artifacts instead...\n');
    const { data: recent, error: recentError } = await supabase
      .from('job_artifacts')
      .select('id, job_id, artifact_type, storage_path, bucket_name, created_at')
      .eq('artifact_type', 'audio_m4a')
      .order('created_at', { ascending: false })
      .limit(10);
    
    if (recent && recent.length > 0) {
      console.log('Recent audio artifacts:');
      for (const a of recent) {
        console.log(`  📁 ${a.storage_path}`);
        console.log(`     Bucket: ${a.bucket_name}, Job: ${a.job_id}`);
        console.log(`     Created: ${a.created_at}\n`);
      }
    }
    return;
  }

  console.log(`✅ Found ${artifacts.length} matching artifacts:\n`);
  
  for (const artifact of artifacts) {
    console.log(`📁 ${artifact.storage_path}`);
    console.log(`   Bucket: ${artifact.bucket_name}`);
    console.log(`   Type: ${artifact.artifact_type}`);
    console.log(`   Job ID: ${artifact.job_id}`);
    console.log(`   Created: ${artifact.created_at}`);
    
    // Generate signed URL
    if (artifact.storage_path && artifact.bucket_name) {
      const { data: urlData } = await supabase.storage
        .from(artifact.bucket_name)
        .createSignedUrl(artifact.storage_path, 3600);
      
      if (urlData?.signedUrl) {
        console.log(`   🔗 Signed URL: ${urlData.signedUrl.substring(0, 100)}...`);
      }
    }
    console.log('');
  }

  // If we found audio, offer to download
  const audioArtifact = artifacts.find(a => a.artifact_type?.includes('audio'));
  if (audioArtifact && audioArtifact.storage_path && audioArtifact.bucket_name) {
    console.log('\n📥 Downloading to Desktop...');
    
    const { data: fileData, error: downloadError } = await supabase.storage
      .from(audioArtifact.bucket_name)
      .download(audioArtifact.storage_path);
    
    if (downloadError) {
      console.error('Download error:', downloadError.message);
      return;
    }
    
    if (fileData) {
      const buffer = Buffer.from(await fileData.arrayBuffer());
      const filename = path.basename(audioArtifact.storage_path);
      const desktopPath = path.join(process.env.HOME || '', 'Desktop', filename);
      fs.writeFileSync(desktopPath, buffer);
      console.log(`✅ Saved to: ${desktopPath}`);
      console.log(`   Size: ${(buffer.length / 1024 / 1024).toFixed(2)} MB`);
    }
  }
}

main().catch(console.error);
