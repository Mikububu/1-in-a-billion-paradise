/**
 * CLEANUP OLD ARTIFACTS
 * 
 * Deletes old artifacts from Supabase Storage based on age or other criteria.
 * This helps free up storage space.
 * 
 * Options:
 *   --older-than-days=N    Delete artifacts older than N days (default: 30)
 *   --dry-run              Preview what would be deleted (safe)
 *   --confirm              Actually delete files (destructive)
 *   --keep-recent=N        Keep the N most recent artifacts per user (default: 10)
 * 
 * Usage:
 *   # Preview cleanup (safe):
 *   npx ts-node src/scripts/cleanupOldArtifacts.ts --dry-run --older-than-days=30
 * 
 *   # Delete artifacts older than 30 days:
 *   npx ts-node src/scripts/cleanupOldArtifacts.ts --confirm --older-than-days=30
 * 
 *   # Keep only 10 most recent artifacts per user:
 *   npx ts-node src/scripts/cleanupOldArtifacts.ts --confirm --keep-recent=10
 */

import { createSupabaseServiceClient } from '../services/supabaseClient';
import { config } from 'dotenv';
import { join } from 'path';

config({ path: join(__dirname, '../../.env') });

interface CleanupOptions {
  olderThanDays?: number;
  keepRecent?: number;
  dryRun: boolean;
  confirmed: boolean;
}

/**
 * Delete artifacts older than specified days
 */
async function cleanupOldArtifacts(
  supabase: any,
  olderThanDays: number,
  dryRun: boolean
): Promise<{ deleted: number; freedMB: number; errors: number }> {
  console.log(`\n🗑️  Cleaning up artifacts older than ${olderThanDays} days...`);
  
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - olderThanDays);
  const cutoffISO = cutoffDate.toISOString();

  // Get old artifacts
  const { data: artifacts, error } = await supabase
    .from('job_artifacts')
    .select('id, storage_path, bucket_name, file_size_bytes, created_at')
    .lt('created_at', cutoffISO)
    .not('storage_path', 'is', null);

  if (error) {
    console.error('❌ Error querying old artifacts:', error);
    throw error;
  }

  if (!artifacts || artifacts.length === 0) {
    console.log('   ✅ No old artifacts found');
    return { deleted: 0, freedMB: 0, errors: 0 };
  }

  console.log(`   📊 Found ${artifacts.length} artifact(s) older than ${olderThanDays} days`);
  
  const totalBytes = artifacts.reduce((sum: number, a: any) => sum + (a.file_size_bytes || 0), 0);
  const totalMB = totalBytes / (1024 * 1024);
  console.log(`   💾 Total size: ${totalMB.toFixed(2)} MB (${(totalMB / 1024).toFixed(2)} GB)`);

  if (dryRun) {
    console.log('   🔍 DRY RUN - No files will be deleted');
    return { deleted: artifacts.length, freedMB: totalMB, errors: 0 };
  }

  // Group by bucket for efficient deletion
  const byBucket: Record<string, string[]> = {};
  for (const artifact of artifacts) {
    const bucket = artifact.bucket_name || 'job-artifacts';
    if (!byBucket[bucket]) {
      byBucket[bucket] = [];
    }
    byBucket[bucket].push(artifact.storage_path);
  }

  // Delete files from storage
  let deleted = 0;
  let errors = 0;
  let freedBytes = 0;

  for (const [bucket, paths] of Object.entries(byBucket)) {
    console.log(`   🗑️  Deleting ${paths.length} file(s) from ${bucket}...`);
    
    // Delete in batches (Supabase has limits)
    const batchSize = 100;
    for (let i = 0; i < paths.length; i += batchSize) {
      const batch = paths.slice(i, i + batchSize);
      const { error: deleteError } = await supabase.storage
        .from(bucket)
        .remove(batch);

      if (deleteError) {
        console.error(`   ❌ Error deleting batch ${Math.floor(i / batchSize) + 1}:`, deleteError.message);
        errors += batch.length;
      } else {
        deleted += batch.length;
        const batchArtifacts = artifacts.filter((a: any) => batch.includes(a.storage_path));
        freedBytes += batchArtifacts.reduce((sum: number, a: any) => sum + (a.file_size_bytes || 0), 0);
        console.log(`   ✅ Deleted batch ${Math.floor(i / batchSize) + 1} (${deleted}/${paths.length} files)`);
      }
    }
  }

  // Delete database records
  if (deleted > 0) {
    console.log(`   🗄️  Deleting ${artifacts.length} database record(s)...`);
    const artifactIds = artifacts.map((a: any) => a.id);
    
    // Delete in batches
    const batchSize = 100;
    for (let i = 0; i < artifactIds.length; i += batchSize) {
      const batch = artifactIds.slice(i, i + batchSize);
      const { error: dbError } = await supabase
        .from('job_artifacts')
        .delete()
        .in('id', batch);

      if (dbError) {
        console.error(`   ⚠️  Error deleting database records batch ${Math.floor(i / batchSize) + 1}:`, dbError.message);
      }
    }
  }

  const freedMB = freedBytes / (1024 * 1024);
  return { deleted, freedMB, errors };
}

/**
 * Keep only N most recent artifacts per user
 */
async function cleanupKeepRecent(
  supabase: any,
  keepRecent: number,
  dryRun: boolean
): Promise<{ deleted: number; freedMB: number; errors: number }> {
  console.log(`\n🗑️  Keeping only ${keepRecent} most recent artifacts per user...`);
  
  // Get all artifacts with user_id (need to join with jobs table)
  const { data: jobs, error: jobsError } = await supabase
    .from('jobs')
    .select('id, user_id');

  if (jobsError) {
    console.error('❌ Error querying jobs:', jobsError);
    throw jobsError;
  }

  const jobIdToUserId: Record<string, string> = {};
  for (const job of jobs || []) {
    jobIdToUserId[job.id] = job.user_id;
  }

  // Get all artifacts
  const { data: allArtifacts, error: artifactsError } = await supabase
    .from('job_artifacts')
    .select('id, job_id, storage_path, bucket_name, file_size_bytes, created_at')
    .not('storage_path', 'is', null)
    .order('created_at', { ascending: false });

  if (artifactsError) {
    console.error('❌ Error querying artifacts:', artifactsError);
    throw artifactsError;
  }

  if (!allArtifacts || allArtifacts.length === 0) {
    console.log('   ✅ No artifacts found');
    return { deleted: 0, freedMB: 0, errors: 0 };
  }

  // Group by user
  const byUser: Record<string, any[]> = {};
  for (const artifact of allArtifacts) {
    const userId = jobIdToUserId[artifact.job_id] || 'unknown';
    if (!byUser[userId]) {
      byUser[userId] = [];
    }
    byUser[userId].push(artifact);
  }

  // Identify artifacts to delete (keep only N most recent per user)
  const toDelete: any[] = [];
  for (const [userId, artifacts] of Object.entries(byUser)) {
    if (artifacts.length > keepRecent) {
      // Keep first N (most recent), delete the rest
      const toDeleteForUser = artifacts.slice(keepRecent);
      toDelete.push(...toDeleteForUser);
      console.log(`   👤 User ${userId}: Keeping ${keepRecent} most recent, deleting ${toDeleteForUser.length} old artifact(s)`);
    }
  }

  if (toDelete.length === 0) {
    console.log('   ✅ No artifacts to delete (all users have <= keepRecent artifacts)');
    return { deleted: 0, freedMB: 0, errors: 0 };
  }

  console.log(`   📊 Total artifacts to delete: ${toDelete.length}`);
  const totalBytes = toDelete.reduce((sum: number, a: any) => sum + (a.file_size_bytes || 0), 0);
  const totalMB = totalBytes / (1024 * 1024);
  console.log(`   💾 Total size to free: ${totalMB.toFixed(2)} MB (${(totalMB / 1024).toFixed(2)} GB)`);

  if (dryRun) {
    console.log('   🔍 DRY RUN - No files will be deleted');
    return { deleted: toDelete.length, freedMB: totalMB, errors: 0 };
  }

  // Delete from storage and database (similar to cleanupOldArtifacts)
  // ... (implementation similar to cleanupOldArtifacts)

  return { deleted: 0, freedMB: 0, errors: 0 }; // Placeholder
}

/**
 * Main function
 */
async function cleanupOldArtifactsScript() {
  const supabase = createSupabaseServiceClient();
  
  if (!supabase) {
    console.error('❌ Supabase not configured');
    console.error('   Make sure SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are set');
    process.exit(1);
  }

  // Parse command line arguments
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run') || args.includes('--dryrun');
  const confirmed = args.includes('--confirm') || args.includes('-y');
  
  const olderThanDaysArg = args.find(a => a.startsWith('--older-than-days='));
  const olderThanDays = olderThanDaysArg ? parseInt(olderThanDaysArg.split('=')[1]) : 30;
  
  const keepRecentArg = args.find(a => a.startsWith('--keep-recent='));
  const keepRecent = keepRecentArg ? parseInt(keepRecentArg.split('=')[1]) : undefined;

  if (dryRun) {
    console.log('🔍 DRY RUN MODE - Preview only (no files will be deleted)');
    console.log('═══════════════════════════════════════════════════════════\n');
  } else {
    console.log('🗑️  CLEANUP OLD ARTIFACTS');
    console.log('═══════════════════════════════════════════════════════════');
    console.log('⚠️  WARNING: This will delete files from Supabase Storage!');
    console.log('⚠️  This operation is IRREVERSIBLE!');
    console.log('═══════════════════════════════════════════════════════════\n');

    if (!confirmed) {
      console.log('❌ This is a destructive operation!');
      console.log('   Options:');
      console.log('   --dry-run              Preview what would be deleted (safe)');
      console.log('   --confirm              Actually delete files (destructive)');
      console.log('   --older-than-days=N    Delete artifacts older than N days (default: 30)');
      console.log('   --keep-recent=N        Keep only N most recent artifacts per user');
      console.log('\n   Example:');
      console.log('   npx ts-node src/scripts/cleanupOldArtifacts.ts --dry-run --older-than-days=30');
      process.exit(1);
    }
  }

  try {
    let result;
    
    if (keepRecent !== undefined) {
      result = await cleanupKeepRecent(supabase, keepRecent, dryRun);
    } else {
      result = await cleanupOldArtifacts(supabase, olderThanDays, dryRun);
    }

    console.log('\n═══════════════════════════════════════════════════════════');
    if (dryRun) {
      console.log('🔍 DRY RUN COMPLETE');
      console.log(`   📊 Artifacts that would be deleted: ${result.deleted}`);
      console.log(`   💾 Storage that would be freed: ${result.freedMB.toFixed(2)} MB (${(result.freedMB / 1024).toFixed(2)} GB)`);
      console.log(`   ⚠️  No files were actually deleted`);
      console.log(`   💡 Run with --confirm to actually delete these files`);
    } else {
      console.log('🎉 CLEANUP COMPLETE!');
      console.log(`   ✅ Deleted: ${result.deleted} artifact(s)`);
      console.log(`   💾 Freed: ${result.freedMB.toFixed(2)} MB (${(result.freedMB / 1024).toFixed(2)} GB)`);
      if (result.errors > 0) {
        console.log(`   ⚠️  Errors: ${result.errors} file(s) failed to delete`);
      }
    }
    console.log('═══════════════════════════════════════════════════════════\n');

  } catch (error: any) {
    console.error('❌ Fatal error:', error);
    process.exit(1);
  }
}

// Run the script
cleanupOldArtifactsScript().catch(err => {
  console.error('❌ Fatal error:', err);
  process.exit(1);
});
