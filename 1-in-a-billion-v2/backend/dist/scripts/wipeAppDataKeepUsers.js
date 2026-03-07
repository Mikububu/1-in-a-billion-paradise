"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
/**
 * WIPE APP DATA (KEEP AUTH USERS)
 *
 * ⚠️ DANGER: This wipes all application data for ALL users (including library_people),
 * but keeps auth.users.
 *
 * NOTE: If you only want to wipe jobs (and keep people), use:
 *   - src/scripts/wipeJobsKeepPeople.ts
 *
 * What it deletes:
 * - public.library_people
 * - public.jobs (cascades to job_tasks + job_artifacts via FK)
 * - public.job_tasks (explicit, safe)
 * - public.job_artifacts (explicit, safe)
 * - Supabase Storage files in buckets: job-artifacts, vedic-artifacts (if present)
 *
 * What it DOES NOT delete:
 * - auth.users (logins remain)
 *
 * Usage:
 *   npx ts-node src/scripts/wipeAppDataKeepUsers.ts --dry-run
 *   CONFIRM=WIPE_ALL_APP_DATA npx ts-node src/scripts/wipeAppDataKeepUsers.ts --confirm
 */
const supabaseClient_1 = require("../services/supabaseClient");
const dotenv_1 = require("dotenv");
const path_1 = require("path");
(0, dotenv_1.config)({ path: (0, path_1.join)(__dirname, '../../.env') });
async function listAllFiles(supabase, bucketName, folderPath = '', allFiles = []) {
    const { data: files, error } = await supabase.storage
        .from(bucketName)
        .list(folderPath, { limit: 1000, offset: 0, sortBy: { column: 'name', order: 'asc' } });
    if (error) {
        console.warn(`⚠️  Error listing ${bucketName}/${folderPath}:`, error.message);
        return allFiles;
    }
    if (!files || files.length === 0)
        return allFiles;
    for (const file of files) {
        const fullPath = folderPath ? `${folderPath}/${file.name}` : file.name;
        if (file.id === null) {
            const subFiles = await listAllFiles(supabase, bucketName, fullPath, []);
            allFiles.push(...subFiles);
        }
        else {
            allFiles.push(fullPath);
        }
    }
    return allFiles;
}
async function deleteAllFilesFromBucket(supabase, bucketName, dryRun) {
    console.log(`\n📦 Storage bucket: ${bucketName}`);
    const allFiles = await listAllFiles(supabase, bucketName);
    console.log(`   📊 Found ${allFiles.length} file(s)`);
    if (dryRun || allFiles.length === 0) {
        if (allFiles.length > 0) {
            console.log(`   📄 Sample (first 10):`);
            allFiles.slice(0, 10).forEach((f, i) => console.log(`      ${i + 1}. ${f}`));
            if (allFiles.length > 10)
                console.log(`      ... and ${allFiles.length - 10} more`);
        }
        return { bucket: bucketName, filesFound: allFiles.length, deleted: 0, errors: 0 };
    }
    const batchSize = 100;
    let deleted = 0;
    let errors = 0;
    for (let i = 0; i < allFiles.length; i += batchSize) {
        const batch = allFiles.slice(i, i + batchSize);
        const { error } = await supabase.storage.from(bucketName).remove(batch);
        if (error) {
            console.error(`   ❌ Error deleting batch ${i / batchSize + 1}:`, error.message);
            errors += batch.length;
        }
        else {
            deleted += batch.length;
            console.log(`   ✅ Deleted ${deleted}/${allFiles.length}`);
        }
    }
    return { bucket: bucketName, filesFound: allFiles.length, deleted, errors };
}
async function wipeAppDataKeepUsers() {
    const supabase = (0, supabaseClient_1.createSupabaseServiceClient)();
    if (!supabase) {
        console.error('❌ Supabase not configured (SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY).');
        process.exit(1);
    }
    const args = process.argv.slice(2);
    const dryRun = args.includes('--dry-run') || args.includes('--dryrun');
    const confirmed = args.includes('--confirm') || args.includes('-y');
    const confirmEnv = String(process.env.CONFIRM || '').trim();
    if (!dryRun && (!confirmed || confirmEnv !== 'WIPE_ALL_APP_DATA')) {
        console.error('❌ Refusing to run without --confirm AND CONFIRM=WIPE_ALL_APP_DATA (or use --dry-run).');
        process.exit(1);
    }
    console.log(dryRun ? '🔍 DRY RUN: WIPE APP DATA (KEEP USERS)' : '🗑️  WIPE APP DATA (KEEP USERS)');
    console.log('═══════════════════════════════════════════════════════════');
    console.log('- Deletes: jobs, job_tasks, job_artifacts, library_people');
    console.log('- Keeps: auth.users');
    console.log('═══════════════════════════════════════════════════════════\n');
    if (!dryRun) {
        // 1) Delete DB rows (explicit order; jobs also cascades).
        console.log('🧹 Deleting database rows...');
        await supabase.from('job_artifacts').delete().neq('id', '00000000-0000-0000-0000-000000000000');
        await supabase.from('job_tasks').delete().neq('id', '00000000-0000-0000-0000-000000000000');
        await supabase.from('jobs').delete().neq('id', '00000000-0000-0000-0000-000000000000');
        await supabase.from('library_people').delete().neq('user_id', '00000000-0000-0000-0000-000000000000');
        console.log('✅ Database wipe complete.');
    }
    else {
        console.log('ℹ️  Dry run: skipping DB deletes.');
    }
    // 2) Wipe storage files for job artifacts.
    console.log('\n🧹 Deleting storage files (job-related buckets only)...');
    const { data: buckets, error: bucketsError } = await supabase.storage.listBuckets();
    if (bucketsError) {
        console.warn('⚠️  Could not list buckets:', bucketsError.message || String(bucketsError));
        return;
    }
    const targetBuckets = new Set(['job-artifacts', 'vedic-artifacts']);
    const existingTargets = (buckets || []).map((b) => b?.name).filter((n) => targetBuckets.has(n));
    if (existingTargets.length === 0) {
        console.log('✅ No job-related buckets found to wipe.');
        return;
    }
    let totalFound = 0;
    let totalDeleted = 0;
    let totalErrors = 0;
    for (const b of existingTargets) {
        const r = await deleteAllFilesFromBucket(supabase, b, dryRun);
        totalFound += r.filesFound;
        totalDeleted += r.deleted;
        totalErrors += r.errors;
    }
    console.log('\n═══════════════════════════════════════════════════════════');
    if (dryRun) {
        console.log(`🔍 DRY RUN COMPLETE - would remove ${totalFound} file(s).`);
    }
    else {
        console.log(`🎉 WIPE COMPLETE - removed ${totalDeleted}/${totalFound} file(s) (errors: ${totalErrors}).`);
    }
    console.log('═══════════════════════════════════════════════════════════\n');
}
wipeAppDataKeepUsers().catch((err) => {
    console.error('❌ Fatal error:', err?.message || String(err));
    process.exit(1);
});
//# sourceMappingURL=wipeAppDataKeepUsers.js.map