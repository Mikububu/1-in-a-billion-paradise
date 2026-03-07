"use strict";
/**
 * Cancel/delete broken jobs that have no person data
 */
Object.defineProperty(exports, "__esModule", { value: true });
const supabaseClient_1 = require("../services/supabaseClient");
const dotenv_1 = require("dotenv");
const path_1 = require("path");
(0, dotenv_1.config)({ path: (0, path_1.join)(__dirname, '../../.env') });
async function cancelBrokenJobs() {
    const supabase = (0, supabaseClient_1.createSupabaseServiceClient)();
    if (!supabase) {
        console.error('❌ Supabase not configured');
        process.exit(1);
    }
    console.log('🧹 Finding and cancelling broken jobs...\n');
    // Get all jobs with failed tasks due to missing person data
    const { data: failedTasks, error } = await supabase
        .from('job_tasks')
        .select('job_id, error')
        .eq('status', 'failed')
        .ilike('error', '%Missing person1/person2%');
    if (error) {
        console.error('❌ Error fetching failed tasks:', error);
        process.exit(1);
    }
    if (!failedTasks || failedTasks.length === 0) {
        console.log('✅ No broken jobs found!');
        return;
    }
    const jobIds = [...new Set(failedTasks.map((t) => t.job_id))];
    console.log(`📊 Found ${jobIds.length} broken jobs\n`);
    for (const jobId of jobIds) {
        console.log(`🗑️  Deleting job ${jobId}...`);
        // Delete job tasks first
        const { error: deleteTasksError } = await supabase
            .from('job_tasks')
            .delete()
            .eq('job_id', jobId);
        if (deleteTasksError) {
            console.error(`   ❌ Failed to delete tasks: ${deleteTasksError.message}`);
            continue;
        }
        // Delete job
        const { error: deleteJobError } = await supabase
            .from('jobs')
            .delete()
            .eq('id', jobId);
        if (deleteJobError) {
            console.error(`   ❌ Failed to delete job: ${deleteJobError.message}`);
        }
        else {
            console.log(`   ✅ Deleted`);
        }
    }
    console.log(`\n✅ Cleanup complete!`);
}
cancelBrokenJobs().catch(err => {
    console.error('❌ Fatal error:', err);
    process.exit(1);
});
//# sourceMappingURL=cancelBrokenJobs.js.map