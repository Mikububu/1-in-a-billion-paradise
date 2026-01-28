/**
 * Monitor ALL jobs in the pipeline
 * Logs job status, tasks, and artifacts in real-time
 */

import { createSupabaseServiceClient } from './src/services/supabaseClient';
import { config } from 'dotenv';
import { join } from 'path';

config({ path: join(__dirname, '.env') });

interface JobInfo {
  id: string;
  status: string;
  type: string;
  user_id: string;
  params: any;
  progress: any;
  created_at: string;
  updated_at: string;
  completed_at?: string;
  error?: string;
}

interface TaskInfo {
  id: string;
  task_type: string;
  status: string;
  sequence: number;
  error?: string;
}

interface ArtifactInfo {
  id: string;
  artifact_type: string;
  metadata: any;
  storage_path?: string;
}

async function monitorAllJobs() {
  const supabase = createSupabaseServiceClient();

  if (!supabase) {
    console.error('❌ Supabase not configured');
    process.exit(1);
  }

  console.log('🔍 Monitoring ALL jobs in the pipeline...\n');
  console.log('Press Ctrl+C to stop\n');
  console.log('═'.repeat(80));

  const seenJobIds = new Set<string>();
  let iteration = 0;

  const pollInterval = setInterval(async () => {
    iteration++;
    const timestamp = new Date().toLocaleTimeString();

    try {
      // Get all active jobs (not complete, not error, not cancelled)
      const { data: activeJobs, error: jobsError } = await supabase
        .from('jobs')
        .select('*')
        .in('status', ['queued', 'processing'])
        .order('created_at', { ascending: false })
        .limit(20);

      if (jobsError) {
        console.error(`❌ Error fetching jobs: ${jobsError.message}`);
        return;
      }

      // Also get recently completed jobs (last 5)
      const { data: recentCompleted, error: completedError } = await supabase
        .from('jobs')
        .select('*')
        .eq('status', 'complete')
        .order('completed_at', { ascending: false })
        .limit(5);

      const allJobs = [
        ...(activeJobs || []),
        ...(recentCompleted || []),
      ];

      if (allJobs.length === 0) {
        if (iteration % 6 === 0) { // Log every 30 seconds if no jobs
          console.log(`[${timestamp}] ⏳ No active jobs in pipeline`);
        }
        return;
      }

      // Process each job
      for (const job of allJobs as JobInfo[]) {
        const isNew = !seenJobIds.has(job.id);
        if (isNew) {
          seenJobIds.add(job.id);
          console.log('\n' + '═'.repeat(80));
          console.log(`🆕 NEW JOB DETECTED: ${job.id.slice(0, 8)}`);
        }

        const person1Name = job.params?.person1?.name || 'Unknown';
        const person2Name = job.params?.person2?.name;
        const jobName = person2Name 
          ? `${person1Name} & ${person2Name}`
          : person1Name;
        const systems = job.params?.systems || [];
        const systemList = Array.isArray(systems) ? systems.join(', ') : 'Unknown';

        // Job status header
        const statusEmoji = {
          'queued': '⏳',
          'processing': '🔄',
          'complete': '✅',
          'error': '❌',
        }[job.status] || '❓';

        if (isNew || iteration % 3 === 0) { // Log every 15 seconds for existing jobs
          console.log(`\n[${timestamp}] ${statusEmoji} Job: ${jobName}`);
          console.log(`   ID: ${job.id.slice(0, 8)}... | Type: ${job.type} | Status: ${job.status}`);
          console.log(`   Systems: ${systemList}`);
          
          if (job.progress) {
            const progress = job.progress;
            if (progress.percent !== undefined) {
              console.log(`   Progress: ${progress.percent}% | Phase: ${progress.phase || 'N/A'}`);
            }
            if (progress.systemsCompleted !== undefined) {
              console.log(`   Systems: ${progress.systemsCompleted}/${progress.totalSystems} complete`);
            }
            if (progress.docsComplete !== undefined) {
              console.log(`   Documents: ${progress.docsComplete}/${progress.docsTotal} complete`);
            }
            if (progress.message) {
              console.log(`   Message: ${progress.message}`);
            }
          }

          if (job.error) {
            console.log(`   ❌ ERROR: ${job.error}`);
          }
        }

        // Get tasks for this job
        const { data: tasks } = await supabase
          .from('job_tasks')
          .select('*')
          .eq('job_id', job.id)
          .order('sequence', { ascending: true });

        if (tasks && tasks.length > 0) {
          const taskSummary: Record<string, { total: number; complete: number; failed: number; pending: number }> = {};

          for (const task of tasks as TaskInfo[]) {
            if (!taskSummary[task.task_type]) {
              taskSummary[task.task_type] = { total: 0, complete: 0, failed: 0, pending: 0 };
            }
            taskSummary[task.task_type].total++;
            if (task.status === 'complete') taskSummary[task.task_type].complete++;
            else if (task.status === 'failed') taskSummary[task.task_type].failed++;
            else taskSummary[task.task_type].pending++;

            // Alert on failed tasks immediately
            if (task.status === 'failed' && task.error) {
              console.log(`\n   🚨 FAILED TASK: ${task.task_type} (seq ${task.sequence})`);
              console.log(`      Error: ${task.error}`);
            }
          }

          // Show task summary
          if (isNew || iteration % 3 === 0) {
            const taskLines = Object.entries(taskSummary).map(([type, stats]) => {
              const status = stats.failed > 0 
                ? `❌ ${stats.complete}/${stats.total} (${stats.failed} failed)`
                : stats.complete === stats.total
                ? `✅ ${stats.complete}/${stats.total}`
                : `🔄 ${stats.complete}/${stats.total} (${stats.pending} pending)`;
              return `      ${type}: ${status}`;
            });
            if (taskLines.length > 0) {
              console.log(`   Tasks:`);
              taskLines.forEach(line => console.log(line));
            }
          }
        }

        // Get artifacts for this job
        if (job.status === 'complete' || job.status === 'finalizing') {
          const { data: artifacts } = await supabase
            .from('job_artifacts')
            .select('*')
            .eq('job_id', job.id);

          if (artifacts && artifacts.length > 0) {
            const artifactSummary: Record<string, number> = {};
            for (const artifact of artifacts as ArtifactInfo[]) {
              artifactSummary[artifact.artifact_type] = (artifactSummary[artifact.artifact_type] || 0) + 1;
            }

            if (isNew || iteration % 6 === 0) { // Log artifacts less frequently
              const artifactLines = Object.entries(artifactSummary)
                .map(([type, count]) => `      ${type}: ${count}`)
                .join('\n');
              if (artifactLines) {
                console.log(`   Artifacts:`);
                console.log(artifactLines);
              }
            }
          }
        }

        // Show completion time if done
        if (job.status === 'complete' && job.completed_at) {
          const created = new Date(job.created_at);
          const completed = new Date(job.completed_at);
          const duration = Math.round((completed.getTime() - created.getTime()) / 1000 / 60);
          if (isNew) {
            console.log(`   ⏱️  Completed in ${duration} minutes`);
          }
        }
      }

      // Summary every 10 iterations (50 seconds)
      if (iteration % 10 === 0) {
        const activeCount = (activeJobs || []).length;
        const completedCount = (recentCompleted || []).length;
        console.log(`\n📊 Summary: ${activeCount} active, ${completedCount} recently completed`);
      }

    } catch (err: any) {
      console.error(`❌ Error in monitoring loop: ${err.message}`);
    }
  }, 5000); // Poll every 5 seconds

  // Handle graceful shutdown
  process.on('SIGINT', () => {
    console.log('\n\n🛑 Stopping job monitor...');
    clearInterval(pollInterval);
    process.exit(0);
  });
}

monitorAllJobs().catch(console.error);
