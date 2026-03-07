"use strict";
/**
 * DOWNLOAD ALL READINGS MEDIA (Complete Version)
 *
 * Downloads all reading media files and continues even if some fail.
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
async function ensureOutputDir() {
    await promises_1.default.mkdir(OUTPUT_DIR, { recursive: true });
}
async function downloadFile(supabase, bucket, storagePath, localPath) {
    try {
        const { data, error } = await supabase.storage.from(bucket).download(storagePath);
        if (error) {
            console.error(`   ❌ ${path_2.default.basename(storagePath)}: ${error.message}`);
            return false;
        }
        const dir = path_2.default.dirname(localPath);
        await promises_1.default.mkdir(dir, { recursive: true });
        const arrayBuffer = await data.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);
        await promises_1.default.writeFile(localPath, buffer);
        return true;
    }
    catch (error) {
        console.error(`   ❌ ${path_2.default.basename(storagePath)}: ${error.message}`);
        return false;
    }
}
async function downloadCompleteMedia() {
    const supabase = (0, supabaseClient_1.createSupabaseServiceClient)();
    if (!supabase) {
        console.error('❌ Supabase not configured');
        process.exit(1);
    }
    console.log('📥 DOWNLOADING ALL READINGS MEDIA');
    console.log('═══════════════════════════════════════════════════════════\n');
    await ensureOutputDir();
    console.log(`📁 Output: ${OUTPUT_DIR}\n`);
    try {
        const { data: artifacts, error } = await supabase
            .from('job_artifacts')
            .select('id, job_id, artifact_type, storage_path, bucket_name, file_size_bytes, created_at')
            .not('storage_path', 'is', null)
            .in('artifact_type', ['pdf', 'audio_mp3', 'audio_m4a', 'audio_song'])
            .order('created_at', { ascending: false });
        if (error)
            throw error;
        if (!artifacts || artifacts.length === 0) {
            console.log('✅ No media artifacts found');
            return;
        }
        console.log(`✅ Found ${artifacts.length} media artifact(s)\n`);
        const jobIds = [...new Set(artifacts.map((a) => a.job_id))];
        const { data: jobs, error: jobsError } = await supabase
            .from('jobs')
            .select('id, user_id, params, created_at')
            .in('id', jobIds);
        if (jobsError)
            throw jobsError;
        const jobMap = new Map((jobs || []).map((j) => [j.id, j]));
        const byUser = {};
        for (const artifact of artifacts) {
            const job = jobMap.get(artifact.job_id);
            const userId = job?.user_id || 'unknown';
            if (!byUser[userId])
                byUser[userId] = [];
            byUser[userId].push({ ...artifact, job });
        }
        let totalDownloaded = 0;
        let totalFailed = 0;
        let totalBytes = 0;
        for (const [userId, userArtifacts] of Object.entries(byUser)) {
            console.log(`👤 User: ${userId} (${userArtifacts.length} files)`);
            const userDir = path_2.default.join(OUTPUT_DIR, userId);
            for (const artifact of userArtifacts) {
                const bucket = artifact.bucket_name || 'job-artifacts';
                const storagePath = artifact.storage_path;
                const fileName = path_2.default.basename(storagePath);
                const typeDir = path_2.default.join(userDir, artifact.artifact_type);
                const localPath = path_2.default.join(typeDir, fileName);
                const sizeMB = (artifact.file_size_bytes || 0) / (1024 * 1024);
                process.stdout.write(`   📥 ${fileName} (${sizeMB.toFixed(2)} MB)... `);
                const success = await downloadFile(supabase, bucket, storagePath, localPath);
                if (success) {
                    totalDownloaded++;
                    totalBytes += artifact.file_size_bytes || 0;
                    console.log('✅');
                }
                else {
                    totalFailed++;
                    console.log('❌');
                }
            }
            console.log('');
        }
        const totalMB = totalBytes / (1024 * 1024);
        const totalGB = totalMB / 1024;
        console.log('═══════════════════════════════════════════════════════════');
        console.log('🎉 DOWNLOAD COMPLETE!');
        console.log(`   ✅ Downloaded: ${totalDownloaded} file(s)`);
        console.log(`   ❌ Failed: ${totalFailed} file(s)`);
        console.log(`   💾 Total size: ${totalMB.toFixed(2)} MB (${totalGB.toFixed(2)} GB)`);
        console.log(`   📁 Location: ${OUTPUT_DIR}`);
        console.log('═══════════════════════════════════════════════════════════\n');
    }
    catch (error) {
        console.error('❌ Fatal error:', error);
        process.exit(1);
    }
}
downloadCompleteMedia().catch(err => {
    console.error('❌ Fatal error:', err);
    process.exit(1);
});
//# sourceMappingURL=downloadCompleteMedia.js.map