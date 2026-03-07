"use strict";
/**
 * CHECK MICHAEL FILES
 *
 * Lists all Michael files in database and checks what's downloaded.
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
async function checkMichaelFiles() {
    const supabase = (0, supabaseClient_1.createSupabaseServiceClient)();
    if (!supabase) {
        console.error('❌ Supabase not configured');
        process.exit(1);
    }
    console.log('🔍 CHECKING MICHAEL FILES');
    console.log('═══════════════════════════════════════════════════════════\n');
    try {
        // Get all media artifacts
        const { data: artifacts, error } = await supabase
            .from('job_artifacts')
            .select('id, job_id, artifact_type, storage_path, bucket_name, file_size_bytes')
            .in('artifact_type', ['pdf', 'audio_mp3', 'audio_m4a', 'audio_song'])
            .not('storage_path', 'is', null);
        if (error)
            throw error;
        // Find Michael files (Michael in filename, or Person_2 which might be Michael)
        const michaelFiles = artifacts?.filter((a) => {
            const fileName = a.storage_path.split('/').pop().toLowerCase();
            return fileName.includes('michael') || fileName.includes('person_2');
        }) || [];
        console.log(`📊 Total media artifacts: ${artifacts?.length || 0}`);
        console.log(`📊 Michael-related files in DB: ${michaelFiles.length}\n`);
        if (michaelFiles.length === 0) {
            console.log('❌ No Michael files found in database!');
            return;
        }
        // Group by type
        const byType = {};
        for (const file of michaelFiles) {
            const type = file.artifact_type || 'unknown';
            if (!byType[type])
                byType[type] = [];
            byType[type].push(file);
        }
        console.log('📋 Michael files by type:\n');
        for (const [type, files] of Object.entries(byType)) {
            console.log(`${type}: ${files.length} file(s)`);
            for (const file of files) {
                const fileName = file.storage_path.split('/').pop();
                const sizeMB = (file.file_size_bytes || 0) / (1024 * 1024);
                console.log(`  - ${fileName} (${sizeMB.toFixed(2)} MB)`);
            }
            console.log('');
        }
        // Check what's downloaded
        console.log('📥 Checking downloaded files...\n');
        const userDir = path_2.default.join(OUTPUT_DIR, 'e34061de-755c-4b5e-9b0d-a6c7aa8bddc2');
        for (const [type, files] of Object.entries(byType)) {
            console.log(`${type} files:`);
            const typeDir = path_2.default.join(userDir, type);
            try {
                const downloadedFiles = await promises_1.default.readdir(typeDir);
                for (const file of files) {
                    const fileName = file.storage_path.split('/').pop();
                    const isDownloaded = downloadedFiles.includes(fileName);
                    const status = isDownloaded ? '✅ Downloaded' : '❌ MISSING';
                    console.log(`  ${status}: ${fileName}`);
                    if (!isDownloaded) {
                        console.log(`     Storage path: ${file.storage_path}`);
                        console.log(`     Bucket: ${file.bucket_name || 'job-artifacts'}`);
                    }
                }
            }
            catch (err) {
                console.log(`  ⚠️  Directory ${typeDir} doesn't exist`);
                for (const file of files) {
                    const fileName = file.storage_path.split('/').pop();
                    console.log(`  ❌ MISSING: ${fileName}`);
                }
            }
            console.log('');
        }
        // Summary
        let totalDownloaded = 0;
        let totalMissing = 0;
        for (const [type, files] of Object.entries(byType)) {
            const typeDir = path_2.default.join(userDir, type);
            try {
                const downloadedFiles = await promises_1.default.readdir(typeDir);
                for (const file of files) {
                    const fileName = file.storage_path.split('/').pop();
                    if (downloadedFiles.includes(fileName)) {
                        totalDownloaded++;
                    }
                    else {
                        totalMissing++;
                    }
                }
            }
            catch {
                totalMissing += files.length;
            }
        }
        console.log('═══════════════════════════════════════════════════════════');
        console.log(`📊 SUMMARY:`);
        console.log(`   Total Michael files in DB: ${michaelFiles.length}`);
        console.log(`   ✅ Downloaded: ${totalDownloaded}`);
        console.log(`   ❌ Missing: ${totalMissing}`);
        console.log('═══════════════════════════════════════════════════════════\n');
    }
    catch (error) {
        console.error('❌ Fatal error:', error);
        process.exit(1);
    }
}
checkMichaelFiles().catch(err => {
    console.error('❌ Fatal error:', err);
    process.exit(1);
});
//# sourceMappingURL=checkMichaelFiles.js.map