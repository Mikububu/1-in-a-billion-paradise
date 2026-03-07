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
export {};
//# sourceMappingURL=cleanupOldArtifacts.d.ts.map