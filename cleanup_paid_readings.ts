/**
 * CLEANUP PAID READINGS FROM SUPABASE
 * 
 * WHAT THIS DELETES:
 * - All artifacts from jobs (PDFs, audio_mp3, audio_song) in `job-artifacts` bucket
 * - Corresponding database records from `job_artifacts` table
 * - Job metadata from `jobs` and `job_tasks` tables
 * 
 * WHAT THIS KEEPS:
 * - Hook readings (sun/moon/rising) in `user_readings` table
 * - Hook audio files in `library` bucket (hook-audio/* paths)
 * - Profile data in `library_people` table
 * - All user authentication data
 * 
 * SAFETY:
 * - DRY RUN mode by default (shows what WOULD be deleted)
 * - Requires explicit confirmation with --execute flag
 * - Verifies no orphans after deletion
 * - Provides detailed counts and examples
 */

import { createSupabaseServiceClient } from './src/services/supabaseClient';
import { config } from 'dotenv';
import { join } from 'path';

config({ path: join(__dirname, '.env') });

const DRY_RUN = !process.argv.includes('--execute');

interface CleanupStats {
  jobArtifactsCount: number;
  jobArtifactsSize: number;
  jobsCount: number;
  jobTasksCount: number;
  storageFilesCount: number;
  storageFilesSize: number;
}

async function main() {
  const supabase = createSupabaseServiceClient();

  if (!supabase) {
    console.error('❌ Supabase not configured');
    process.exit(1);
  }

  console.log('═══════════════════════════════════════════════════════════════════════════');
  console.log('🗑️  CLEANUP PAID READINGS FROM SUPABASE');
  console.log('═══════════════════════════════════════════════════════════════════════════\n');

  if (DRY_RUN) {
    console.log('⚠️  DRY RUN MODE - No deletions will be performed');
    console.log('   This will show you EXACTLY what would be deleted\n');
    console.log('   To execute: node cleanup_paid_readings.ts --execute\n');
  } else {
    console.log('🚨 EXECUTE MODE - DELETIONS WILL BE PERFORMED');
    console.log('   Press Ctrl+C within 10 seconds to abort...\n');
    await new Promise(resolve => setTimeout(resolve, 10000));
    console.log('   Proceeding with deletion...\n');
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // STEP 1: Inventory what will be deleted
  // ═══════════════════════════════════════════════════════════════════════════
  console.log('📊 STEP 1: Analyzing database...\n');

  // Get all job artifacts (PDFs, audio)
  const { data: artifacts, error: artifactsError } = await supabase
    .from('job_artifacts')
    .select('id, job_id, artifact_type, storage_path, bucket_name, file_size_bytes')
    .not('storage_path', 'is', null)
    .in('artifact_type', ['pdf', 'audio_mp3', 'audio_m4a', 'audio_song', 'text']);

  if (artifactsError) {
    console.error('❌ Error fetching artifacts:', artifactsError);
    process.exit(1);
  }

  // Get all jobs
  const { data: jobs, error: jobsError } = await supabase
    .from('jobs')
    .select('id, status, created_at, params');

  if (jobsError) {
    console.error('❌ Error fetching jobs:', jobsError);
    process.exit(1);
  }

  // Get all job tasks
  const { data: tasks, error: tasksError } = await supabase
    .from('job_tasks')
    .select('id, job_id, task_type');

  if (tasksError) {
    console.error('❌ Error fetching tasks:', tasksError);
    process.exit(1);
  }

  // Calculate stats
  const stats: CleanupStats = {
    jobArtifactsCount: artifacts?.length || 0,
    jobArtifactsSize: artifacts?.reduce((sum, a) => sum + (a.file_size_bytes || 0), 0) || 0,
    jobsCount: jobs?.length || 0,
    jobTasksCount: tasks?.length || 0,
    storageFilesCount: 0,
    storageFilesSize: 0,
  };

  // Group artifacts by type
  const artifactsByType: Record<string, number> = {};
  artifacts?.forEach(a => {
    artifactsByType[a.artifact_type] = (artifactsByType[a.artifact_type] || 0) + 1;
  });

  console.log('═══════════════════════════════════════════════════════════════════════════');
  console.log('📋 WHAT WILL BE DELETED:\n');
  console.log(`   🗃️  Job Artifacts (database): ${stats.jobArtifactsCount.toLocaleString()}`);
  console.log(`      - PDF: ${artifactsByType['pdf'] || 0}`);
  console.log(`      - Audio MP3: ${artifactsByType['audio_mp3'] || 0}`);
  console.log(`      - Audio Song: ${artifactsByType['audio_song'] || 0}`);
  console.log(`      - Text: ${artifactsByType['text'] || 0}`);
  console.log(`      - Total Size: ${(stats.jobArtifactsSize / (1024 * 1024 * 1024)).toFixed(2)} GB`);
  console.log('');
  console.log(`   📦 Jobs (database): ${stats.jobsCount.toLocaleString()}`);
  console.log(`   ⚙️  Job Tasks (database): ${stats.jobTasksCount.toLocaleString()}`);
  console.log('');
  console.log(`   🗄️  Storage Files (job-artifacts bucket): ${artifacts?.length || 0}`);
  console.log('');

  // Show examples
  console.log('📄 Example artifacts that will be deleted:');
  artifacts?.slice(0, 5).forEach((a, i) => {
    const fileName = a.storage_path?.split('/').pop() || 'unknown';
    const sizeMB = ((a.file_size_bytes || 0) / (1024 * 1024)).toFixed(2);
    console.log(`   ${i + 1}. ${fileName} (${sizeMB} MB) [${a.artifact_type}]`);
  });
  if ((artifacts?.length || 0) > 5) {
    console.log(`   ... and ${(artifacts?.length || 0) - 5} more files`);
  }
  console.log('');

  console.log('═══════════════════════════════════════════════════════════════════════════');
  console.log('✅ WHAT WILL BE KEPT:\n');
  console.log('   ✓ Hook readings (sun/moon/rising) in `user_readings` table');
  console.log('   ✓ Hook audio files in `library` bucket (hook-audio/* paths)');
  console.log('   ✓ Profile data in `library_people` table');
  console.log('   ✓ User authentication data');
  console.log('   ✓ API keys and configuration');
  console.log('');

  // Verify hook readings are NOT in the deletion list
  const hookAudioInList = artifacts?.filter(a => a.storage_path?.includes('hook-audio'));
  if (hookAudioInList && hookAudioInList.length > 0) {
    console.error('🚨 ERROR: Hook audio files detected in deletion list!');
    console.error('   This should NEVER happen. Aborting.');
    console.error('   Files:', hookAudioInList.map(a => a.storage_path));
    process.exit(1);
  }

  console.log('✅ Verified: No hook audio files in deletion list\n');

  if (DRY_RUN) {
    console.log('═══════════════════════════════════════════════════════════════════════════');
    console.log('⚠️  DRY RUN COMPLETE - No changes made\n');
    console.log('To execute deletion, run:');
    console.log('   npx tsx cleanup_paid_readings.ts --execute\n');
    console.log('═══════════════════════════════════════════════════════════════════════════');
    return;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // STEP 2: Delete storage files
  // ═══════════════════════════════════════════════════════════════════════════
  console.log('═══════════════════════════════════════════════════════════════════════════');
  console.log('🗑️  STEP 2: Deleting storage files...\n');

  let deletedFiles = 0;
  let failedFiles = 0;

  for (const artifact of artifacts || []) {
    if (!artifact.storage_path) continue;

    const bucket = artifact.bucket_name || 'job-artifacts';
    
    try {
      const { error: deleteError } = await supabase.storage
        .from(bucket)
        .remove([artifact.storage_path]);

      if (deleteError) {
        console.error(`   ❌ Failed to delete ${artifact.storage_path}: ${deleteError.message}`);
        failedFiles++;
      } else {
        deletedFiles++;
        if (deletedFiles % 50 === 0) {
          console.log(`   ⏳ Deleted ${deletedFiles}/${artifacts.length} files...`);
        }
      }
    } catch (error: any) {
      console.error(`   ❌ Error deleting ${artifact.storage_path}: ${error.message}`);
      failedFiles++;
    }
  }

  console.log(`\n   ✅ Deleted ${deletedFiles} storage files`);
  if (failedFiles > 0) {
    console.log(`   ⚠️  Failed to delete ${failedFiles} files (they may not exist)`);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // STEP 3: Delete database records
  // ═══════════════════════════════════════════════════════════════════════════
  console.log('\n═══════════════════════════════════════════════════════════════════════════');
  console.log('🗑️  STEP 3: Deleting database records...\n');

  // Delete job_artifacts
  console.log('   🗃️  Deleting job_artifacts...');
  const { error: artifactsDeleteError } = await supabase
    .from('job_artifacts')
    .delete()
    .neq('id', '00000000-0000-0000-0000-000000000000'); // Delete all

  if (artifactsDeleteError) {
    console.error(`   ❌ Error deleting job_artifacts: ${artifactsDeleteError.message}`);
  } else {
    console.log(`   ✅ Deleted ${stats.jobArtifactsCount} job_artifacts records`);
  }

  // Delete job_tasks
  console.log('   ⚙️  Deleting job_tasks...');
  const { error: tasksDeleteError } = await supabase
    .from('job_tasks')
    .delete()
    .neq('id', '00000000-0000-0000-0000-000000000000'); // Delete all

  if (tasksDeleteError) {
    console.error(`   ❌ Error deleting job_tasks: ${tasksDeleteError.message}`);
  } else {
    console.log(`   ✅ Deleted ${stats.jobTasksCount} job_tasks records`);
  }

  // Delete jobs
  console.log('   📦 Deleting jobs...');
  const { error: jobsDeleteError } = await supabase
    .from('jobs')
    .delete()
    .neq('id', '00000000-0000-0000-0000-000000000000'); // Delete all

  if (jobsDeleteError) {
    console.error(`   ❌ Error deleting jobs: ${jobsDeleteError.message}`);
  } else {
    console.log(`   ✅ Deleted ${stats.jobsCount} jobs records`);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // STEP 4: Verify cleanup
  // ═══════════════════════════════════════════════════════════════════════════
  console.log('\n═══════════════════════════════════════════════════════════════════════════');
  console.log('🔍 STEP 4: Verifying cleanup...\n');

  // Check for orphaned records
  const { data: remainingArtifacts } = await supabase
    .from('job_artifacts')
    .select('count');

  const { data: remainingJobs } = await supabase
    .from('jobs')
    .select('count');

  const { data: remainingTasks } = await supabase
    .from('job_tasks')
    .select('count');

  // Verify hook readings are intact
  const { data: hookReadings } = await supabase
    .from('user_readings')
    .select('count');

  // Verify profiles are intact
  const { data: profiles } = await supabase
    .from('library_people')
    .select('count');

  console.log('   📊 Remaining database records:');
  console.log(`      - job_artifacts: ${(remainingArtifacts as any)?.[0]?.count || 0}`);
  console.log(`      - jobs: ${(remainingJobs as any)?.[0]?.count || 0}`);
  console.log(`      - job_tasks: ${(remainingTasks as any)?.[0]?.count || 0}`);
  console.log('');
  console.log('   ✅ Verified kept data:');
  console.log(`      - user_readings (hooks): ${(hookReadings as any)?.[0]?.count || 0}`);
  console.log(`      - library_people (profiles): ${(profiles as any)?.[0]?.count || 0}`);
  console.log('');

  const hasOrphans = 
    ((remainingArtifacts as any)?.[0]?.count || 0) > 0 ||
    ((remainingJobs as any)?.[0]?.count || 0) > 0 ||
    ((remainingTasks as any)?.[0]?.count || 0) > 0;

  if (hasOrphans) {
    console.log('⚠️  WARNING: Some records remain in database');
    console.log('   This might be due to deletion errors. Check logs above.');
  } else {
    console.log('✅ No orphaned records found - cleanup complete!');
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // Final summary
  // ═══════════════════════════════════════════════════════════════════════════
  console.log('\n═══════════════════════════════════════════════════════════════════════════');
  console.log('🎉 CLEANUP COMPLETE\n');
  console.log('   📊 Deleted:');
  console.log(`      - ${deletedFiles} storage files`);
  console.log(`      - ${stats.jobArtifactsCount} job_artifacts records`);
  console.log(`      - ${stats.jobTasksCount} job_tasks records`);
  console.log(`      - ${stats.jobsCount} jobs records`);
  console.log(`      - Freed: ${(stats.jobArtifactsSize / (1024 * 1024 * 1024)).toFixed(2)} GB`);
  console.log('');
  console.log('   ✅ Kept:');
  console.log(`      - ${(hookReadings as any)?.[0]?.count || 0} hook readings`);
  console.log(`      - ${(profiles as any)?.[0]?.count || 0} user profiles`);
  console.log(`      - All hook audio files in library bucket`);
  console.log('');
  console.log('═══════════════════════════════════════════════════════════════════════════\n');
}

main().catch(console.error);
