/**
 * NUCLEAR CLEANUP - All-in-one Supabase storage reclaimer
 *
 * Combines: analyzeDatabaseSize + wipeAllStorageFiles + wipeAppDataKeepUsers
 *
 * Steps:
 *   1. Analyze - show table row counts & storage bucket file counts
 *   2. Wipe storage - delete ALL files from ALL buckets
 *   3. Wipe database - delete jobs, job_tasks, job_artifacts, library_people
 *   4. Print VACUUM reminder (must be run manually in SQL Editor)
 *
 * Auth users are ALWAYS preserved.
 *
 * Usage:
 *   # Dry run (safe - only shows what would be deleted):
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
export {};
//# sourceMappingURL=nuclearCleanup.d.ts.map