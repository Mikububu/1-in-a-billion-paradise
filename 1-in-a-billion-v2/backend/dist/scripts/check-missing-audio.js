"use strict";
/**
 * CHECK MISSING AUDIO
 *
 * Finds recent jobs and checks which audio tasks are missing
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
    console.log('🔍 CHECKING MISSING AUDIO FOR RECENT JOBS\n');
    // Get user ID from auth schema
    const { data: authUsers, error: userError } = await supabase.auth.admin.listUsers();
    if (userError || !authUsers) {
        console.error('❌ Failed to list users:', userError);
        process.exit(1);
    }
    const user = authUsers.users.find((u) => u.email === 'michael@forbidden-yoga.com');
    if (!user) {
        console.error('❌ User not found');
        process.exit(1);
    }
    const userId = user.id;
    // Get recent 5 jobs
    const { data: jobs, error: jobsError } = await supabase
        .from('jobs')
        .select('id, type, params, created_at')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(5);
    if (jobsError || !jobs) {
        console.error('❌ Failed to fetch jobs');
        process.exit(1);
    }
    for (const job of jobs) {
        const p1Name = job.params?.person1?.name || 'Unknown';
        const p2Name = job.params?.person2?.name;
        const jobName = p2Name ? `${p1Name} + ${p2Name}` : p1Name;
        console.log(`\n📋 Job: ${jobName} (${job.type})`);
        console.log(`   ID: ${job.id}`);
        console.log(`   Created: ${new Date(job.created_at).toLocaleString()}`);
        // Get tasks for this job
        const { data: tasks, error: tasksError } = await supabase
            .from('job_tasks')
            .select('id, task_type, status, input, result_data, error_message')
            .eq('job_id', job.id)
            .order('sequence', { ascending: true });
        if (tasksError || !tasks) {
            console.log('   ❌ Failed to fetch tasks');
            continue;
        }
        const textTasks = tasks.filter((t) => t.task_type === 'text_generation');
        const audioTasks = tasks.filter((t) => t.task_type === 'audio_generation');
        const pdfTasks = tasks.filter((t) => t.task_type === 'pdf_generation');
        console.log(`\n   📝 Text tasks: ${textTasks.length} total`);
        console.log(`      ✅ Complete: ${textTasks.filter((t) => t.status === 'complete').length}`);
        console.log(`      ❌ Failed: ${textTasks.filter((t) => t.status === 'failed').length}`);
        console.log(`      ⏳ Pending: ${textTasks.filter((t) => t.status === 'pending').length}`);
        console.log(`\n   🎵 Audio tasks: ${audioTasks.length} total`);
        console.log(`      ✅ Complete: ${audioTasks.filter((t) => t.status === 'complete').length}`);
        console.log(`      ❌ Failed: ${audioTasks.filter((t) => t.status === 'failed').length}`);
        console.log(`      ⏳ Pending: ${audioTasks.filter((t) => t.status === 'pending').length}`);
        console.log(`\n   📄 PDF tasks: ${pdfTasks.length} total`);
        console.log(`      ✅ Complete: ${pdfTasks.filter((t) => t.status === 'complete').length}`);
        console.log(`      ❌ Failed: ${pdfTasks.filter((t) => t.status === 'failed').length}`);
        console.log(`      ⏳ Pending: ${pdfTasks.filter((t) => t.status === 'pending').length}`);
        // Show failed/pending audio tasks details
        const problemAudio = audioTasks.filter((t) => t.status !== 'complete');
        if (problemAudio.length > 0) {
            console.log(`\n   🔍 Audio tasks NOT complete:`);
            for (const task of problemAudio) {
                const docType = task.input?.docType || 'unknown';
                const system = task.input?.system || 'unknown';
                console.log(`      - Task ${task.id.substring(0, 8)}: ${docType} / ${system} → ${task.status}`);
                if (task.error_message) {
                    console.log(`        Error: ${task.error_message}`);
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
//# sourceMappingURL=check-missing-audio.js.map