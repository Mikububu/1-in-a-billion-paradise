"use strict";
/**
 * CHECK VOICE SAMPLES SIZE
 *
 * Checks the voice-samples bucket size - this might be consuming lots of storage.
 */
Object.defineProperty(exports, "__esModule", { value: true });
const supabaseClient_1 = require("../services/supabaseClient");
const dotenv_1 = require("dotenv");
const path_1 = require("path");
(0, dotenv_1.config)({ path: (0, path_1.join)(__dirname, '../../.env') });
async function listAllFilesRecursive(supabase, bucketName, folderPath = '', allFiles = []) {
    const { data: files, error } = await supabase.storage
        .from(bucketName)
        .list(folderPath, {
        limit: 1000,
        offset: 0,
        sortBy: { column: 'name', order: 'asc' }
    });
    if (error) {
        console.warn(`⚠️  Error listing ${bucketName}/${folderPath}:`, error.message);
        return allFiles;
    }
    if (!files || files.length === 0) {
        return allFiles;
    }
    for (const file of files) {
        const fullPath = folderPath ? `${folderPath}/${file.name}` : file.name;
        if (file.id === null) {
            // This is a folder, recurse into it
            const subFiles = await listAllFilesRecursive(supabase, bucketName, fullPath, []);
            allFiles.push(...subFiles);
        }
        else {
            // This is a file
            allFiles.push({ path: fullPath, size: file.metadata?.size || 0, name: file.name });
        }
    }
    return allFiles;
}
async function checkVoiceSamplesSize() {
    const supabase = (0, supabaseClient_1.createSupabaseServiceClient)();
    if (!supabase) {
        console.error('❌ Supabase not configured');
        process.exit(1);
    }
    console.log('🔍 CHECKING VOICE SAMPLES BUCKET SIZE');
    console.log('═══════════════════════════════════════════════════════════\n');
    try {
        console.log('📊 Listing all files in voice-samples bucket...\n');
        const files = await listAllFilesRecursive(supabase, 'voice-samples');
        if (files.length === 0) {
            console.log('✅ No files found in voice-samples bucket');
            return;
        }
        console.log(`✅ Found ${files.length} file(s)\n`);
        // Calculate total size
        let totalBytes = 0;
        for (const file of files) {
            totalBytes += file.size || 0;
        }
        const totalMB = totalBytes / (1024 * 1024);
        const totalGB = totalMB / 1024;
        console.log(`📊 Total size: ${totalMB.toFixed(2)} MB (${totalGB.toFixed(2)} GB)\n`);
        // Group by folder (voice name)
        const byFolder = {};
        for (const file of files) {
            const folder = file.path.split('/')[0] || 'root';
            if (!byFolder[folder]) {
                byFolder[folder] = { count: 0, totalBytes: 0, files: [] };
            }
            byFolder[folder].count++;
            byFolder[folder].totalBytes += file.size || 0;
            byFolder[folder].files.push(file);
        }
        console.log('📋 Size by voice folder:');
        console.log('─────────────────────────────────────────────────────────────');
        const sorted = Object.entries(byFolder).sort((a, b) => b[1].totalBytes - a[1].totalBytes);
        for (const [folder, stats] of sorted) {
            const totalMB = stats.totalBytes / (1024 * 1024);
            const totalGB = totalMB / 1024;
            const avgSizeMB = stats.totalBytes > 0 ? (stats.totalBytes / stats.count) / (1024 * 1024) : 0;
            console.log(`${folder.padEnd(20)} | ${stats.count.toString().padStart(6)} files | ${totalMB.toFixed(2).padStart(10)} MB (${totalGB.toFixed(2)} GB) | Avg: ${avgSizeMB.toFixed(2)} MB`);
            // Show largest files
            const largest = [...stats.files]
                .sort((a, b) => (b.size || 0) - (a.size || 0))
                .slice(0, 5);
            if (largest.length > 0) {
                console.log(`   Top 5 largest:`);
                for (const file of largest) {
                    const sizeMB = (file.size || 0) / (1024 * 1024);
                    console.log(`     - ${file.name}: ${sizeMB.toFixed(2)} MB`);
                }
            }
            console.log('');
        }
        console.log('═══════════════════════════════════════════════════════════\n');
    }
    catch (error) {
        console.error('❌ Fatal error:', error);
        process.exit(1);
    }
}
checkVoiceSamplesSize().catch(err => {
    console.error('❌ Fatal error:', err);
    process.exit(1);
});
//# sourceMappingURL=checkVoiceSamplesSize.js.map