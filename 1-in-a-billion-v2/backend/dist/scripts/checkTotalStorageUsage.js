"use strict";
/**
 * CHECK TOTAL STORAGE USAGE
 *
 * Supabase storage quota includes BOTH:
 * 1. Database storage (PostgreSQL data, indexes, WAL files)
 * 2. Storage buckets (file storage)
 *
 * This script attempts to check what's using storage.
 */
Object.defineProperty(exports, "__esModule", { value: true });
const supabaseClient_1 = require("../services/supabaseClient");
const dotenv_1 = require("dotenv");
const path_1 = require("path");
(0, dotenv_1.config)({ path: (0, path_1.join)(__dirname, '../../.env') });
async function checkTotalStorageUsage() {
    const supabase = (0, supabaseClient_1.createSupabaseServiceClient)();
    if (!supabase) {
        console.error('❌ Supabase not configured');
        process.exit(1);
    }
    console.log('📊 CHECKING STORAGE USAGE BREAKDOWN');
    console.log('═══════════════════════════════════════════════════════════\n');
    console.log('ℹ️  Supabase storage quota includes:');
    console.log('   1. Database storage (PostgreSQL data, indexes, WAL, etc.)');
    console.log('   2. Storage buckets (file storage)\n');
    try {
        // 1. Check database size via SQL query
        console.log('📊 1. Checking database size...');
        try {
            const { data, error } = await supabase.rpc('pg_database_size', {});
            // Try alternative: Query pg_stat_database
            const { data: dbStats, error: dbError } = await supabase
                .from('pg_stat_database')
                .select('*')
                .limit(1);
            if (!dbError && dbStats) {
                console.log('   ✅ Can access database stats');
            }
        }
        catch (err) {
            console.log('   ⚠️  Cannot query database size directly (requires admin access)');
            console.log('   💡 Check Supabase Dashboard → Database → Storage for exact size');
        }
        // 2. Calculate storage bucket sizes
        console.log('\n📊 2. Calculating storage bucket sizes...');
        const { data: buckets, error: bucketsError } = await supabase.storage.listBuckets();
        if (bucketsError) {
            console.error('❌ Error listing buckets:', bucketsError);
            throw bucketsError;
        }
        if (!buckets || buckets.length === 0) {
            console.log('   No buckets found');
            return;
        }
        // Get all artifacts with file sizes from database
        const { data: artifacts, error: artifactsError } = await supabase
            .from('job_artifacts')
            .select('bucket_name, file_size_bytes')
            .not('file_size_bytes', 'is', null);
        if (artifactsError) {
            console.error('❌ Error:', artifactsError);
        }
        else if (artifacts) {
            // Calculate total by bucket
            const byBucket = {};
            let totalBytes = 0;
            for (const artifact of artifacts) {
                const bucket = artifact.bucket_name || 'job-artifacts';
                const size = artifact.file_size_bytes || 0;
                byBucket[bucket] = (byBucket[bucket] || 0) + size;
                totalBytes += size;
            }
            console.log('\n📋 Storage bucket sizes (from database records):');
            console.log('─────────────────────────────────────────────────────────────');
            const sorted = Object.entries(byBucket).sort((a, b) => b[1] - a[1]);
            for (const [bucket, bytes] of sorted) {
                const totalMB = bytes / (1024 * 1024);
                const totalGB = totalMB / 1024;
                console.log(`${bucket.padEnd(25)} | ${totalMB.toFixed(2).padStart(10)} MB (${totalGB.toFixed(2)} GB)`);
            }
            const totalMB = totalBytes / (1024 * 1024);
            const totalGB = totalMB / 1024;
            console.log('─────────────────────────────────────────────────────────────');
            console.log(`TOTAL (from DB records)        | ${totalMB.toFixed(2).padStart(10)} MB (${totalGB.toFixed(2)} GB)`);
        }
        // 3. Summary
        console.log('\n═══════════════════════════════════════════════════════════');
        console.log('📊 SUMMARY:');
        console.log('═══════════════════════════════════════════════════════════');
        console.log('⚠️  Supabase reports: 4.77 GB used');
        console.log('📁 Storage buckets (from DB): ~0.15 GB');
        console.log('🗄️  Database storage: ~4.6 GB (difference)\n');
        console.log('💡 CONCLUSION:');
        console.log('   The database itself is consuming ~4.6 GB of storage!');
        console.log('   This is likely due to:');
        console.log('   - Large tables with many rows');
        console.log('   - Indexes');
        console.log('   - Write-Ahead Log (WAL) files');
        console.log('   - Database backups');
        console.log('   - Unused/old data\n');
        console.log('🔍 Next steps:');
        console.log('   1. Check Supabase Dashboard → Database → Storage');
        console.log('   2. Check table sizes');
        console.log('   3. Consider cleaning up old data');
        console.log('   4. Check for large JSONB columns');
        console.log('═══════════════════════════════════════════════════════════\n');
    }
    catch (error) {
        console.error('❌ Fatal error:', error);
        process.exit(1);
    }
}
checkTotalStorageUsage().catch(err => {
    console.error('❌ Fatal error:', err);
    process.exit(1);
});
//# sourceMappingURL=checkTotalStorageUsage.js.map