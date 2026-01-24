/**
 * CHECK MICHAEL HUMAN DESIGN JOB AUDIO STATUS
 */

import { createSupabaseServiceClient } from '../services/supabaseClient';
import { config } from 'dotenv';
import { join } from 'path';

config({ path: join(__dirname, '../../.env') });

async function main() {
  const supabase = createSupabaseServiceClient();
  if (!supabase) {
    console.error('❌ Supabase not configured');
    process.exit(1);
  }

  console.log('🔍 CHECKING MICHAEL HUMAN DESIGN JOB AUDIO STATUS\n');

  // Find jobs for Michael with human_design
  const { data: jobs, error: jobsError } = await supabase
    .from('jobs')
    .select('id, type, params, status, created_at, updated_at')
    .order('created_at', { ascending: false })
    .limit(20);

  if (jobsError) {
    console.error('❌ Failed to fetch jobs:', jobsError);
    process.exit(1);
  }

  if (!jobs || jobs.length === 0) {
    console.log('No jobs found');
    process.exit(0);
  }

  // Filter for Michael + human_design
  const michaelHumanDesignJobs = jobs.filter((job: any) => {
    const p1Name = job.params?.person1?.name || '';
    const systems = job.params?.systems || [];
    return p1Name.toLowerCase().includes('michael') && systems.includes('human_design');
  });

  if (michaelHumanDesignJobs.length === 0) {
    console.log('❌ No Michael Human Design jobs found');
    process.exit(0);
  }

  for (const job of michaelHumanDesignJobs) {
    const p1Name = job.params?.person1?.name || 'Unknown';
    console.log(`\n📋 ${p1Name} - Human Design (${job.type})`);
    console.log(`   ID: ${job.id}`);
    console.log(`   Status: ${job.status}`);
    console.log(`   Created: ${new Date(job.created_at).toLocaleString()}`);
    console.log(`   Updated: ${new Date(job.updated_at).toLocaleString()}`);

    // Get all tasks
    const { data: tasks, error: tasksError } = await supabase
      .from('job_tasks')
      .select('id, task_type, status, sequence, input, error, created_at, started_at, completed_at')
      .eq('job_id', job.id)
      .order('sequence', { ascending: true });

    if (tasksError) {
      console.log(`   ❌ Failed to fetch tasks: ${tasksError.message}`);
      continue;
    }

    if (!tasks || tasks.length === 0) {
      console.log(`   ⚠️  No tasks found`);
      continue;
    }

    const audioTasks = tasks.filter((t: any) => t.task_type === 'audio_generation');
    const textTasks = tasks.filter((t: any) => t.task_type === 'text_generation');
    const songTasks = tasks.filter((t: any) => t.task_type === 'song_generation');

    console.log(`\n   📝 Text tasks: ${textTasks.length} total`);
    console.log(`      ✅ Complete: ${textTasks.filter((t: any) => t.status === 'complete').length}`);
    console.log(`      ⏳ Processing: ${textTasks.filter((t: any) => t.status === 'processing').length}`);
    console.log(`      ⏸️  Pending: ${textTasks.filter((t: any) => t.status === 'pending').length}`);
    console.log(`      ❌ Failed: ${textTasks.filter((t: any) => t.status === 'failed').length}`);

    console.log(`\n   🎵 Audio tasks: ${audioTasks.length} total`);
    const audioComplete = audioTasks.filter((t: any) => t.status === 'complete').length;
    const audioProcessing = audioTasks.filter((t: any) => t.status === 'processing').length;
    const audioPending = audioTasks.filter((t: any) => t.status === 'pending').length;
    const audioFailed = audioTasks.filter((t: any) => t.status === 'failed').length;
    
    console.log(`      ✅ Complete: ${audioComplete}`);
    console.log(`      ⏳ Processing: ${audioProcessing}`);
    console.log(`      ⏸️  Pending: ${audioPending}`);
    console.log(`      ❌ Failed: ${audioFailed}`);

    console.log(`\n   🎶 Song tasks: ${songTasks.length} total`);
    const songComplete = songTasks.filter((t: any) => t.status === 'complete').length;
    const songProcessing = songTasks.filter((t: any) => t.status === 'processing').length;
    const songPending = songTasks.filter((t: any) => t.status === 'pending').length;
    const songFailed = songTasks.filter((t: any) => t.status === 'failed').length;
    
    console.log(`      ✅ Complete: ${songComplete}`);
    console.log(`      ⏳ Processing: ${songProcessing}`);
    console.log(`      ⏸️  Pending: ${songPending}`);
    console.log(`      ❌ Failed: ${songFailed}`);

    // Show details of non-complete audio tasks
    const problemAudio = audioTasks.filter((t: any) => t.status !== 'complete');
    if (problemAudio.length > 0) {
      console.log(`\n   🔍 Audio tasks NOT complete:`);
      for (const task of problemAudio) {
        const docType = task.input?.docType || 'unknown';
        const system = task.input?.system || 'unknown';
        const age = task.started_at 
          ? Math.floor((Date.now() - new Date(task.started_at).getTime()) / 1000 / 60)
          : task.created_at
          ? Math.floor((Date.now() - new Date(task.created_at).getTime()) / 1000 / 60)
          : 0;
        console.log(`      - Task ${task.id.substring(0, 8)}: ${docType} / ${system} → ${task.status} (${age}m ago)`);
        if (task.error) {
          console.log(`        Error: ${task.error.substring(0, 150)}`);
        }
        if (task.started_at) {
          console.log(`        Started: ${new Date(task.started_at).toLocaleString()}`);
        }
      }
    }

    // Show details of non-complete song tasks
    const problemSongs = songTasks.filter((t: any) => t.status !== 'complete');
    if (problemSongs.length > 0) {
      console.log(`\n   🔍 Song tasks NOT complete:`);
      for (const task of problemSongs) {
        const docType = task.input?.docType || 'unknown';
        const system = task.input?.system || 'unknown';
        const age = task.started_at 
          ? Math.floor((Date.now() - new Date(task.started_at).getTime()) / 1000 / 60)
          : task.created_at
          ? Math.floor((Date.now() - new Date(task.created_at).getTime()) / 1000 / 60)
          : 0;
        console.log(`      - Task ${task.id.substring(0, 8)}: ${docType} / ${system} → ${task.status} (${age}m ago)`);
        if (task.error) {
          console.log(`        Error: ${task.error.substring(0, 150)}`);
        }
      }
    }

    // Check if audio tasks are actually running (claimed by workers)
    const claimedAudio = audioTasks.filter((t: any) => t.status === 'processing' && t.started_at);
    if (claimedAudio.length > 0) {
      console.log(`\n   ✅ ${claimedAudio.length} audio task(s) are RUNNING (claimed by workers)`);
    } else if (audioPending.length > 0) {
      console.log(`\n   ⏸️  ${audioPending.length} audio task(s) are PENDING (waiting for workers)`);
    }

    // Check artifacts for songs
    const { data: artifacts } = await supabase
      .from('job_artifacts')
      .select('artifact_type, storage_path, metadata')
      .eq('job_id', job.id);
    
    if (artifacts) {
      const songArtifacts = artifacts.filter((a: any) => a.artifact_type === 'audio_song');
      console.log(`\n   📦 Song artifacts in storage: ${songArtifacts.length}`);
      for (const artifact of songArtifacts) {
        console.log(`      - ${artifact.storage_path}`);
        if (artifact.metadata?.lyrics) {
          console.log(`        Lyrics: ${artifact.metadata.lyrics.substring(0, 100)}...`);
        }
      }
    }
  }

  console.log('\n✅ Done\n');
}

main().catch(err => {
  console.error('❌ Script failed:', err);
  process.exit(1);
});
