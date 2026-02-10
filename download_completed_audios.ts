import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as path from 'path';
import * as fs from 'fs';
import axios from 'axios';

dotenv.config({ path: path.join(__dirname, '.env') });

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const DESKTOP_PATH = '/Users/michaelperinwogenburg/Desktop';
const OUTPUT_FOLDER = path.join(DESKTOP_PATH, 'rendered_audios');

async function waitForJobsToComplete() {
  console.log('🔍 Monitoring job completion...\n');
  
  let allComplete = false;
  let checkCount = 0;
  
  while (!allComplete) {
    checkCount++;
    
    // Check processing jobs
    const { data: processingJobs, error } = await supabase
      .from('jobs')
      .select('id, status, type, created_at, params, progress')
      .eq('status', 'processing')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('❌ Error checking jobs:', error);
      await sleep(10000);
      continue;
    }

    if (!processingJobs || processingJobs.length === 0) {
      console.log('✅ All jobs complete!\n');
      allComplete = true;
      break;
    }

    console.log(`Check #${checkCount} - ${new Date().toLocaleTimeString()}`);
    console.log(`⏳ ${processingJobs.length} job${processingJobs.length > 1 ? 's' : ''} still processing:\n`);
    
    for (const job of processingJobs) {
      const firstName = job.params?.basicInfo?.firstName || job.params?.firstName || 'Unknown';
      const phase = job.progress?.phase || 'unknown';
      const percent = job.progress?.percent || 0;
      const elapsed = Math.floor((Date.now() - new Date(job.created_at).getTime()) / 1000 / 60);
      
      console.log(`   ${firstName} - ${job.type} - ${phase} (${percent}%) - ${elapsed}m elapsed`);
    }
    
    console.log('\n💤 Waiting 5 minutes before next check...\n');
    await sleep(300000);
  }
}

async function downloadAllAudios() {
  console.log('📥 Starting audio download...\n');
  
  // Create output folder
  if (!fs.existsSync(OUTPUT_FOLDER)) {
    fs.mkdirSync(OUTPUT_FOLDER, { recursive: true });
  }
  
  // Get all completed jobs from today
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  
  const { data: completedJobs, error: jobsError } = await supabase
    .from('jobs')
    .select('id, type, params, completed_at')
    .eq('status', 'complete')
    .gte('created_at', todayStart.toISOString())
    .order('completed_at', { ascending: false });

  if (jobsError) {
    console.error('❌ Error fetching completed jobs:', jobsError);
    return;
  }

  if (!completedJobs || completedJobs.length === 0) {
    console.log('No completed jobs found from today.');
    return;
  }

  console.log(`Found ${completedJobs.length} completed job${completedJobs.length > 1 ? 's' : ''} from today\n`);

  // Get all audio artifacts for these jobs
  const jobIds = completedJobs.map(j => j.id);
  const { data: artifacts, error: artifactsError } = await supabase
    .from('job_artifacts')
    .select('id, job_id, artifact_type, storage_path, public_url, metadata')
    .in('job_id', jobIds)
    .in('artifact_type', ['audio_mp3', 'audio_m4a']);

  if (artifactsError) {
    console.error('❌ Error fetching artifacts:', artifactsError);
    return;
  }

  if (!artifacts || artifacts.length === 0) {
    console.log('No audio artifacts found.');
    return;
  }

  console.log(`Found ${artifacts.length} audio file${artifacts.length > 1 ? 's' : ''} to download\n`);
  console.log('='.repeat(80));

  let downloaded = 0;
  let failed = 0;

  for (const artifact of artifacts) {
    const job = completedJobs.find(j => j.id === artifact.job_id);
    if (!job) continue;

    const firstName = job.params?.basicInfo?.firstName || job.params?.firstName || 'Unknown';
    const system = artifact.metadata?.system || 'unknown';
    const ext = artifact.artifact_type === 'audio_mp3' ? 'mp3' : 'm4a';
    
    // Create filename: FirstName_JobType_System.ext
    const filename = `${firstName}_${job.type}_${system}.${ext}`.replace(/[^a-zA-Z0-9_.-]/g, '_');
    const filepath = path.join(OUTPUT_FOLDER, filename);

    try {
      console.log(`📥 Downloading: ${filename}`);
      
      if (!artifact.public_url) {
        console.log(`   ⚠️  No public URL for ${filename}`);
        failed++;
        continue;
      }

      // Download the file
      const response = await axios({
        method: 'get',
        url: artifact.public_url,
        responseType: 'stream'
      });

      const writer = fs.createWriteStream(filepath);
      response.data.pipe(writer);

      await new Promise((resolve, reject) => {
        writer.on('finish', resolve);
        writer.on('error', reject);
      });

      const stats = fs.statSync(filepath);
      const sizeMB = (stats.size / (1024 * 1024)).toFixed(2);
      
      console.log(`   ✅ Saved: ${filename} (${sizeMB} MB)\n`);
      downloaded++;
    } catch (error: any) {
      console.error(`   ❌ Failed to download ${filename}:`, error.message);
      failed++;
    }
  }

  console.log('='.repeat(80));
  console.log(`\n📊 Download Summary:`);
  console.log(`   ✅ Successfully downloaded: ${downloaded}`);
  if (failed > 0) {
    console.log(`   ❌ Failed: ${failed}`);
  }
  console.log(`\n💾 Files saved to: ${OUTPUT_FOLDER}`);
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function main() {
  console.log('🎵 Audio Download Manager');
  console.log('='.repeat(80));
  console.log('\n');
  
  // Wait for all jobs to complete
  await waitForJobsToComplete();
  
  // Download all audios
  await downloadAllAudios();
  
  console.log('\n✨ All done!');
}

main();
