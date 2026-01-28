/**
 * Monitor a specific job's progress
 */

import { createSupabaseServiceClient } from './src/services/supabaseClient';
import { config } from 'dotenv';
import { join } from 'path';

config({ path: join(__dirname, '.env') });

const JOB_ID = 'a1d0f9b8-7a74-493b-85be-0e94d4188b13';
const CHECK_INTERVAL = 30000; // 30 seconds
const MAX_CHECKS = 10; // 5 minutes total

async function checkJob() {
  const supabase = createSupabaseServiceClient();
  
  if (!supabase) {
    console.error('❌ Supabase not configured');
    process.exit(1);
  }

  const startTime = Date.now();
  let checkCount = 0;

  const monitor = async () => {
    checkCount++;
    const now = new Date();
    const elapsed = Math.floor((Date.now() - startTime) / 1000);

    console.log(`\n[${now.toLocaleTimeString()}] Check #${checkCount} (${elapsed}s elapsed)`);
    console.log('─'.repeat(50));

    const { data: job, error } = await supabase
      .from('jobs')
      .select('id, status, progress, updated_at, params, created_at')
      .eq('id', JOB_ID)
      .single();

    if (error) {
      console.error('❌ Error:', error.message);
      return;
    }

    if (!job) {
      console.log('❌ Job not found');
      return;
    }

    const age = Math.floor((Date.now() - new Date(job.updated_at).getTime()) / 1000);
    const totalAge = Math.floor((Date.now() - new Date(job.created_at).getTime()) / 1000);

    console.log(`📦 Job: ${job.id.substring(0, 8)}...`);
    console.log(`   Status: ${job.status}`);
    console.log(`   Last updated: ${age}s ago`);
    console.log(`   Total age: ${totalAge}s (${Math.floor(totalAge / 60)}m ${totalAge % 60}s)`);

    if (job.params?.person1?.name) {
      console.log(`   Person: ${job.params.person1.name}`);
    }
    if (job.params?.systems) {
      console.log(`   Systems: ${job.params.systems.join(', ')}`);
    }

    if (job.progress) {
      console.log(`   Progress: ${job.progress.percent || 0}%`);
      console.log(`   Phase: ${job.progress.phase || 'unknown'}`);
      console.log(`   Message: ${job.progress.message || 'N/A'}`);
      if (job.progress.systemsCompleted !== undefined) {
        console.log(`   Systems: ${job.progress.systemsCompleted}/${job.progress.totalSystems}`);
      }
    }

    // Get tasks
    const { data: tasks } = await supabase
      .from('job_tasks')
      .select('task_type, status, updated_at, error')
      .eq('job_id', JOB_ID)
      .order('sequence', { ascending: true });

    if (tasks && tasks.length > 0) {
      console.log(`\n   Tasks (${tasks.length}):`);
      tasks.forEach((task: any) => {
        const taskAge = Math.floor((Date.now() - new Date(task.updated_at).getTime()) / 1000);
        const statusIcon = task.status === 'complete' ? '✅' : task.status === 'processing' ? '⏳' : task.status === 'failed' ? '❌' : '⏸️';
        console.log(`     ${statusIcon} ${task.task_type}: ${task.status} (${taskAge}s ago)`);
        if (task.error) {
          console.log(`        Error: ${task.error.substring(0, 100)}`);
        }
      });
    }

    if (job.status === 'completed') {
      console.log('\n✅ JOB COMPLETED!');
      process.exit(0);
    }

    if (job.status === 'failed') {
      console.log('\n❌ JOB FAILED!');
      process.exit(1);
    }

    if (checkCount >= MAX_CHECKS) {
      console.log(`\n⏰ Monitoring complete (${MAX_CHECKS} checks, ${Math.floor(elapsed / 60)}m ${elapsed % 60}s)`);
      process.exit(0);
    }

    // Wait before next check
    setTimeout(monitor, CHECK_INTERVAL);
  };

  monitor();
}

checkJob().catch(err => {
  console.error('❌ Fatal error:', err);
  process.exit(1);
});
