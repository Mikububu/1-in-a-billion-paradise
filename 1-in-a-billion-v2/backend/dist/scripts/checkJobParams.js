"use strict";
/**
 * Check job params to see if person data is missing
 */
Object.defineProperty(exports, "__esModule", { value: true });
const supabaseClient_1 = require("../services/supabaseClient");
const dotenv_1 = require("dotenv");
const path_1 = require("path");
(0, dotenv_1.config)({ path: (0, path_1.join)(__dirname, '../../.env') });
async function checkJobParams() {
    const supabase = (0, supabaseClient_1.createSupabaseServiceClient)();
    if (!supabase) {
        console.error('❌ Supabase not configured');
        process.exit(1);
    }
    console.log('🔍 Checking job params...\n');
    const { data: jobs, error } = await supabase
        .from('jobs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(10);
    if (error) {
        console.error('❌ Error fetching jobs:', error);
        process.exit(1);
    }
    if (!jobs || jobs.length === 0) {
        console.log('ℹ️  No jobs found.');
        return;
    }
    console.log(`📊 Total jobs: ${jobs.length}\n`);
    jobs.forEach((job) => {
        console.log(`\n📦 Job: ${job.id.substring(0, 13)}...`);
        console.log(`   Type: ${job.type}`);
        console.log(`   Status: ${job.status}`);
        console.log(`   User: ${job.user_id.substring(0, 13)}...`);
        console.log(`   Created: ${job.created_at}`);
        if (job.params) {
            const keys = Object.keys(job.params);
            console.log(`   Params keys: ${keys.join(', ')}`);
            // Check for person data
            const hasPerson1 = job.params.person1 || job.params.personName;
            const hasPerson2 = job.params.person2;
            if (job.type === 'extended' || job.type === 'nuclear_v2') {
                if (job.params.person1) {
                    console.log(`   ✅ person1: ${job.params.person1.name || 'unnamed'}`);
                }
                else {
                    console.log(`   ❌ Missing person1 data`);
                }
                if (job.params.person2) {
                    console.log(`   ✅ person2: ${job.params.person2.name || 'unnamed'}`);
                }
                else {
                    console.log(`   ❌ Missing person2 data`);
                }
            }
        }
        else {
            console.log(`   ❌ No params at all!`);
        }
    });
}
checkJobParams().catch(err => {
    console.error('❌ Fatal error:', err);
    process.exit(1);
});
//# sourceMappingURL=checkJobParams.js.map