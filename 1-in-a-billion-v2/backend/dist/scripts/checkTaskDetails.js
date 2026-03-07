"use strict";
/**
 * Check detailed task status including error messages
 */
Object.defineProperty(exports, "__esModule", { value: true });
const supabaseClient_1 = require("../services/supabaseClient");
const dotenv_1 = require("dotenv");
const path_1 = require("path");
(0, dotenv_1.config)({ path: (0, path_1.join)(__dirname, '../../.env') });
async function checkTaskDetails() {
    const supabase = (0, supabaseClient_1.createSupabaseServiceClient)();
    if (!supabase) {
        console.error('❌ Supabase not configured');
        process.exit(1);
    }
    console.log('🔍 Checking task details...\n');
    const { data: tasks, error } = await supabase
        .from('job_tasks')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(10);
    if (error) {
        console.error('❌ Error fetching tasks:', error);
        process.exit(1);
    }
    if (!tasks || tasks.length === 0) {
        console.log('ℹ️  No tasks found.');
        return;
    }
    console.log(`📊 Total tasks: ${tasks.length}\n`);
    tasks.forEach((task) => {
        console.log(`\n📋 Task: ${task.id.substring(0, 13)}...`);
        console.log(`   Job: ${task.job_id.substring(0, 13)}...`);
        console.log(`   Type: ${task.task_type}`);
        console.log(`   Status: ${task.status}`);
        console.log(`   Attempts: ${task.attempts}/${task.max_attempts}`);
        console.log(`   Created: ${task.created_at}`);
        console.log(`   Updated: ${task.updated_at}`);
        if (task.error) {
            console.log(`   ❌ Error: ${task.error}`);
        }
        if (task.input) {
            console.log(`   Input keys: ${Object.keys(task.input).join(', ')}`);
        }
    });
}
checkTaskDetails().catch(err => {
    console.error('❌ Fatal error:', err);
    process.exit(1);
});
//# sourceMappingURL=checkTaskDetails.js.map