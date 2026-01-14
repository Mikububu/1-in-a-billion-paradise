import { createSupabaseServiceClient } from './src/services/supabaseClient';
import { config } from 'dotenv';
import { join } from 'path';

config({ path: join(__dirname, '.env') });

const supabase = createSupabaseServiceClient();

if (!supabase) {
  console.error('❌ Supabase not configured');
  process.exit(1);
}

async function checkJobPipeline() {
  console.log('🔍 Checking job pipeline status...\n');

  // Get recent jobs (last 10)
  const { data: jobs, error: jobsError } = await supabase
    .from('jobs')
    .select('id, type, status, created_at, completed_at, progress, params')
    .order('created_at', { ascending: false })
    .limit(10);

  if (jobsError) {
    console.error('❌ Error fetching jobs:', jobsError);
    return;
  }

  if (!jobs || jobs.length === 0) {
    console.log('⚠️  No jobs found');
    return;
  }

  console.log(`📊 Found ${jobs.length} recent jobs:\n`);

  for (const job of jobs) {
    console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
    console.log(`Job ID: ${job.id}`);
    console.log(`Type: ${job.type}`);
    console.log(`Status: ${job.status}`);
    console.log(`Created: ${job.created_at}`);
    console.log(`Completed: ${job.completed_at || 'Not completed'}`);
    
    const progress = job.progress as any;
    if (progress) {
      console.log(`Progress: ${progress.percent || 0}% - ${progress.phase || 'unknown'}`);
      console.log(`Message: ${progress.message || 'N/A'}`);
    }

    // Get tasks for this job
    const { data: tasks, error: tasksError } = await supabase
      .from('job_tasks')
      .select('id, task_type, status, sequence, error, created_at, completed_at')
      .eq('job_id', job.id)
      .order('sequence', { ascending: true });

    if (tasksError) {
      console.log(`   ⚠️  Error fetching tasks: ${tasksError.message}`);
    } else if (tasks && tasks.length > 0) {
      const total = tasks.length;
      const complete = tasks.filter(t => t.status === 'complete').length;
      const failed = tasks.filter(t => t.status === 'failed').length;
      const pending = tasks.filter(t => t.status === 'pending').length;
      const processing = tasks.filter(t => t.status === 'processing').length;

      console.log(`\n   Tasks: ${complete}/${total} complete, ${failed} failed, ${pending} pending, ${processing} processing`);
      
      // Show task breakdown
      const taskTypes = tasks.reduce((acc: any, t: any) => {
        const type = t.task_type;
        if (!acc[type]) acc[type] = { total: 0, complete: 0, failed: 0 };
        acc[type].total++;
        if (t.status === 'complete') acc[type].complete++;
        if (t.status === 'failed') acc[type].failed++;
        return acc;
      }, {});

      for (const [type, counts] of Object.entries(taskTypes)) {
        const c = counts as any;
        console.log(`      ${type}: ${c.complete}/${c.total} complete${c.failed > 0 ? `, ${c.failed} failed` : ''}`);
      }

      // Check if job should be complete but isn't
      if (complete + failed === total && total > 0 && job.status !== 'complete' && job.status !== 'error') {
        console.log(`   ⚠️  WARNING: All tasks done but job status is "${job.status}" (should be "complete" or "error")`);
      }
    } else {
      console.log(`   ℹ️  No tasks found`);
    }

    // Get artifacts for this job
    const { data: artifacts, error: artifactsError } = await supabase
      .from('job_artifacts')
      .select('id, artifact_type, metadata, created_at')
      .eq('job_id', job.id);

    if (artifactsError) {
      console.log(`   ⚠️  Error fetching artifacts: ${artifactsError.message}`);
    } else if (artifacts && artifacts.length > 0) {
      const artifactTypes = artifacts.reduce((acc: any, a: any) => {
        const type = a.artifact_type;
        acc[type] = (acc[type] || 0) + 1;
        return acc;
      }, {});

      console.log(`\n   Artifacts: ${artifacts.length} total`);
      for (const [type, count] of Object.entries(artifactTypes)) {
        console.log(`      ${type}: ${count}`);
      }
    } else {
      console.log(`   ℹ️  No artifacts found`);
    }
  }

  console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);
}

checkJobPipeline().catch(err => {
  console.error('❌ Fatal error:', err);
  process.exit(1);
});
