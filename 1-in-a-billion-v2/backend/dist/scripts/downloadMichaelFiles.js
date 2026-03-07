"use strict";
/**
 * DOWNLOAD MICHAEL FILES
 *
 * Downloads all missing Michael files.
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
        console.log(`   📥 Downloading: ${path_2.default.basename(storagePath)}...`);
        const { data, error } = await supabase.storage.from(bucket).download(storagePath);
        if (error) {
            console.error(`      ❌ Error: ${error.message}`);
            return false;
        }
        const dir = path_2.default.dirname(localPath);
        await promises_1.default.mkdir(dir, { recursive: true });
        const arrayBuffer = await data.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);
        await promises_1.default.writeFile(localPath, buffer);
        const sizeMB = (buffer.length / (1024 * 1024)).toFixed(2);
        console.log(`      ✅ Downloaded (${sizeMB} MB)`);
        return true;
    }
    catch (error) {
        console.error(`      ❌ Error: ${error.message}`);
        return false;
    }
}
async function downloadMichaelFiles() {
    const supabase = (0, supabaseClient_1.createSupabaseServiceClient)();
    if (!supabase) {
        console.error('❌ Supabase not configured');
        process.exit(1);
    }
    console.log('📥 DOWNLOADING MICHAEL FILES');
    console.log('═══════════════════════════════════════════════════════════\n');
    await ensureOutputDir();
    try {
        // Get all media artifacts
        const { data: artifacts, error } = await supabase
            .from('job_artifacts')
            .select('id, job_id, artifact_type, storage_path, bucket_name, file_size_bytes')
            .in('artifact_type', ['pdf', 'audio_mp3', 'audio_m4a', 'audio_song'])
            .not('storage_path', 'is', null);
        if (error)
            throw error;
        // Find Michael files
        const michaelFiles = artifacts?.filter((a) => {
            const fileName = a.storage_path.split('/').pop().toLowerCase();
            return fileName.includes('michael') || fileName.includes('person_2');
        }) || [];
        console.log(`✅ Found ${michaelFiles.length} Michael-related file(s) in database\n`);
        if (michaelFiles.length === 0) {
            console.log('❌ No Michael files found in database!');
            return;
        }
        // Check what's missing
        const userDir = path_2.default.join(OUTPUT_DIR, 'e34061de-755c-4b5e-9b0d-a6c7aa8bddc2');
        const missingFiles = [];
        for (const file of michaelFiles) {
            const fileName = file.storage_path.split('/').pop();
            const typeDir = path_2.default.join(userDir, file.artifact_type);
            const localPath = path_2.default.join(typeDir, fileName);
            try {
                await promises_1.default.access(localPath);
                // File exists
            }
            catch {
                // File missing
                missingFiles.push(file);
            }
        }
        console.log(`📊 Missing files: ${missingFiles.length} out of ${michaelFiles.length}\n`);
        if (missingFiles.length === 0) {
            console.log('✅ All Michael files are already downloaded!');
            return;
        }
        // Download missing files
        console.log('📥 Downloading missing files...\n');
        let downloaded = 0;
        let failed = 0;
        for (let i = 0; i < missingFiles.length; i++) {
            const file = missingFiles[i];
            const fileName = file.storage_path.split('/').pop();
            const bucket = file.bucket_name || 'job-artifacts';
            const typeDir = path_2.default.join(userDir, file.artifact_type);
            const localPath = path_2.default.join(typeDir, fileName);
            console.log(`[${i + 1}/${missingFiles.length}] ${fileName}`);
            const success = await downloadFile(supabase, bucket, file.storage_path, localPath);
            if (success) {
                downloaded++;
            }
            else {
                failed++;
            }
        }
        console.log('\n═══════════════════════════════════════════════════════════');
        console.log('🎉 DOWNLOAD COMPLETE!');
        console.log(`   ✅ Downloaded: ${downloaded} file(s)`);
        console.log(`   ❌ Failed: ${failed} file(s)`);
        console.log('═══════════════════════════════════════════════════════════\n');
    }
    catch (error) {
        console.error('❌ Fatal error:', error);
        process.exit(1);
    }
}
downloadMichaelFiles().catch(err => {
    console.error('❌ Fatal error:', err);
    process.exit(1);
});
//# sourceMappingURL=downloadMichaelFiles.js.map