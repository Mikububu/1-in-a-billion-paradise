"use strict";
/**
 * WIPE ALL STORAGE FILES
 *
 * ⚠️ DANGER: This script deletes ALL files from ALL Supabase storage buckets!
 *
 * This will:
 * 1. List all storage buckets
 * 2. Recursively list all files in each bucket
 * 3. Delete ALL files from ALL buckets
 *
 * Buckets that will be wiped:
 * - job-artifacts (PDFs, audio, text files)
 * - vedic-artifacts (vedic matchmaking audio)
 * - library (hook audio files)
 * - voice-samples (voice sample files)
 *
 * ⚠️ THIS IS IRREVERSIBLE! Make sure you have backups if needed.
 *
 * Usage:
 *   # Dry run (preview what would be deleted):
 *   npx ts-node src/scripts/wipeAllStorageFiles.ts --dry-run
 *
 *   # Actually delete (requires confirmation):
 *   npx ts-node src/scripts/wipeAllStorageFiles.ts --confirm
 */
Object.defineProperty(exports, "__esModule", { value: true });
const supabaseClient_1 = require("../services/supabaseClient");
const dotenv_1 = require("dotenv");
const path_1 = require("path");
(0, dotenv_1.config)({ path: (0, path_1.join)(__dirname, '../../.env') });
/**
 * Recursively list all files in a bucket folder
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
/**
 * Delete all files from a bucket
 */
async function deleteAllFilesFromBucket(supabase, bucketName, dryRun = false) {
    console.log(`\n📦 Processing bucket: ${bucketName}`);
    // List all files recursively
    console.log(`   📋 Listing all files...`);
    const allFiles = await listAllFiles(supabase, bucketName);
    if (allFiles.length === 0) {
        console.log(`   ✅ Bucket is empty`);
        return { deleted: 0, errors: 0, files: [] };
    }
    console.log(`   📊 Found ${allFiles.length} file(s)`);
    if (dryRun) {
        // Show sample files (first 10)
        console.log(`   📄 Sample files (showing first 10):`);
        allFiles.slice(0, 10).forEach((file, idx) => {
            console.log(`      ${idx + 1}. ${file}`);
        });
        if (allFiles.length > 10) {
            console.log(`      ... and ${allFiles.length - 10} more`);
        }
        return { deleted: 0, errors: 0, files: allFiles };
    }
    // Delete files in batches (Supabase has limits)
    const batchSize = 100;
    let deleted = 0;
    let errors = 0;
    for (let i = 0; i < allFiles.length; i += batchSize) {
        const batch = allFiles.slice(i, i + batchSize);
        const { error } = await supabase.storage
            .from(bucketName)
            .remove(batch);
        if (error) {
            console.error(`   ❌ Error deleting batch ${i / batchSize + 1}:`, error.message);
            errors += batch.length;
        }
        else {
            deleted += batch.length;
            console.log(`   ✅ Deleted batch ${i / batchSize + 1} (${deleted}/${allFiles.length} files)`);
        }
    }
    return { deleted, errors, files: allFiles };
}
/**
 * Main function
 */
async function wipeAllStorageFiles() {
    const supabase = (0, supabaseClient_1.createSupabaseServiceClient)();
    if (!supabase) {
        console.error('❌ Supabase not configured');
        console.error('   Make sure SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are set');
        process.exit(1);
    }
    // Check for flags
    const args = process.argv.slice(2);
    const dryRun = args.includes('--dry-run') || args.includes('--dryrun');
    const confirmed = args.includes('--confirm') || args.includes('-y');
    if (dryRun) {
        console.log('🔍 DRY RUN MODE - Preview only (no files will be deleted)');
        console.log('═══════════════════════════════════════════════════════════\n');
    }
    else {
        console.log('🗑️  WIPE ALL STORAGE FILES');
        console.log('═══════════════════════════════════════════════════════════');
        console.log('⚠️  WARNING: This will delete ALL files from ALL buckets!');
        console.log('⚠️  This operation is IRREVERSIBLE!');
        console.log('═══════════════════════════════════════════════════════════\n');
        if (!confirmed) {
            console.log('❌ This is a destructive operation!');
            console.log('   Options:');
            console.log('   --dry-run    Preview what would be deleted (safe)');
            console.log('   --confirm    Actually delete all files (destructive)\n');
            process.exit(1);
        }
    }
    try {
        // List all buckets
        console.log('📋 Listing all storage buckets...');
        const { data: buckets, error: bucketsError } = await supabase.storage.listBuckets();
        if (bucketsError) {
            console.error('❌ Failed to list buckets:', bucketsError);
            process.exit(1);
        }
        if (!buckets || buckets.length === 0) {
            console.log('✅ No buckets found');
            return;
        }
        console.log(`✅ Found ${buckets.length} bucket(s):`);
        buckets.forEach((b) => console.log(`   - ${b.name}`));
        // Delete all files from each bucket
        let totalDeleted = 0;
        let totalErrors = 0;
        let totalFiles = 0;
        for (const bucket of buckets) {
            const result = await deleteAllFilesFromBucket(supabase, bucket.name, dryRun);
            totalDeleted += result.deleted;
            totalErrors += result.errors;
            totalFiles += result.files.length;
        }
        console.log('\n═══════════════════════════════════════════════════════════');
        if (dryRun) {
            console.log('🔍 DRY RUN COMPLETE');
            console.log(`   📊 Total files found: ${totalFiles} file(s)`);
            console.log(`   ⚠️  No files were actually deleted`);
            console.log(`   💡 Run with --confirm to actually delete these files`);
        }
        else {
            console.log('🎉 WIPE COMPLETE!');
            console.log(`   ✅ Deleted: ${totalDeleted} file(s)`);
            if (totalErrors > 0) {
                console.log(`   ⚠️  Errors: ${totalErrors} file(s) failed to delete`);
            }
        }
        console.log('═══════════════════════════════════════════════════════════\n');
    }
    catch (error) {
        console.error('❌ Fatal error:', error);
        process.exit(1);
    }
}
// Run the script
wipeAllStorageFiles().catch(err => {
    console.error('❌ Fatal error:', err);
    process.exit(1);
});
//# sourceMappingURL=wipeAllStorageFiles.js.map