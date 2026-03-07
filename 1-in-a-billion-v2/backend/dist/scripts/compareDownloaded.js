"use strict";
/**
 * COMPARE DOWNLOADED FILES
 *
 * Compares database files with what's actually downloaded.
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const supabaseClient_1 = require("../services/supabaseClient");
const dotenv_1 = require("dotenv");
const path_1 = require("path");
const promises_1 = __importDefault(require("fs/promises"));
const path_2 = __importDefault(require("path"));
(0, dotenv_1.config)({ path: (0, path_1.join)(__dirname, '../../.env') });
const PROJECT_ROOT = path_2.default.resolve(__dirname, '../../..');
const OUTPUT_DIR = process.env.MEDIA_OUT_DIR || path_2.default.join(PROJECT_ROOT, 'runtime', 'media');
async function compareDownloaded() {
    const supabase = (0, supabaseClient_1.createSupabaseServiceClient)();
    if (!supabase) {
        console.error('❌ Supabase not configured');
        process.exit(1);
    }
    console.log('🔍 COMPARING DATABASE VS DOWNLOADED');
    console.log('═══════════════════════════════════════════════════════════\n');
    try {
        // Get all media artifacts from database
        const { data: artifacts, error } = await supabase
            .from('job_artifacts')
            .select('id, job_id, artifact_type, storage_path, bucket_name, file_size_bytes')
            .in('artifact_type', ['pdf', 'audio_mp3', 'audio_m4a', 'audio_song'])
            .not('storage_path', 'is', null)
            .order('artifact_type', { ascending: true })
            .order('storage_path', { ascending: true });
        if (error)
            throw error;
        console.log(`📊 Total files in database: ${artifacts?.length || 0}\n`);
        // Group by user
        const { data: jobs, error: jobsError } = await supabase
            .from('jobs')
            .select('id, user_id')
            .in('id', [...new Set(artifacts?.map((a) => a.job_id) || [])]);
        if (jobsError)
            throw jobsError;
        const jobMap = new Map((jobs || []).map((j) => [j.id, j]));
        const byUser = {};
        for (const artifact of artifacts || []) {
            const job = jobMap.get(artifact.job_id);
            const userId = job?.user_id || 'unknown';
            if (!byUser[userId])
                byUser[userId] = [];
            byUser[userId].push({ ...artifact, job });
        }
        // Check each user's files
        for (const [userId, userArtifacts] of Object.entries(byUser)) {
            console.log(`👤 User: ${userId}`);
            console.log(`   Files in database: ${userArtifacts.length}\n`);
            const userDir = path_2.default.join(OUTPUT_DIR, userId);
            // Check by type
            const byType = {};
            for (const artifact of userArtifacts) {
                const type = artifact.artifact_type || 'unknown';
                if (!byType[type])
                    byType[type] = [];
                byType[type].push(artifact);
            }
            let totalMissing = 0;
            let totalDownloaded = 0;
            for (const [type, files] of Object.entries(byType)) {
                const typeDir = path_2.default.join(userDir, type);
                let downloadedFiles = [];
                try {
                    downloadedFiles = await promises_1.default.readdir(typeDir);
                }
                catch {
                    // Directory doesn't exist
                }
                const missing = [];
                const downloaded = [];
                for (const file of files) {
                    const fileName = file.storage_path.split('/').pop();
                    if (downloadedFiles.includes(fileName)) {
                        downloaded.push(file);
                    }
                    else {
                        missing.push(file);
                    }
                }
                totalDownloaded += downloaded.length;
                totalMissing += missing.length;
                console.log(`   📁 ${type.toUpperCase()}:`);
                console.log(`      ✅ Downloaded: ${downloaded.length}/${files.length}`);
                console.log(`      ❌ Missing: ${missing.length}/${files.length}`);
                if (missing.length > 0) {
                    console.log(`\n      Missing files:`);
                    for (const file of missing.slice(0, 10)) {
                        const fileName = file.storage_path.split('/').pop();
                        const sizeMB = (file.file_size_bytes || 0) / (1024 * 1024);
                        console.log(`        ❌ ${fileName} (${sizeMB.toFixed(2)} MB)`);
                    }
                    if (missing.length > 10) {
                        console.log(`        ... and ${missing.length - 10} more`);
                    }
                }
                console.log('');
            }
            console.log(`   📊 SUMMARY:`);
            console.log(`      ✅ Downloaded: ${totalDownloaded}/${userArtifacts.length}`);
            console.log(`      ❌ Missing: ${totalMissing}/${userArtifacts.length}`);
            console.log('');
        }
        console.log('═══════════════════════════════════════════════════════════\n');
    }
    catch (error) {
        console.error('❌ Fatal error:', error);
        process.exit(1);
    }
}
compareDownloaded().catch(err => {
    console.error('❌ Fatal error:', err);
    process.exit(1);
});
//# sourceMappingURL=compareDownloaded.js.map