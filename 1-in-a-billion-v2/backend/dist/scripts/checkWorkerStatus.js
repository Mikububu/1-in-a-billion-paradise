"use strict";
/**
 * Check if workers are running and processing tasks
 */
Object.defineProperty(exports, "__esModule", { value: true });
const supabaseClient_1 = require("../services/supabaseClient");
const dotenv_1 = require("dotenv");
const path_1 = require("path");
(0, dotenv_1.config)({ path: (0, path_1.join)(__dirname, '../../.env') });
async function checkWorkerStatus() {
    const supabase = (0, supabaseClient_1.createSupabaseServiceClient)();
    if (!supabase) {
        console.error('❌ Supabase not configured');
        process.exit(1);
    }
    console.log('🔍 Checking worker status...\n');
    // Check all tasks across all jobs
    const { data: tasks, error } = await supabase
        .from('job_tasks')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(50);
    if (error) {
        console.error('❌ Error fetching tasks:', error);
        process.exit(1);
    }
    if (!tasks || tasks.length === 0) {
        console.log('ℹ️  No tasks found.');
        return;
    }
    console.log(`📊 Total tasks: ${tasks.length}\n`);
    // Group by status
    const statusCount = {};
    const typeCount = {};
    tasks.forEach((task) => {
        statusCount[task.status] = (statusCount[task.status] || 0) + 1;
        if (!typeCount[task.task_type]) {
            typeCount[task.task_type] = {};
        }
        typeCount[task.task_type][task.status] =
            (typeCount[task.task_type][task.status] || 0) + 1;
    });
    console.log('📈 Task Status Summary:');
    Object.entries(statusCount).forEach(([status, count]) => {
        console.log(`   ${status}: ${count}`);
    });
    console.log('\n📋 By Task Type:');
    Object.entries(typeCount).forEach(([type, statuses]) => {
        console.log(`\n   ${type}:`);
        Object.entries(statuses).forEach(([status, count]) => {
            console.log(`     ${status}: ${count}`);
        });
    });
    // Check for stuck/old processing tasks
    console.log('\n⏰ Checking for stuck tasks...');
    const now = new Date();
    const stuckTasks = tasks.filter((task) => {
        if (task.status !== 'processing')
            return false;
        const updatedAt = new Date(task.updated_at);
        const ageMinutes = (now.getTime() - updatedAt.getTime()) / 1000 / 60;
        return ageMinutes > 10; // Stuck if processing for > 10 minutes
    });
    if (stuckTasks.length > 0) {
        console.log(`\n❌ Found ${stuckTasks.length} stuck tasks (processing > 10 min):`);
        stuckTasks.forEach((task) => {
            const updatedAt = new Date(task.updated_at);
            const ageMinutes = Math.floor((now.getTime() - updatedAt.getTime()) / 1000 / 60);
            console.log(`   - ${task.task_type} (${task.id.substring(0, 8)}...) stuck for ${ageMinutes} min`);
        });
    }
    else {
        console.log('   ✅ No stuck tasks found');
    }
    // Check for workers that have checked in recently
    console.log('\n👷 Worker Activity:');
    const recentlyUpdated = tasks.filter((task) => {
        const updatedAt = new Date(task.updated_at);
        const ageMinutes = (now.getTime() - updatedAt.getTime()) / 1000 / 60;
        return ageMinutes < 5; // Updated in last 5 minutes
    });
    if (recentlyUpdated.length > 0) {
        console.log(`   ✅ ${recentlyUpdated.length} tasks updated in last 5 minutes (workers are active)`);
    }
    else {
        console.log(`   ❌ No tasks updated in last 5 minutes (workers may be down)`);
    }
}
checkWorkerStatus().catch(err => {
    console.error('❌ Fatal error:', err);
    process.exit(1);
});
//# sourceMappingURL=checkWorkerStatus.js.map