/**
 * NUCLEAR CLEANUP — All-in-one Supabase storage reclaimer
 *
 * Combines: analyzeDatabaseSize + wipeAllStorageFiles + wipeAppDataKeepUsers
 *
 * Steps:
 *   1. Analyze — show table row counts & storage bucket file counts
 *   2. Wipe storage — delete ALL files from ALL buckets
 *   3. Wipe database — delete jobs, job_tasks, job_artifacts, library_people
 *   4. Print VACUUM reminder (must be run manually in SQL Editor)
 *
 * Auth users are ALWAYS preserved.
 *
 * Usage:
 *   # Dry run (safe — only shows what would be deleted):
 *   npx ts-node src/scripts/nuclearCleanup.ts --dry-run
 *
 *   # Actually delete everything:
 *   CONFIRM=NUKE npx ts-node src/scripts/nuclearCleanup.ts --confirm
 *
 *   # Storage only (no DB wipe):
 *   CONFIRM=NUKE npx ts-node src/scripts/nuclearCleanup.ts --confirm --storage-only
 *
 *   # DB only (no storage wipe):
 *   CONFIRM=NUKE npx ts-node src/scripts/nuclearCleanup.ts --confirm --db-only
 */

import { createSupabaseServiceClient } from '../services/supabaseClient';
import { config } from 'dotenv';
import { join } from 'path';

config({ path: join(__dirname, '../../.env') });

/* ── helpers ──────────────────────────────────────────────────────── */

async function listAllFiles(
  supabase: any,
  bucketName: string,
  folderPath = '',
  allFiles: string[] = [],
): Promise<string[]> {
  const { data: files, error } = await supabase.storage
    .from(bucketName)
    .list(folderPath, { limit: 1000, offset: 0, sortBy: { column: 'name', order: 'asc' } });

  if (error || !files?.length) return allFiles;

  for (const file of files) {
    const fullPath = folderPath ? `${folderPath}/${file.name}` : file.name;
    if (file.id === null) {
      await listAllFiles(supabase, bucketName, fullPath, allFiles);
    } else {
      allFiles.push(fullPath);
    }
  }
  return allFiles;
}

async function deleteBucketFiles(supabase: any, bucketName: string): Promise<number> {
  const allFiles = await listAllFiles(supabase, bucketName);
  if (!allFiles.length) return 0;

  let deleted = 0;
  const batch = 100;
  for (let i = 0; i < allFiles.length; i += batch) {
    const chunk = allFiles.slice(i, i + batch);
    const { error } = await supabase.storage.from(bucketName).remove(chunk);
    if (error) {
      console.error(`   ❌ ${bucketName} batch error: ${error.message}`);
    } else {
      deleted += chunk.length;
      console.log(`   ✅ ${bucketName}: ${deleted}/${allFiles.length}`);
    }
  }
  return deleted;
}

/* ── main ─────────────────────────────────────────────────────────── */

async function nuclearCleanup() {
  const supabase = createSupabaseServiceClient();
  if (!supabase) {
    console.error('❌ Supabase not configured (SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY).');
    process.exit(1);
  }

  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');
  const confirmed = args.includes('--confirm') || args.includes('-y');
  const storageOnly = args.includes('--storage-only');
  const dbOnly = args.includes('--db-only');

  if (!dryRun && (!confirmed || process.env.CONFIRM !== 'NUKE')) {
    console.log('☢️  NUCLEAR CLEANUP');
    console.log('═══════════════════════════════════════════════════════════');
    console.log('This will delete ALL app data & storage files.');
    console.log('Auth users are preserved.\n');
    console.log('Options:');
    console.log('  --dry-run         Preview only (safe)');
    console.log('  --confirm         Execute deletion (requires CONFIRM=NUKE)');
    console.log('  --storage-only    Only wipe storage buckets');
    console.log('  --db-only         Only wipe database tables\n');
    console.log('Example:');
    console.log('  CONFIRM=NUKE npx ts-node src/scripts/nuclearCleanup.ts --confirm\n');
    process.exit(1);
  }

  console.log(dryRun
    ? '🔍 DRY RUN — NUCLEAR CLEANUP'
    : '☢️  EXECUTING NUCLEAR CLEANUP');
  console.log('═══════════════════════════════════════════════════════════\n');

  /* ── Step 1: Analyze ─────────────────────────────────────────── */

  console.log('📊 STEP 1 — Analyze current usage\n');

  // Table row counts
  const tables = ['jobs', 'job_tasks', 'job_artifacts', 'library_people',
    'user_readings', 'job_notification_settings'];
  const rowCounts: Record<string, number> = {};
  for (const t of tables) {
    try {
      const { count, error } = await supabase.from(t).select('*', { count: 'exact', head: true });
      if (!error) rowCounts[t] = count || 0;
    } catch { /* skip */ }
  }

  console.log('   Table'.padEnd(35) + 'Rows');
  console.log('   ' + '─'.repeat(50));
  let totalRows = 0;
  for (const [table, count] of Object.entries(rowCounts).sort((a, b) => b[1] - a[1])) {
    totalRows += count;
    console.log(`   ${table.padEnd(30)} ${count.toLocaleString().padStart(10)}`);
  }
  console.log('   ' + '─'.repeat(50));
  console.log(`   ${'TOTAL'.padEnd(30)} ${totalRows.toLocaleString().padStart(10)}\n`);

  // Storage bucket file counts
  const { data: buckets } = await supabase.storage.listBuckets();
  const bucketStats: Record<string, number> = {};
  if (buckets?.length) {
    for (const b of buckets) {
      const files = await listAllFiles(supabase, b.name);
      bucketStats[b.name] = files.length;
    }
    console.log('   Bucket'.padEnd(35) + 'Files');
    console.log('   ' + '─'.repeat(50));
    let totalFiles = 0;
    for (const [bucket, count] of Object.entries(bucketStats).sort((a, b) => b[1] - a[1])) {
      totalFiles += count;
      console.log(`   ${bucket.padEnd(30)} ${count.toLocaleString().padStart(10)}`);
    }
    console.log('   ' + '─'.repeat(50));
    console.log(`   ${'TOTAL'.padEnd(30)} ${totalFiles.toLocaleString().padStart(10)}\n`);
  }

  if (dryRun) {
    console.log('═══════════════════════════════════════════════════════════');
    console.log('🔍 DRY RUN COMPLETE — nothing was deleted.');
    console.log('   Run with CONFIRM=NUKE --confirm to execute.\n');
    return;
  }

  /* ── Step 2: Wipe Storage ────────────────────────────────────── */

  // Buckets that must NOT be wiped (used live by the app)
  const PROTECTED_BUCKETS = new Set(['voice-samples', 'audio', 'voices']);

  if (!dbOnly) {
    console.log('🗑️  STEP 2 — Wiping storage buckets\n');
    console.log(`   🛡️  Protected (skipped): ${[...PROTECTED_BUCKETS].join(', ')}\n`);
    let storageDeleted = 0;
    if (buckets?.length) {
      for (const b of buckets) {
        if (PROTECTED_BUCKETS.has(b.name)) {
          console.log(`   ⏭️  ${b.name}: PROTECTED — skipping`);
          continue;
        }
        if (bucketStats[b.name] === 0) continue;
        storageDeleted += await deleteBucketFiles(supabase, b.name);
      }
    }
    console.log(`\n   ✅ Storage: ${storageDeleted} file(s) deleted.\n`);
  }

  /* ── Step 3: Wipe Database ───────────────────────────────────── */

  if (!storageOnly) {
    console.log('🗑️  STEP 3 — Wiping database tables\n');

    const delOrder = ['job_artifacts', 'job_tasks', 'jobs', 'library_people'];
    for (const table of delOrder) {
      const before = rowCounts[table] || 0;
      if (before === 0) {
        console.log(`   ⏭️  ${table}: already empty`);
        continue;
      }
      const { error } = await supabase.from(table).delete().neq('id', '00000000-0000-0000-0000-000000000000');
      if (error) {
        // library_people uses user_id, not id
        if (table === 'library_people') {
          await supabase.from(table).delete().neq('user_id', '00000000-0000-0000-0000-000000000000');
        } else {
          console.error(`   ❌ ${table}: ${error.message}`);
          continue;
        }
      }
      console.log(`   ✅ ${table}: ${before.toLocaleString()} rows deleted`);
    }
    console.log();
  }

  /* ── Step 4: Done ────────────────────────────────────────────── */

  console.log('═══════════════════════════════════════════════════════════');
  console.log('☢️  NUCLEAR CLEANUP COMPLETE!');
  console.log('═══════════════════════════════════════════════════════════');
  console.log('');
  console.log('⚠️  IMPORTANT — To fully reclaim disk space, run this in');
  console.log('   Supabase Dashboard → SQL Editor:');
  console.log('');
  console.log('   VACUUM FULL;');
  console.log('');
  console.log('   This compacts the database and frees the space Postgres');
  console.log('   is still holding onto from deleted rows.');
  console.log('═══════════════════════════════════════════════════════════\n');
}

nuclearCleanup().catch((err) => {
  console.error('❌ Fatal error:', err?.message || String(err));
  process.exit(1);
});
