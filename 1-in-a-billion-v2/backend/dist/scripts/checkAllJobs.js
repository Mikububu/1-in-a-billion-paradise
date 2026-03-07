"use strict";
/**
 * Check all jobs in the system
 */
Object.defineProperty(exports, "__esModule", { value: true });
const supabaseClient_1 = require("../services/supabaseClient");
const dotenv_1 = require("dotenv");
const path_1 = require("path");
(0, dotenv_1.config)({ path: (0, path_1.join)(__dirname, '../../.env') });
async function checkAllJobs() {
    const supabase = (0, supabaseClient_1.createSupabaseServiceClient)();
    if (!supabase) {
        console.error('❌ Supabase not configured');
        process.exit(1);
    }
    console.log('🔍 Checking all jobs in the system...\n');
    // Get all jobs
    const { data: jobs, error } = await supabase
        .from('jobs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(10);
    if (error) {
        console.error('❌ Error fetching jobs:', error);
        process.exit(1);
    }
    console.log(`📊 Total jobs found: ${jobs?.length || 0}\n`);
    if (!jobs || jobs.length === 0) {
        console.log('ℹ️  No jobs found in the system.');
        return;
    }
    // Display each job
    for (const job of jobs) {
        console.log(`\n📦 Job: ${job.id}`);
        console.log(`   User: ${job.user_id}`);
        console.log(`   Type: ${job.type}`);
        console.log(`   Status: ${job.status}`);
        console.log(`   Created: ${job.created_at}`);
        console.log(`   Updated: ${job.updated_at}`);
        // Get tasks for this job
        const { data: tasks } = await supabase
            .from('job_tasks')
            .select('task_type, status')
            .eq('job_id', job.id);
        if (tasks) {
            const taskSummary = {};
            tasks.forEach((task) => {
                if (!taskSummary[task.task_type]) {
                    taskSummary[task.task_type] = {};
                }
                taskSummary[task.task_type][task.status] =
                    (taskSummary[task.task_type][task.status] || 0) + 1;
            });
            console.log('   Tasks:');
            Object.entries(taskSummary).forEach(([type, statuses]) => {
                const summary = Object.entries(statuses)
                    .map(([status, count]) => `${status}:${count}`)
                    .join(', ');
                console.log(`     ${type}: ${summary}`);
            });
        }
    }
}
checkAllJobs().catch(err => {
    console.error('❌ Fatal error:', err);
    process.exit(1);
});
//# sourceMappingURL=checkAllJobs.js.map