"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
require("dotenv/config");
const supabaseClient_1 = require("../services/supabaseClient");
/**
 * CLEANUP: Remove duplicate is_user=true entries in library_people
 *
 * RULE: Only ONE person per user_id can have is_user=true
 *
 * Strategy:
 * 1. Find all user_ids with multiple is_user=true entries
 * 2. For each user_id, keep the NEWEST entry (by created_at)
 * 3. Delete all older duplicate entries
 * 4. Report what was cleaned up
 *
 * Usage:
 *   npx ts-node src/scripts/cleanupDuplicateUserProfiles.ts
 *
 * Add DRY_RUN=true to preview without deleting:
 *   DRY_RUN=true npx ts-node src/scripts/cleanupDuplicateUserProfiles.ts
 */
async function main() {
    const supabase = (0, supabaseClient_1.createSupabaseServiceClient)();
    if (!supabase) {
        throw new Error('Supabase service client not configured');
    }
    const dryRun = process.env.DRY_RUN === 'true';
    console.log('🔍 Starting cleanup of duplicate user profiles...');
    if (dryRun) {
        console.log('⚠️  DRY RUN MODE - No changes will be made\n');
    }
    // Step 1: Find all library_people where is_user=true
    const { data: userProfiles, error: fetchError } = await supabase
        .from('library_people')
        .select('*')
        .eq('is_user', true)
        .order('created_at', { ascending: true });
    if (fetchError) {
        throw new Error(`Failed to fetch user profiles: ${fetchError.message}`);
    }
    if (!userProfiles || userProfiles.length === 0) {
        console.log('✅ No user profiles found - nothing to clean up');
        return;
    }
    console.log(`📊 Found ${userProfiles.length} total user profiles (is_user=true)\n`);
    // Step 2: Group by user_id to find duplicates
    const byUserId = {};
    for (const profile of userProfiles) {
        if (!byUserId[profile.user_id]) {
            byUserId[profile.user_id] = [];
        }
        byUserId[profile.user_id].push(profile);
    }
    // Step 3: Find users with duplicates
    const duplicateUserIds = Object.keys(byUserId).filter(userId => byUserId[userId].length > 1);
    if (duplicateUserIds.length === 0) {
        console.log('✅ No duplicate user profiles found - all clean!');
        return;
    }
    console.log(`⚠️  Found ${duplicateUserIds.length} user(s) with duplicate profiles:\n`);
    let totalDeleted = 0;
    // Step 4: For each user with duplicates, keep newest, delete rest
    for (const userId of duplicateUserIds) {
        const profiles = byUserId[userId];
        // Sort by created_at DESC (newest first)
        profiles.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
        const [keep, ...toDelete] = profiles;
        console.log(`👤 User ID: ${userId}`);
        console.log(`   ✅ KEEP: "${keep.name}" (id: ${keep.id}, created: ${keep.created_at})`);
        for (const profile of toDelete) {
            console.log(`   ❌ DELETE: "${profile.name}" (id: ${profile.id}, created: ${profile.created_at})`);
            if (!dryRun) {
                const { error: deleteError } = await supabase
                    .from('library_people')
                    .delete()
                    .eq('id', profile.id);
                if (deleteError) {
                    console.error(`   ⚠️  Failed to delete ${profile.id}: ${deleteError.message}`);
                }
                else {
                    totalDeleted++;
                }
            }
        }
        console.log('');
    }
    // Step 5: Summary
    console.log('═'.repeat(60));
    if (dryRun) {
        console.log(`📋 DRY RUN SUMMARY:`);
        console.log(`   Would delete: ${duplicateUserIds.reduce((sum, uid) => sum + (byUserId[uid].length - 1), 0)} duplicate profiles`);
        console.log(`\n💡 Run without DRY_RUN=true to apply changes`);
    }
    else {
        console.log(`✅ CLEANUP COMPLETE:`);
        console.log(`   Deleted: ${totalDeleted} duplicate profiles`);
        console.log(`   Users cleaned: ${duplicateUserIds.length}`);
    }
    console.log('═'.repeat(60));
}
main().catch((err) => {
    console.error('❌ Cleanup failed:', err?.message || String(err));
    process.exit(1);
});
//# sourceMappingURL=cleanupDuplicateUserProfiles.js.map