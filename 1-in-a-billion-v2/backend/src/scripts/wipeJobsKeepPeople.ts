/**
 * WIPE JOBS (KEEP PEOPLE + USERS)
 *
 * Deletes all jobs system rows for ALL users:
 * - public.job_artifacts
 * - public.job_tasks
 * - public.jobs
 *
 * Keeps:
 * - public.library_people
 * - auth.users
 *
 * Also wipes Storage files only in bucket: job-artifacts
 *
 * Usage:
 *   npx ts-node src/scripts/wipeJobsKeepPeople.ts --dry-run
 *   CONFIRM=WIPE_JOBS npx ts-node src/scripts/wipeJobsKeepPeople.ts --confirm
 */
import { createSupabaseServiceClient } from '../services/supabaseClient';
import { config } from 'dotenv';
import { join } from 'path';

config({ path: join(__dirname, '../../.env') });

async function listAllFiles(
  supabase: any,
  bucketName: string,
  folderPath: string = '',
  allFiles: string[] = []
): Promise<string[]> {
  const { data: files, error } = await supabase.storage
    .from(bucketName)
    .list(folderPath, { limit: 1000, offset: 0, sortBy: { column: 'name', order: 'asc' } });

  if (error) {
    console.warn(`⚠️  Error listing ${bucketName}/${folderPath}:`, error.message);
    return allFiles;
  }
  if (!files || files.length === 0) return allFiles;

  for (const file of files) {
    const fullPath = folderPath ? `${folderPath}/${file.name}` : file.name;
    if (file.id === null) {
      const subFiles = await listAllFiles(supabase, bucketName, fullPath, []);
      allFiles.push(...subFiles);
    } else {
      allFiles.push(fullPath);
    }
  }

  return allFiles;
}

async function wipeJobsKeepPeople() {
  const supabase = createSupabaseServiceClient();
  if (!supabase) {
    console.error('❌ Supabase not configured (SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY).');
    process.exit(1);
  }

  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run') || args.includes('--dryrun');
  const confirmed = args.includes('--confirm') || args.includes('-y');
  const confirmEnv = String(process.env.CONFIRM || '').trim();

  if (!dryRun && (!confirmed || confirmEnv !== 'WIPE_JOBS')) {
    console.error('❌ Refusing to run without --confirm AND CONFIRM=WIPE_JOBS (or use --dry-run).');
    process.exit(1);
  }

  console.log(dryRun ? '🔍 DRY RUN: WIPE JOBS (KEEP PEOPLE + USERS)' : '🗑️  WIPE JOBS (KEEP PEOPLE + USERS)');
  console.log('═══════════════════════════════════════════════════════════');
  console.log('- Deletes: jobs, job_tasks, job_artifacts');
  console.log('- Keeps: library_people, auth.users');
  console.log('═══════════════════════════════════════════════════════════\n');

  if (!dryRun) {
    console.log('🧹 Deleting database rows...');
    await supabase.from('job_artifacts').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    await supabase.from('job_tasks').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    await supabase.from('jobs').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    console.log('✅ Jobs tables wiped.');
  } else {
    console.log('ℹ️  Dry run: skipping DB deletes.');
  }

  console.log('\n🧹 Wiping Storage bucket: job-artifacts');
  const bucket = 'job-artifacts';
  const allFiles = await listAllFiles(supabase, bucket);
  console.log(`   📊 Found ${allFiles.length} file(s)`);

  if (dryRun || allFiles.length === 0) {
    if (allFiles.length > 0) {
      console.log(`   📄 Sample (first 10):`);
      allFiles.slice(0, 10).forEach((f, i) => console.log(`      ${i + 1}. ${f}`));
      if (allFiles.length > 10) console.log(`      ... and ${allFiles.length - 10} more`);
    }
    console.log('\n✅ Done.');
    return;
  }

  const batchSize = 100;
  let deleted = 0;
  let errors = 0;
  for (let i = 0; i < allFiles.length; i += batchSize) {
    const batch = allFiles.slice(i, i + batchSize);
    const { error } = await supabase.storage.from(bucket).remove(batch);
    if (error) {
      console.error(`   ❌ Error deleting batch ${i / batchSize + 1}:`, error.message);
      errors += batch.length;
    } else {
      deleted += batch.length;
      console.log(`   ✅ Deleted ${deleted}/${allFiles.length}`);
    }
  }

  console.log('\n═══════════════════════════════════════════════════════════');
  console.log(`🎉 WIPE COMPLETE - removed ${deleted}/${allFiles.length} file(s) (errors: ${errors}).`);
  console.log('═══════════════════════════════════════════════════════════\n');
}

wipeJobsKeepPeople().catch((err) => {
  console.error('❌ Fatal error:', err?.message || String(err));
  process.exit(1);
});

