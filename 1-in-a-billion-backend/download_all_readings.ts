import 'dotenv/config';
import { createSupabaseServiceClient } from './src/services/supabaseClient';
import * as fs from 'fs';
import * as path from 'path';
import * as https from 'https';

const OUTPUT_DIR = '/Users/michaelperinwogenburg/Desktop/Reading downloads';

async function downloadFile(url: string, outputPath: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(outputPath);
    https.get(url, (response) => {
      response.pipe(file);
      file.on('finish', () => {
        file.close();
        resolve();
      });
    }).on('error', (err) => {
      fs.unlink(outputPath, () => {});
      reject(err);
    });
  });
}

async function main() {
  const supabase = createSupabaseServiceClient();
  if (!supabase) {
    throw new Error('Supabase not configured');
  }

  // Create output directory
  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  }

  console.log(`📥 Downloading all readings to: ${OUTPUT_DIR}\n`);

  // Get all jobs with their artifacts
  const { data: jobs, error } = await supabase
    .from('jobs')
    .select(`*, artifacts:job_artifacts(*)`)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('❌ Query failed:', error);
    return;
  }

  if (!jobs || jobs.length === 0) {
    console.log('No jobs found');
    return;
  }

  console.log(`Found ${jobs.length} jobs\n`);

  let downloadedCount = 0;
  let skippedCount = 0;
  let failedCount = 0;

  for (const job of jobs) {
    const artifacts = (job as any).artifacts || [];
    
    console.log(`Job ${job.id}: ${artifacts.length} artifacts`);
    
    if (artifacts.length === 0) {
      continue;
    }

    // Parse params to get person names
    let params: any = {};
    try {
      params = typeof job.params === 'string' ? JSON.parse(job.params) : job.params;
    } catch {}

    const personAName = params.personA?.name || 'Unknown';
    const personBName = params.personB?.name || 'Unknown';
    const jobDate = new Date(job.created_at).toISOString().split('T')[0];

    for (const artifact of artifacts) {
      // Use public_url if available, otherwise use storage_path
      const publicUrl = artifact.public_url;
      const storagePath = artifact.storage_path;
      
      if (!publicUrl && !storagePath) {
        console.log(`   Skipping artifact (no URL or path)`);
        continue;
      }

      const artifactType = artifact.artifact_type || 'unknown';
      const bucketName = artifact.bucket_name || 'readings';
      
      // Determine extension from artifact type or content type
      const contentType = artifact.content_type || '';
      const ext = artifactType.includes('pdf') || contentType.includes('pdf') ? '.pdf' : 
                   artifactType.includes('audio') || contentType.includes('audio') ? '.mp3' :
                   artifactType.includes('text') || contentType.includes('text') ? '.txt' : '';
      
      const filename = `${jobDate}_${personAName}_${personBName}_${artifactType}${ext}`
        .replace(/[^a-zA-Z0-9_\-\.]/g, '_');
      
      const outputPath = path.join(OUTPUT_DIR, filename);

      // Skip if already exists
      if (fs.existsSync(outputPath)) {
        skippedCount++;
        continue;
      }

      try {
        let downloadUrl = publicUrl;
        
        // If no public URL, create signed URL from storage path
        if (!downloadUrl && storagePath) {
          const { data: urlData } = await supabase.storage
            .from(bucketName)
            .createSignedUrl(storagePath, 3600);

          if (urlData?.signedUrl) {
            downloadUrl = urlData.signedUrl;
          }
        }

        if (!downloadUrl) {
          console.log(`   ❌ ${filename}: No download URL available`);
          failedCount++;
          continue;
        }

        console.log(`📥 ${filename}...`);
        await downloadFile(downloadUrl, outputPath);
        
        const sizeKB = artifact.file_size_bytes ? (artifact.file_size_bytes / 1024).toFixed(1) : '?';
        console.log(`   ✅ Saved (${sizeKB} KB)`);
        downloadedCount++;
      } catch (err: any) {
        console.log(`   ❌ ${filename}: ${err.message}`);
        failedCount++;
      }
    }
  }

  console.log(`\n📊 Summary:`);
  console.log(`   ✅ Downloaded: ${downloadedCount}`);
  console.log(`   ⏭️  Skipped (already exist): ${skippedCount}`);
  console.log(`   ❌ Failed: ${failedCount}`);
  console.log(`\n📁 Files saved to: ${OUTPUT_DIR}`);
}

main().catch(console.error);
