/**
 * Monitor and log Nuclear reading job for Fabrice and Eva
 * This will track the job from creation through completion
 */

import { createSupabaseServiceClient } from './src/services/supabaseClient';
import { config } from 'dotenv';
import { join } from 'path';

config({ path: join(__dirname, '.env') });

async function monitorFabriceEvaJob() {
  const supabase = createSupabaseServiceClient();

  if (!supabase) {
    console.error('❌ Supabase not configured');
    process.exit(1);
  }

  console.log('🔍 Monitoring for Nuclear reading job: Fabrice & Eva\n');
  console.log('📋 Watching for new jobs...\n');

  let lastCheckedJobId: string | null = null;
  let foundJob: any = null;

  const checkForJob = async () => {
    try {
      // Find jobs with Fabrice and Eva
      const { data: jobs, error } = await supabase
        .from('jobs')
        .select('id, user_id, type, status, progress, params, created_at, updated_at, error')
        .in('type', ['nuclear_v2', 'nuclear', 'extended'])
        .order('created_at', { ascending: false })
        .limit(10);

      if (error) {
        console.error('❌ Error fetching jobs:', error);
        return;
      }

      // Find Fabrice & Eva job
      const fabriceEvaJob = (jobs || []).find((job: any) => {
        const params = job.params || {};
        const p1Name = (params.person1?.name || '').toLowerCase();
        const p2Name = (params.person2?.name || '').toLowerCase();
        return (
          (p1Name.includes('fabrice') && p2Name.includes('eva')) ||
          (p1Name.includes('eva') && p2Name.includes('fabrice'))
        );
      });

      if (fabriceEvaJob && fabriceEvaJob.id !== lastCheckedJobId) {
        foundJob = fabriceEvaJob;
        lastCheckedJobId = fabriceEvaJob.id;

        const params = fabriceEvaJob.params || {};
        const p1Name = params.person1?.name || 'Unknown';
        const p2Name = params.person2?.name || 'Unknown';

        console.log('✅ FOUND JOB!');
        console.log('═══════════════════════════════════════════════════════════');
        console.log(`📋 Job ID: ${fabriceEvaJob.id}`);
        console.log(`👥 People: ${p1Name} & ${p2Name}`);
        console.log(`📊 Type: ${fabriceEvaJob.type}`);
        console.log(`🔄 Status: ${fabriceEvaJob.status}`);
        console.log(`📅 Created: ${new Date(fabriceEvaJob.created_at).toLocaleString()}`);
        console.log(`🕐 Updated: ${new Date(fabriceEvaJob.updated_at).toLocaleString()}`);

        if (fabriceEvaJob.progress) {
          const progress = fabriceEvaJob.progress;
          console.log(`\n📈 Progress:`);
          console.log(`   Phase: ${progress.phase || 'N/A'}`);
          console.log(`   Percent: ${progress.percent || 0}%`);
          console.log(`   Systems: ${progress.systemsCompleted || 0}/${progress.totalSystems || 0}`);
          console.log(`   Docs: ${progress.docsComplete || 0}/${progress.docsTotal || 0}`);
          console.log(`   Message: ${progress.message || 'N/A'}`);
        }

        if (fabriceEvaJob.error) {
          console.log(`\n❌ Error: ${fabriceEvaJob.error}`);
        }

        console.log('═══════════════════════════════════════════════════════════\n');

        // Check for tasks
        const { data: tasks, error: tasksError } = await supabase
          .from('job_tasks')
          .select('id, task_type, status, sequence, created_at, started_at, completed_at, error')
          .eq('job_id', fabriceEvaJob.id)
          .order('sequence', { ascending: true });

        if (!tasksError && tasks) {
          console.log(`📋 Tasks (${tasks.length}):`);
          
          // CRITICAL: Check for audio failures immediately
          const audioTasks = tasks.filter((t: any) => t.task_type === 'audio_generation');
          const failedAudioTasks = audioTasks.filter((t: any) => t.status === 'failed');
          
          if (failedAudioTasks.length > 0) {
            console.log('\n🚨🚨🚨 AUDIO GENERATION FAILED! 🚨🚨🚨');
            console.log('═══════════════════════════════════════════════════════════');
            console.log('❌ FAILED AUDIO TASKS:');
            failedAudioTasks.forEach((task: any) => {
              console.log(`   Task ID: ${task.id}`);
              console.log(`   Sequence: ${task.sequence}`);
              console.log(`   Error: ${task.error || 'Unknown error'}`);
              console.log(`   Started: ${task.started_at ? new Date(task.started_at).toLocaleString() : 'N/A'}`);
              console.log(`   Failed: ${task.completed_at ? new Date(task.completed_at).toLocaleString() : 'N/A'}`);
              console.log('');
            });
            console.log('═══════════════════════════════════════════════════════════');
            console.log('🛑 STOPPING MONITOR - Audio generation has failed!');
            console.log('🛑 Please investigate immediately!');
            console.log('═══════════════════════════════════════════════════════════\n');
            process.exit(1);
          }
          
          tasks.forEach((task: any) => {
            const statusIcon = 
              task.status === 'complete' ? '✅' :
              task.status === 'processing' ? '🔄' :
              task.status === 'failed' ? '❌' :
              task.status === 'claimed' ? '🔒' :
              '⏳';
            console.log(`   ${statusIcon} ${task.task_type} (seq ${task.sequence}) - ${task.status}`);
            if (task.started_at) {
              console.log(`      Started: ${new Date(task.started_at).toLocaleString()}`);
            }
            if (task.completed_at) {
              console.log(`      Completed: ${new Date(task.completed_at).toLocaleString()}`);
            }
            if (task.error) {
              console.log(`      Error: ${task.error}`);
            }
          });
          console.log('');
        }

        // Check for artifacts
        const { data: artifacts, error: artifactsError } = await supabase
          .from('job_artifacts')
          .select('id, artifact_type, storage_path, created_at, metadata')
          .eq('job_id', fabriceEvaJob.id)
          .order('created_at', { ascending: true });

        if (!artifactsError && artifacts) {
          console.log(`📦 Artifacts (${artifacts.length}):`);
          artifacts.forEach((artifact: any) => {
            const meta = artifact.metadata || {};
            console.log(`   📄 ${artifact.artifact_type} - ${meta.system || 'N/A'} (doc ${meta.docNum || 'N/A'})`);
            console.log(`      Path: ${artifact.storage_path}`);
            console.log(`      Created: ${new Date(artifact.created_at).toLocaleString()}`);
          });
          console.log('');
        }
      } else if (foundJob) {
        // Job exists, check for status updates
        const { data: updatedJob, error: updateError } = await supabase
          .from('jobs')
          .select('status, progress, updated_at, error')
          .eq('id', foundJob.id)
          .single();

        if (!updateError && updatedJob) {
          // CRITICAL: Check for audio task failures on every update
          const { data: audioTasks } = await supabase
            .from('job_tasks')
            .select('id, task_type, status, sequence, error, completed_at')
            .eq('job_id', foundJob.id)
            .eq('task_type', 'audio_generation')
            .eq('status', 'failed');

          if (audioTasks && audioTasks.length > 0) {
            console.log('\n🚨🚨🚨 AUDIO GENERATION FAILED! 🚨🚨🚨');
            console.log('═══════════════════════════════════════════════════════════');
            console.log('❌ FAILED AUDIO TASKS:');
            audioTasks.forEach((task: any) => {
              console.log(`   Task ID: ${task.id}`);
              console.log(`   Sequence: ${task.sequence}`);
              console.log(`   Error: ${task.error || 'Unknown error'}`);
              console.log(`   Failed: ${task.completed_at ? new Date(task.completed_at).toLocaleString() : 'N/A'}`);
              console.log('');
            });
            console.log('═══════════════════════════════════════════════════════════');
            console.log('🛑 STOPPING MONITOR - Audio generation has failed!');
            console.log('🛑 Please investigate immediately!');
            console.log('═══════════════════════════════════════════════════════════\n');
            process.exit(1);
          }

          const statusChanged = updatedJob.status !== foundJob.status;
          const progressChanged = JSON.stringify(updatedJob.progress) !== JSON.stringify(foundJob.progress);

          if (statusChanged || progressChanged) {
            console.log(`🔄 STATUS UPDATE for Job ${foundJob.id}:`);
            if (statusChanged) {
              console.log(`   Status: ${foundJob.status} → ${updatedJob.status}`);
            }
            if (progressChanged && updatedJob.progress) {
              const p = updatedJob.progress;
              console.log(`   Progress: ${p.percent || 0}% - ${p.phase || 'N/A'}`);
              console.log(`   Systems: ${p.systemsCompleted || 0}/${p.totalSystems || 0}`);
              console.log(`   Docs: ${p.docsComplete || 0}/${p.docsTotal || 0}`);
            }
            if (updatedJob.error) {
              console.log(`   ❌ Error: ${updatedJob.error}`);
            }
            console.log(`   Updated: ${new Date(updatedJob.updated_at).toLocaleString()}\n`);

            foundJob.status = updatedJob.status;
            foundJob.progress = updatedJob.progress;
            foundJob.error = updatedJob.error;
          }
        }
      }
    } catch (err: any) {
      console.error('❌ Error in check:', err.message);
    }
  };

  // Check immediately
  await checkForJob();

  // Then check every 5 seconds
  const interval = setInterval(checkForJob, 5000);

  console.log('👀 Monitoring active. Press Ctrl+C to stop.\n');

  // Cleanup on exit
  process.on('SIGINT', () => {
    console.log('\n\n🛑 Stopping monitor...');
    clearInterval(interval);
    process.exit(0);
  });
}

monitorFabriceEvaJob().catch(console.error);
