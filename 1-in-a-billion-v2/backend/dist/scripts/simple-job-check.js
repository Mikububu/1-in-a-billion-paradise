"use strict";
/**
 * SIMPLE JOB CHECK - No auth.admin, just direct query
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
    console.log('🔍 CHECKING RECENT JOBS\n');
    // Get recent 3 jobs directly
    const { data: jobs, error: jobsError } = await supabase
        .from('jobs')
        .select('id, type, params, created_at')
        .order('created_at', { ascending: false })
        .limit(3);
    if (jobsError) {
        console.error('❌ Failed to fetch jobs:', jobsError);
        process.exit(1);
    }
    if (!jobs || jobs.length === 0) {
        console.log('No jobs found');
        process.exit(0);
    }
    for (const job of jobs) {
        const p1Name = job.params?.person1?.name || 'Unknown';
        const p2Name = job.params?.person2?.name;
        const jobName = p2Name ? `${p1Name} + ${p2Name}` : p1Name;
        console.log(`\n📋 ${jobName} (${job.type})`);
        console.log(`   ID: ${job.id}`);
        console.log(`   Created: ${new Date(job.created_at).toLocaleString()}`);
        // Get tasks
        const { data: tasks } = await supabase
            .from('job_tasks')
            .select('id, task_type, status, input, error_message')
            .eq('job_id', job.id)
            .order('sequence', { ascending: true });
        if (!tasks)
            continue;
        const textTasks = tasks.filter((t) => t.task_type === 'text_generation');
        const audioTasks = tasks.filter((t) => t.task_type === 'audio_generation');
        console.log(`   📝 Text: ${textTasks.filter((t) => t.status === 'complete').length}/${textTasks.length} complete`);
        console.log(`   🎵 Audio: ${audioTasks.filter((t) => t.status === 'complete').length}/${audioTasks.length} complete`);
        // Show problem audio
        const problemAudio = audioTasks.filter((t) => t.status !== 'complete');
        if (problemAudio.length > 0) {
            console.log(`\n   ⚠️  Missing audio:`);
            for (const task of problemAudio) {
                const docType = task.input?.docType || '?';
                const system = task.input?.system || '?';
                console.log(`      - ${docType} / ${system} → ${task.status}`);
                if (task.error_message) {
                    console.log(`        ${task.error_message.substring(0, 100)}`);
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
//# sourceMappingURL=simple-job-check.js.map