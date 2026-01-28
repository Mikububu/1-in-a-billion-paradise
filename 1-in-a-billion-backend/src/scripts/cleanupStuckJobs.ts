/**
 * CLEANUP STUCK JOBS
 * 
 * Delete orphaned jobs and tasks that are stuck in processing
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as path from 'path';

// Load environment variables
dotenv.config({ path: path.join(__dirname, '../../.env') });

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function cleanup() {
  console.log('🧹 Cleaning up stuck jobs...\n');

  // Find all jobs stuck in processing for more than 10 minutes
  const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000).toISOString();
  const { data: stuckJobs, error: stuckError } = await supabase
    .from('jobs')
    .select('id, status, type, created_at')
    .eq('status', 'processing')
    .lt('created_at', tenMinutesAgo);

  if (stuckError) {
    console.error('❌ Error fetching stuck jobs:', stuckError);
    return;
  }

  if (!stuckJobs || stuckJobs.length === 0) {
    console.log('✅ No stuck jobs found!');
    return;
  }

  console.log(`⚠️  Found ${stuckJobs.length} stuck jobs:\n`);
  stuckJobs.forEach((job: any) => {
    const age = Math.round((Date.now() - new Date(job.created_at).getTime()) / 1000 / 60);
    console.log(`  - ${job.id} (${job.type}) - ${age} minutes old`);
  });

  console.log('\n🗑️  Deleting...\n');

  // Delete artifacts
  for (const job of stuckJobs) {
    const { error: artifactsError } = await supabase
      .from('job_artifacts')
      .delete()
      .eq('job_id', job.id);

    if (artifactsError) {
      console.error(`❌ Error deleting artifacts for ${job.id}:`, artifactsError);
    } else {
      console.log(`  ✅ Deleted artifacts for ${job.id}`);
    }
  }

  // Delete tasks
  for (const job of stuckJobs) {
    const { error: tasksError } = await supabase
      .from('job_tasks')
      .delete()
      .eq('job_id', job.id);

    if (tasksError) {
      console.error(`❌ Error deleting tasks for ${job.id}:`, tasksError);
    } else {
      console.log(`  ✅ Deleted tasks for ${job.id}`);
    }
  }

  // Delete jobs
  const jobIds = stuckJobs.map((job: any) => job.id);
  const { error: jobsError } = await supabase
    .from('jobs')
    .delete()
    .in('id', jobIds);

  if (jobsError) {
    console.error('❌ Error deleting jobs:', jobsError);
  } else {
    console.log(`  ✅ Deleted ${jobIds.length} jobs`);
  }

  console.log('\n✅ Cleanup complete!');
}

cleanup().catch(console.error);

