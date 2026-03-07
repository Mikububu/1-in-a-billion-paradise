"use strict";
/**
 * DOWNLOAD ALL READINGS TO DESKTOP (FLAT)
 *
 * Downloads all audio, songs, and PDFs from Supabase storage
 * directly to Desktop folder - NO subfolders, just flat files.
 *
 * Lists bucket directly (files may not be in job_artifacts table)
 *
 * RUN: npx ts-node src/scripts/downloadAllToDesktop.ts
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
async function downloadFile(supabase, bucket, storagePath, localPath) {
    try {
        const { data, error } = await supabase.storage.from(bucket).download(storagePath);
        if (error) {
            console.error(`   ❌ ${path_2.default.basename(storagePath)}: ${error.message}`);
            return false;
        }
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
async function listAllFilesInBucket(supabase, bucket, prefix = '') {
    const allFiles = [];
    try {
        const { data, error } = await supabase.storage.from(bucket).list(prefix, { limit: 1000 });
        if (error) {
            console.log(`   ⚠️ ${bucket}/${prefix}: ${error.message}`);
            return [];
        }
        for (const item of data || []) {
            const fullPath = prefix ? `${prefix}/${item.name}` : item.name;
            if (item.id === null) {
                // It's a folder - recurse
                const subFiles = await listAllFilesInBucket(supabase, bucket, fullPath);
                allFiles.push(...subFiles);
            }
            else {
                // It's a file
                allFiles.push(fullPath);
            }
        }
    }
    catch (err) {
        console.log(`   ⚠️ Error listing ${bucket}: ${err.message}`);
    }
    return allFiles;
}
async function downloadAllToDesktop() {
    const supabase = (0, supabaseClient_1.createSupabaseServiceClient)();
    if (!supabase) {
        console.error('❌ Supabase not configured');
        process.exit(1);
    }
    console.log('');
    console.log('═══════════════════════════════════════════════════════════════════');
    console.log('📥 DOWNLOAD ALL READINGS TO DESKTOP (FLAT - NO FOLDERS)');
    console.log('═══════════════════════════════════════════════════════════════════');
    console.log(`📁 Output: ${OUTPUT_DIR}`);
    console.log('');
    // Focus on job-artifacts bucket
    const bucket = 'job-artifacts';
    console.log(`📂 Scanning bucket: ${bucket}`);
    const files = await listAllFilesInBucket(supabase, bucket);
    // Filter to media files
    const mediaExtensions = ['.m4a', '.mp3', '.wav', '.pdf'];
    const mediaFiles = files.filter(f => mediaExtensions.some(ext => f.toLowerCase().endsWith(ext)));
    if (mediaFiles.length === 0) {
        console.log('   No media files found');
        console.log('');
        console.log('═══════════════════════════════════════════════════════════════════');
        console.log('No files to download');
        console.log('═══════════════════════════════════════════════════════════════════');
        return;
    }
    console.log(`   Found ${mediaFiles.length} media file(s)`);
    console.log('');
    let totalDownloaded = 0;
    let totalFailed = 0;
    const downloadedNames = new Set();
    for (const storagePath of mediaFiles) {
        let fileName = path_2.default.basename(storagePath);
        // Make filename unique if already exists
        if (downloadedNames.has(fileName)) {
            const ext = path_2.default.extname(fileName);
            const base = path_2.default.basename(fileName, ext);
            let counter = 1;
            while (downloadedNames.has(`${base}_${counter}${ext}`)) {
                counter++;
            }
            fileName = `${base}_${counter}${ext}`;
        }
        downloadedNames.add(fileName);
        const localPath = path_2.default.join(OUTPUT_DIR, fileName);
        process.stdout.write(`   📥 ${fileName}... `);
        const success = await downloadFile(supabase, bucket, storagePath, localPath);
        if (success) {
            totalDownloaded++;
            console.log('✅');
        }
        else {
            totalFailed++;
            console.log('❌');
        }
    }
    console.log('');
    console.log('═══════════════════════════════════════════════════════════════════');
    console.log('🎉 DOWNLOAD COMPLETE!');
    console.log(`   ✅ Downloaded: ${totalDownloaded} file(s)`);
    console.log(`   ❌ Failed: ${totalFailed} file(s)`);
    console.log(`   📁 Location: ${OUTPUT_DIR}`);
    console.log('═══════════════════════════════════════════════════════════════════');
    console.log('');
}
downloadAllToDesktop().catch(err => {
    console.error('❌ Fatal error:', err);
    process.exit(1);
});
//# sourceMappingURL=downloadAllToDesktop.js.map