"use strict";
/**
 * CLEANUP STUCK JOBS
 *
 * Delete orphaned jobs and tasks that are stuck in processing
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
const supabase_js_1 = require("@supabase/supabase-js");
const dotenv = __importStar(require("dotenv"));
const path = __importStar(require("path"));
// Load environment variables
dotenv.config({ path: path.join(__dirname, '../../.env') });
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!supabaseUrl || !supabaseKey) {
    console.error('❌ Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
    process.exit(1);
}
const supabase = (0, supabase_js_1.createClient)(supabaseUrl, supabaseKey);
async function cleanup() {
    console.log('🧹 Cleaning up stuck jobs...\n');
    // Find all jobs stuck in processing for more than 10 minutes
    const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000).toISOString();
    const { data: stuckJobs, error: stuckError } = await supabase
        .from('jobs')
        .select('id, status, type, created_at')
        .eq('status', 'processing')
        .lt('created_at', tenMinutesAgo);
    if (stuckError) {
        console.error('❌ Error fetching stuck jobs:', stuckError);
        return;
    }
    if (!stuckJobs || stuckJobs.length === 0) {
        console.log('✅ No stuck jobs found!');
        return;
    }
    console.log(`⚠️  Found ${stuckJobs.length} stuck jobs:\n`);
    stuckJobs.forEach((job) => {
        const age = Math.round((Date.now() - new Date(job.created_at).getTime()) / 1000 / 60);
        console.log(`  - ${job.id} (${job.type}) - ${age} minutes old`);
    });
    console.log('\n🗑️  Deleting...\n');
    // Delete artifacts
    for (const job of stuckJobs) {
        const { error: artifactsError } = await supabase
            .from('job_artifacts')
            .delete()
            .eq('job_id', job.id);
        if (artifactsError) {
            console.error(`❌ Error deleting artifacts for ${job.id}:`, artifactsError);
        }
        else {
            console.log(`  ✅ Deleted artifacts for ${job.id}`);
        }
    }
    // Delete tasks
    for (const job of stuckJobs) {
        const { error: tasksError } = await supabase
            .from('job_tasks')
            .delete()
            .eq('job_id', job.id);
        if (tasksError) {
            console.error(`❌ Error deleting tasks for ${job.id}:`, tasksError);
        }
        else {
            console.log(`  ✅ Deleted tasks for ${job.id}`);
        }
    }
    // Delete jobs
    const jobIds = stuckJobs.map((job) => job.id);
    const { error: jobsError } = await supabase
        .from('jobs')
        .delete()
        .in('id', jobIds);
    if (jobsError) {
        console.error('❌ Error deleting jobs:', jobsError);
    }
    else {
        console.log(`  ✅ Deleted ${jobIds.length} jobs`);
    }
    console.log('\n✅ Cleanup complete!');
}
cleanup().catch(console.error);
//# sourceMappingURL=cleanupStuckJobs.js.map