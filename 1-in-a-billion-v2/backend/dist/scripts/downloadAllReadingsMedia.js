"use strict";
/**
 * DOWNLOAD ALL READINGS MEDIA
 *
 * Downloads all reading media (PDFs, audio, songs) from Supabase Storage
 * to a local folder on the desktop.
 *
 * Usage:
 *   npx ts-node src/scripts/downloadAllReadingsMedia.ts
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
/**
 * Ensure output directory exists
 */
async function ensureOutputDir() {
    try {
        await promises_1.default.mkdir(OUTPUT_DIR, { recursive: true });
        console.log(`📁 Output directory: ${OUTPUT_DIR}`);
    }
    catch (error) {
        console.error('❌ Failed to create output directory:', error);
        throw error;
    }
}
/**
 * Download file from Supabase Storage
 */
async function downloadFile(supabase, bucket, storagePath, localPath) {
    try {
        const { data, error } = await supabase.storage
            .from(bucket)
            .download(storagePath);
        if (error) {
            console.error(`   ❌ Failed to download ${storagePath}:`, error.message);
            return false;
        }
        // Ensure directory exists
        const dir = path_2.default.dirname(localPath);
        await promises_1.default.mkdir(dir, { recursive: true });
        // Convert Blob to Buffer and save
        const arrayBuffer = await data.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);
        await promises_1.default.writeFile(localPath, buffer);
        return true;
    }
    catch (error) {
        console.error(`   ❌ Error downloading ${storagePath}:`, error.message);
        return false;
    }
}
/**
 * Download all reading media for a user
 */
async function downloadAllReadingsMedia() {
    const supabase = (0, supabaseClient_1.createSupabaseServiceClient)();
    if (!supabase) {
        console.error('❌ Supabase not configured');
        process.exit(1);
    }
    console.log('📥 DOWNLOADING ALL READINGS MEDIA');
    console.log('═══════════════════════════════════════════════════════════\n');
    await ensureOutputDir();
    try {
        // Get all artifacts from database (to know what files exist)
        console.log('📊 Fetching artifact list from database...');
        const { data: artifacts, error } = await supabase
            .from('job_artifacts')
            .select('id, job_id, artifact_type, storage_path, bucket_name, file_size_bytes, created_at')
            .not('storage_path', 'is', null)
            .in('artifact_type', ['pdf', 'audio_mp3', 'audio_m4a', 'audio_song'])
            .order('created_at', { ascending: false });
        if (error) {
            console.error('❌ Error fetching artifacts:', error);
            throw error;
        }
        if (!artifacts || artifacts.length === 0) {
            console.log('✅ No media artifacts found');
            return;
        }
        console.log(`✅ Found ${artifacts.length} media artifact(s)`);
        // Get job info to organize by user/job
        console.log('\n📋 Fetching job information...');
        const jobIds = [...new Set(artifacts.map((a) => a.job_id))];
        const { data: jobs, error: jobsError } = await supabase
            .from('jobs')
            .select('id, user_id, params, created_at')
            .in('id', jobIds);
        if (jobsError) {
            console.error('❌ Error fetching jobs:', jobsError);
            throw jobsError;
        }
        const jobMap = new Map((jobs || []).map((j) => [j.id, j]));
        console.log(`✅ Found ${jobs?.length || 0} job(s)`);
        // Group by user
        const byUser = {};
        for (const artifact of artifacts) {
            const job = jobMap.get(artifact.job_id);
            const userId = job?.user_id || 'unknown';
            if (!byUser[userId]) {
                byUser[userId] = [];
            }
            byUser[userId].push({ ...artifact, job });
        }
        console.log(`\n📊 Organizing by ${Object.keys(byUser).length} user(s)...\n`);
        // Download files
        let totalDownloaded = 0;
        let totalFailed = 0;
        let totalBytes = 0;
        for (const [userId, userArtifacts] of Object.entries(byUser)) {
            console.log(`👤 User: ${userId} (${userArtifacts.length} files)`);
            const userDir = path_2.default.join(OUTPUT_DIR, userId);
            await promises_1.default.mkdir(userDir, { recursive: true });
            for (const artifact of userArtifacts) {
                const bucket = artifact.bucket_name || 'job-artifacts';
                const storagePath = artifact.storage_path;
                const fileName = path_2.default.basename(storagePath);
                // Create subdirectory by artifact type
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
        // Summary
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
// Run the script
downloadAllReadingsMedia().catch(err => {
    console.error('❌ Fatal error:', err);
    process.exit(1);
});
//# sourceMappingURL=downloadAllReadingsMedia.js.map