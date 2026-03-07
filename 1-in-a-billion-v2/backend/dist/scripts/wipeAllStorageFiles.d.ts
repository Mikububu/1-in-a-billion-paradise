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
export {};
//# sourceMappingURL=wipeAllStorageFiles.d.ts.map