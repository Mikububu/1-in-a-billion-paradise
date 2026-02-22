/**
 * DIAGNOSE STUCK JOBS
 * 
 * Check for orphaned jobs and tasks in the database
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

async function diagnose() {
  console.log('🔍 Diagnosing stuck jobs...\n');

  // Check all jobs
  const { data: jobs, error: jobsError } = await supabase
    .from('jobs')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(20);

  if (jobsError) {
    console.error('❌ Error fetching jobs:', jobsError);
    return;
  }

  console.log(`📊 Found ${jobs?.length || 0} recent jobs:\n`);
  
  jobs?.forEach((job: any) => {
    const age = Math.round((Date.now() - new Date(job.created_at).getTime()) / 1000 / 60);
    console.log(`Job ${job.id.substring(0, 8)}:`);
    console.log(`  Status: ${job.status}`);
    console.log(`  Type: ${job.type}`);
    console.log(`  User: ${job.user_id}`);
    console.log(`  Age: ${age} minutes`);
    console.log(`  Created: ${job.created_at}`);
    console.log();
  });

  // Check tasks for stuck jobs
  const stuckJobIds = ['675eef1d-22db-47f2-8ab3-0ea5488b48fe', 'c74dbf34-865a-443c-b327-7bebc7a440de'];
  
  console.log('\n🔍 Checking specific stuck jobs...\n');
  
  for (const jobId of stuckJobIds) {
    const { data: tasks, error: tasksError } = await supabase
      .from('job_tasks')
      .select('*')
      .eq('job_id', jobId);

    if (tasksError) {
      console.error(`❌ Error fetching tasks for ${jobId}:`, tasksError);
      continue;
    }

    console.log(`\n📋 Job ${jobId.substring(0, 8)}:`);
    console.log(`  Tasks: ${tasks?.length || 0}`);
    
    if (tasks && tasks.length > 0) {
      tasks.forEach((task: any) => {
        console.log(`    - ${task.task_type}: ${task.status}`);
        if (task.error) {
          console.log(`      Error: ${task.error}`);
        }
      });
    }

    // Check artifacts
    const { data: artifacts, error: artifactsError } = await supabase
      .from('job_artifacts')
      .select('*')
      .eq('job_id', jobId);

    console.log(`  Artifacts: ${artifacts?.length || 0}`);
    if (artifacts && artifacts.length > 0) {
      artifacts.forEach((artifact: any) => {
        console.log(`    - ${artifact.artifact_type}`);
      });
    }
  }

  // Check for all processing jobs older than 10 minutes
  const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000).toISOString();
  const { data: stuckJobs, error: stuckError } = await supabase
    .from('jobs')
    .select('id, status, type, created_at, user_id')
    .eq('status', 'processing')
    .lt('created_at', tenMinutesAgo);

  if (stuckJobs && stuckJobs.length > 0) {
    console.log(`\n\n⚠️  Found ${stuckJobs.length} jobs stuck in "processing" for >10 minutes:\n`);
    stuckJobs.forEach((job: any) => {
      const age = Math.round((Date.now() - new Date(job.created_at).getTime()) / 1000 / 60);
      console.log(`  - ${job.id.substring(0, 8)} (${job.type}) - ${age} minutes old`);
    });
  }

  console.log('\n\n✅ Diagnosis complete');
}

diagnose().catch(console.error);

