"use strict";
/**
 * CHECK MICHAEL HUMAN DESIGN JOB AUDIO STATUS
 */
Object.defineProperty(exports, "__esModule", { value: true });
const supabaseClient_1 = require("../services/supabaseClient");
const dotenv_1 = require("dotenv");
const path_1 = require("path");
(0, dotenv_1.config)({ path: (0, path_1.join)(__dirname, '../../.env') });
async function main() {
    const supabase = (0, supabaseClient_1.createSupabaseServiceClient)();
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
    const michaelHumanDesignJobs = jobs.filter((job) => {
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
        // Get all tasks with detailed info
        const { data: tasks, error: tasksError } = await supabase
            .from('job_tasks')
            .select('id, task_type, status, sequence, input, error, created_at, started_at, completed_at, last_heartbeat, worker_id, attempts, max_attempts, heartbeat_timeout_seconds')
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
        const audioTasks = tasks.filter((t) => t.task_type === 'audio_generation');
        const textTasks = tasks.filter((t) => t.task_type === 'text_generation');
        const songTasks = tasks.filter((t) => t.task_type === 'song_generation');
        console.log(`\n   📝 Text tasks: ${textTasks.length} total`);
        console.log(`      ✅ Complete: ${textTasks.filter((t) => t.status === 'complete').length}`);
        console.log(`      ⏳ Processing: ${textTasks.filter((t) => t.status === 'processing').length}`);
        console.log(`      ⏸️  Pending: ${textTasks.filter((t) => t.status === 'pending').length}`);
        console.log(`      ❌ Failed: ${textTasks.filter((t) => t.status === 'failed').length}`);
        console.log(`\n   🎵 Audio tasks: ${audioTasks.length} total`);
        const audioComplete = audioTasks.filter((t) => t.status === 'complete').length;
        const audioProcessing = audioTasks.filter((t) => t.status === 'processing').length;
        const audioPending = audioTasks.filter((t) => t.status === 'pending').length;
        const audioFailed = audioTasks.filter((t) => t.status === 'failed').length;
        console.log(`      ✅ Complete: ${audioComplete}`);
        console.log(`      ⏳ Processing: ${audioProcessing}`);
        console.log(`      ⏸️  Pending: ${audioPending}`);
        console.log(`      ❌ Failed: ${audioFailed}`);
        console.log(`\n   🎶 Song tasks: ${songTasks.length} total`);
        const songComplete = songTasks.filter((t) => t.status === 'complete').length;
        const songProcessing = songTasks.filter((t) => t.status === 'processing').length;
        const songPending = songTasks.filter((t) => t.status === 'pending').length;
        const songFailed = songTasks.filter((t) => t.status === 'failed').length;
        console.log(`      ✅ Complete: ${songComplete}`);
        console.log(`      ⏳ Processing: ${songProcessing}`);
        console.log(`      ⏸️  Pending: ${songPending}`);
        console.log(`      ❌ Failed: ${songFailed}`);
        // Show details of non-complete audio tasks
        const problemAudio = audioTasks.filter((t) => t.status !== 'complete');
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
                const heartbeatAge = task.last_heartbeat
                    ? Math.floor((Date.now() - new Date(task.last_heartbeat).getTime()) / 1000)
                    : null;
                const timeout = task.heartbeat_timeout_seconds || 900;
                console.log(`      - Task ${task.id.substring(0, 8)}: ${docType} / ${system} → ${task.status} (${age}m ago)`);
                console.log(`        Worker: ${task.worker_id || 'NONE'}`);
                console.log(`        Attempts: ${task.attempts}/${task.max_attempts}`);
                if (task.last_heartbeat) {
                    console.log(`        Last heartbeat: ${heartbeatAge}s ago (timeout: ${timeout}s)`);
                    if (heartbeatAge && heartbeatAge > timeout) {
                        console.log(`        ⚠️  HEARTBEAT TIMEOUT! Task is stuck!`);
                    }
                }
                else {
                    console.log(`        Last heartbeat: NEVER`);
                }
                if (task.error) {
                    console.log(`        Error: ${task.error.substring(0, 200)}`);
                }
                if (task.started_at) {
                    console.log(`        Started: ${new Date(task.started_at).toLocaleString()}`);
                }
            }
        }
        // Show details of non-complete song tasks
        const problemSongs = songTasks.filter((t) => t.status !== 'complete');
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
        const claimedAudio = audioTasks.filter((t) => t.status === 'processing' && t.started_at);
        if (claimedAudio.length > 0) {
            console.log(`\n   ✅ ${claimedAudio.length} audio task(s) are RUNNING (claimed by workers)`);
        }
        else if (audioPending.length > 0) {
            console.log(`\n   ⏸️  ${audioPending.length} audio task(s) are PENDING (waiting for workers)`);
        }
        // Check artifacts for songs
        const { data: artifacts } = await supabase
            .from('job_artifacts')
            .select('artifact_type, storage_path, metadata')
            .eq('job_id', job.id);
        if (artifacts) {
            const songArtifacts = artifacts.filter((a) => a.artifact_type === 'audio_song');
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
//# sourceMappingURL=check-michael-human-design.js.map