"use strict";
/**
 * FIND ORPHANED FILES IN STORAGE
 *
 * Finds files in Supabase Storage that are not in the database.
 * This helps identify what's consuming extra storage space.
 *
 * Usage:
 *   npx ts-node src/scripts/findOrphanedFiles.ts
 */
Object.defineProperty(exports, "__esModule", { value: true });
const supabaseClient_1 = require("../services/supabaseClient");
const dotenv_1 = require("dotenv");
const path_1 = require("path");
(0, dotenv_1.config)({ path: (0, path_1.join)(__dirname, '../../.env') });
/**
 * Recursively list all files in a bucket
 */
async function listAllFiles(supabase, bucketName, folderPath = '', allFiles = []) {
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
            const subFiles = await listAllFiles(supabase, bucketName, fullPath, []);
            allFiles.push(...subFiles);
        }
        else {
            // This is a file
            allFiles.push(fullPath);
        }
    }
    return allFiles;
}
async function findOrphanedFiles() {
    const supabase = (0, supabaseClient_1.createSupabaseServiceClient)();
    if (!supabase) {
        console.error('❌ Supabase not configured');
        process.exit(1);
    }
    console.log('🔍 FINDING ORPHANED FILES IN STORAGE');
    console.log('═══════════════════════════════════════════════════════════\n');
    try {
        // 1. Get all storage paths from database
        console.log('📊 Step 1: Fetching artifact paths from database...');
        const { data: artifacts, error } = await supabase
            .from('job_artifacts')
            .select('storage_path, bucket_name')
            .not('storage_path', 'is', null);
        if (error) {
            console.error('❌ Error:', error);
            throw error;
        }
        const dbPaths = new Set(artifacts?.map((a) => a.storage_path) || []);
        console.log(`   ✅ Found ${dbPaths.size} artifact paths in database\n`);
        // 2. List all files in job-artifacts bucket
        console.log('📊 Step 2: Listing all files in job-artifacts bucket...');
        console.log('   (This may take a while for large buckets...)\n');
        const storageFiles = await listAllFiles(supabase, 'job-artifacts');
        console.log(`   ✅ Found ${storageFiles.length} file(s) in storage\n`);
        // 3. Find orphaned files (in storage but not in database)
        console.log('📊 Step 3: Finding orphaned files...\n');
        const orphanedFiles = storageFiles.filter(path => !dbPaths.has(path));
        if (orphanedFiles.length === 0) {
            console.log('✅ No orphaned files found - all storage files are in database');
        }
        else {
            console.log(`⚠️  Found ${orphanedFiles.length} orphaned file(s)!\n`);
            console.log('📋 Orphaned files (first 50):');
            for (let i = 0; i < Math.min(50, orphanedFiles.length); i++) {
                console.log(`   ${i + 1}. ${orphanedFiles[i]}`);
            }
            if (orphanedFiles.length > 50) {
                console.log(`   ... and ${orphanedFiles.length - 50} more`);
            }
            // Calculate potential size (approximate)
            console.log(`\n💾 These ${orphanedFiles.length} files are taking up space but not tracked in database`);
            console.log('   They may be consuming significant storage space.');
        }
        console.log('\n═══════════════════════════════════════════════════════════');
        console.log(`📊 SUMMARY:`);
        console.log(`   Database artifacts: ${dbPaths.size}`);
        console.log(`   Storage files: ${storageFiles.length}`);
        console.log(`   Orphaned files: ${orphanedFiles.length}`);
        console.log(`   Difference: ${storageFiles.length - dbPaths.size} files`);
        console.log('═══════════════════════════════════════════════════════════\n');
    }
    catch (error) {
        console.error('❌ Fatal error:', error);
        process.exit(1);
    }
}
// Run the script
findOrphanedFiles().catch(err => {
    console.error('❌ Fatal error:', err);
    process.exit(1);
});
//# sourceMappingURL=findOrphanedFiles.js.map