/**
 * ACCOUNT PURGE ENDPOINT
 *
 * DELETE /api/account/purge
 *
 * Completely deletes a user's account and all associated data.
 * This is an irreversible operation that wipes out ALL user data.
 *
 * Deletes in order:
 * 1. library_people (self profile + partners)
 * 2. jobs, job_tasks, job_artifacts (DB records)
 * 3. vedic_people, vedic_matches, vedic_match_jobs, vedic_job_artifacts
 * 4. user_activity, user_notes, subscription_history
 * 5. audiobook_jobs, audiobook_chapters
 * 6. Supabase Storage files (job-artifacts bucket)
 * 7. user_commercial_state
 * 8. auth.users record (final step - cascades to any remaining tables)
 *
 * Note: RunPod jobs are ephemeral and don't need cleanup.
 *
 * GDPR Compliant: Complete data deletion with zero orphaned records.
 */
import { Hono } from 'hono';
import type { AppEnv } from '../types/hono';
declare const router: Hono<AppEnv, import("hono/types").BlankSchema, "/">;
export default router;
//# sourceMappingURL=account.d.ts.map