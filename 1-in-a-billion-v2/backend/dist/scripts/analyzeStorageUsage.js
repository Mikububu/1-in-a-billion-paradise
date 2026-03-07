"use strict";
/**
 * ANALYZE STORAGE USAGE
 *
 * Analyzes Supabase Storage usage to identify what's consuming space.
 *
 * Usage:
 *   npx ts-node src/scripts/analyzeStorageUsage.ts
 */
Object.defineProperty(exports, "__esModule", { value: true });
const supabaseClient_1 = require("../services/supabaseClient");
const dotenv_1 = require("dotenv");
const path_1 = require("path");
(0, dotenv_1.config)({ path: (0, path_1.join)(__dirname, '../../.env') });
/**
 * Recursively list all files in a bucket with sizes
 */
async function listAllFilesWithSizes(supabase, bucketName, folderPath = '', allFiles = []) {
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
            const subFiles = await listAllFilesWithSizes(supabase, bucketName, fullPath, []);
            allFiles.push(...subFiles);
        }
        else {
            // This is a file - get its metadata for size
            const { data: metadata } = await supabase.storage
                .from(bucketName)
                .list(fullPath.split('/').slice(0, -1).join('/'), {
                search: file.name
            });
            const fileSize = file.metadata?.size || 0;
            allFiles.push({
                path: fullPath,
                size: fileSize,
                metadata: file.metadata
            });
        }
    }
    return allFiles;
}
/**
 * Get storage usage from job_artifacts table
 */
async function getStorageUsageFromDatabase(supabase) {
    console.log('\n📊 Analyzing storage usage from database...');
    // Get total count and size by artifact type
    const { data: artifacts, error } = await supabase
        .from('job_artifacts')
        .select('artifact_type, file_size_bytes')
        .not('file_size_bytes', 'is', null);
    if (error) {
        console.error('❌ Error querying artifacts:', error);
        return;
    }
    if (!artifacts || artifacts.length === 0) {
        console.log('   No artifacts found in database');
        return;
    }
    console.log(`\n✅ Found ${artifacts.length} artifact records in database`);
    // Group by type
    const byType = {};
    for (const artifact of artifacts) {
        const type = artifact.artifact_type || 'unknown';
        const size = artifact.file_size_bytes || 0;
        if (!byType[type]) {
            byType[type] = { count: 0, totalBytes: 0 };
        }
        byType[type].count++;
        byType[type].totalBytes += size;
    }
    // Display summary
    console.log('\n📋 Storage usage by artifact type:');
    console.log('─────────────────────────────────────────────────────────────');
    let totalBytes = 0;
    const sorted = Object.entries(byType).sort((a, b) => b[1].totalBytes - a[1].totalBytes);
    for (const [type, stats] of sorted) {
        const totalMB = stats.totalBytes / (1024 * 1024);
        const totalGB = totalMB / 1024;
        const avgSizeMB = (stats.totalBytes / stats.count) / (1024 * 1024);
        totalBytes += stats.totalBytes;
        console.log(`${type.padEnd(20)} | ${stats.count.toString().padStart(6)} files | ${totalMB.toFixed(2).padStart(10)} MB (${totalGB.toFixed(2)} GB) | Avg: ${avgSizeMB.toFixed(2)} MB`);
    }
    const totalMB = totalBytes / (1024 * 1024);
    const totalGB = totalMB / 1024;
    console.log('─────────────────────────────────────────────────────────────');
    console.log(`TOTAL                  | ${artifacts.length.toString().padStart(6)} files | ${totalMB.toFixed(2).padStart(10)} MB (${totalGB.toFixed(2)} GB)`);
    return { byType, totalBytes, totalMB, totalGB };
}
/**
 * Check for orphaned files (files in storage but not in database)
 */
async function checkOrphanedFiles(supabase) {
    console.log('\n🔍 Checking for orphaned files (in storage but not in database)...');
    // Get all storage paths from database
    const { data: artifacts, error } = await supabase
        .from('job_artifacts')
        .select('storage_path, bucket_name')
        .not('storage_path', 'is', null);
    if (error) {
        console.error('❌ Error querying artifacts:', error);
        return;
    }
    const dbPaths = new Set(artifacts?.map((a) => a.storage_path) || []);
    console.log(`   Database has ${dbPaths.size} artifact paths recorded`);
    // List all files in job-artifacts bucket
    console.log('   Listing all files in job-artifacts bucket...');
    const { data: allFiles, error: listError } = await supabase.storage
        .from('job-artifacts')
        .list('', {
        limit: 10000,
        sortBy: { column: 'name', order: 'asc' }
    });
    if (listError) {
        console.error('❌ Error listing storage files:', listError);
        return;
    }
    // Note: This is a simplified check - Supabase storage listing is hierarchical
    // For a complete check, you'd need to recursively list all folders
    console.log(`   Storage bucket has ${allFiles?.length || 0} top-level items`);
    console.log('   ⚠️  Note: Complete orphaned file check requires recursive listing');
}
/**
 * Main function
 */
async function analyzeStorageUsage() {
    const supabase = (0, supabaseClient_1.createSupabaseServiceClient)();
    if (!supabase) {
        console.error('❌ Supabase not configured');
        console.error('   Make sure SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are set');
        process.exit(1);
    }
    console.log('📊 STORAGE USAGE ANALYSIS');
    console.log('═══════════════════════════════════════════════════════════\n');
    try {
        // Analyze from database (most accurate)
        const dbStats = await getStorageUsageFromDatabase(supabase);
        // Check for orphaned files
        await checkOrphanedFiles(supabase);
        console.log('\n═══════════════════════════════════════════════════════════');
        console.log('💡 RECOMMENDATIONS:');
        console.log('═══════════════════════════════════════════════════════════');
        if (dbStats && dbStats.totalGB > 1) {
            console.log(`⚠️  You're using ${dbStats.totalGB.toFixed(2)} GB of storage`);
            console.log(`   Your quota is 1.1 GB, so you're over by ${(dbStats.totalGB - 1.1).toFixed(2)} GB`);
            console.log('');
            console.log('   Options:');
            console.log('   1. Delete old artifacts (run cleanup script)');
            console.log('   2. Upgrade to Pro plan for more storage');
            console.log('   3. Archive old readings to external storage');
        }
        console.log('═══════════════════════════════════════════════════════════\n');
    }
    catch (error) {
        console.error('❌ Fatal error:', error);
        process.exit(1);
    }
}
// Run the script
analyzeStorageUsage().catch(err => {
    console.error('❌ Fatal error:', err);
    process.exit(1);
});
//# sourceMappingURL=analyzeStorageUsage.js.map