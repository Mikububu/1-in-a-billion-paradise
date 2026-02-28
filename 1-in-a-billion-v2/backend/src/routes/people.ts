import { Hono } from 'hono';
import { env } from '../config/env';
import type { AppEnv } from '../types/hono';

const router = new Hono<AppEnv>();

function getBearerToken(c: any): string | null {
  const auth = c.req.header('Authorization') || c.req.header('authorization');
  if (!auth) return null;
  const m = auth.match(/^Bearer\s+(.+)$/i);
  return m ? m[1] : null;
}

const normalizeStoragePath = (p: unknown): { bucketHint?: 'readings' | 'job-artifacts'; path: string } | null => {
  if (typeof p !== 'string') return null;
  const s = p.trim();
  if (!s) return null;
  if (s.startsWith('readings/')) return { bucketHint: 'readings', path: s.slice('readings/'.length) };
  if (s.startsWith('job-artifacts/')) return { bucketHint: 'job-artifacts', path: s.slice('job-artifacts/'.length) };
  return { path: s };
};

const chunk = <T,>(arr: T[], size: number) => {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
};

/**
 * DELETE /api/people/:clientPersonId
 *
 * Requires Authorization: Bearer <supabase access token>
 *
 * Deletes:
 * - jobs involving this person (by person id match in params/input)
 * - job_artifacts and their Storage files (best-effort)
 * - library_people row
 *
 * Uses service role to bypass RLS (required for storage deletion + reliable cleanup).
 */
router.delete('/:clientPersonId', async (c) => {
  try {
    const accessToken = getBearerToken(c);
    if (!accessToken) {
      return c.json({ success: false, error: 'Missing authorization token' }, 401);
    }

    const supabaseUrl = env.SUPABASE_URL;
    const supabaseServiceKey = env.SUPABASE_SERVICE_ROLE_KEY;
    const supabaseAnonKey = env.SUPABASE_ANON_KEY;

    if (!supabaseUrl?.trim() || !supabaseServiceKey?.trim() || !supabaseAnonKey?.trim()) {
      return c.json(
        {
          success: false,
          error: 'Supabase not configured (missing SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY / SUPABASE_ANON_KEY)',
        },
        500
      );
    }

    const { createClient } = await import('@supabase/supabase-js');

    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: `Bearer ${accessToken}` } },
    });

    const {
      data: { user },
      error: authError,
    } = await userClient.auth.getUser();

    if (authError || !user) {
      return c.json({ success: false, error: 'Invalid or expired token' }, 401);
    }

    const userId = user.id;
    const clientPersonId = c.req.param('clientPersonId');
    if (!clientPersonId) return c.json({ success: false, error: 'Missing clientPersonId' }, 400);

    const serviceClient = createClient(supabaseUrl, supabaseServiceKey);

    // 1) Find person row (for logging + optional name match fallback)
    const { data: personRow } = await serviceClient
      .from('library_people')
      .select('client_person_id,name,is_user')
      .eq('user_id', userId)
      .eq('client_person_id', clientPersonId)
      .maybeSingle();

    if (personRow?.is_user === true) {
      return c.json({ success: false, error: 'Cannot delete user profile' }, 400);
    }

    // 2) Find jobs involving this person (prefer ID match; fallback to name match if needed)
    // NOTE: Some deployments have `jobs.params` but NOT `jobs.input`.
    // Keep this query compatible by selecting only `id, params`.
    const { data: jobs, error: jobsFetchError } = await serviceClient
      .from('jobs')
      .select('id, params')
      .eq('user_id', userId);

    if (jobsFetchError) {
      console.error('Failed to load jobs:', jobsFetchError);
      return c.json({ success: false, error: 'Failed to load related data' }, 500);
    }

    const personName = personRow?.name;
    const jobsToDelete =
      (jobs || []).filter((job: any) => {
        const params = job?.params || {};
        const p1 = params.person1 || {};
        const p2 = params.person2 || {};
        const p1Id = p1?.id;
        const p2Id = p2?.id;
        const p1Name = p1?.name;
        const p2Name = p2?.name;
        if (p1Id === clientPersonId || p2Id === clientPersonId) return true;
        if (personName && (p1Name === personName || p2Name === personName)) return true;
        return false;
      }) || [];

    const jobIds = jobsToDelete.map((j: any) => j.id).filter(Boolean);

    // 3) Delete storage files for artifacts (best-effort)
    let deletedFilesCount = 0;
    if (jobIds.length > 0) {
      const { data: artifacts } = await serviceClient
        .from('job_artifacts')
        .select('storage_path')
        .in('job_id', jobIds);

      const normalized = (artifacts || [])
        .map((a: any) => normalizeStoragePath(a?.storage_path))
        .filter(Boolean) as Array<{ bucketHint?: 'readings' | 'job-artifacts'; path: string }>;

      const readingsPaths: string[] = [];
      const jobArtifactsPaths: string[] = [];
      const unknownPaths: string[] = [];

      for (const n of normalized) {
        if (n.bucketHint === 'readings') readingsPaths.push(n.path);
        else if (n.bucketHint === 'job-artifacts') jobArtifactsPaths.push(n.path);
        else unknownPaths.push(n.path);
      }

      // Unknown paths: try in both buckets (best-effort)
      const tryInReadings = [...readingsPaths, ...unknownPaths];
      const tryInJobArtifacts = [...jobArtifactsPaths, ...unknownPaths];

      for (const batch of chunk(tryInReadings, 100)) {
        if (batch.length === 0) continue;
        const { error } = await serviceClient.storage.from('readings').remove(batch);
        if (!error) deletedFilesCount += batch.length;
      }

      for (const batch of chunk(tryInJobArtifacts, 100)) {
        if (batch.length === 0) continue;
        const { error } = await serviceClient.storage.from('job-artifacts').remove(batch);
        if (!error) deletedFilesCount += batch.length;
      }
    }

    // 4) Delete jobs (cascades to tasks/artifacts via FK)
    let deletedJobsCount = 0;
    if (jobIds.length > 0) {
      const { error: delJobsError } = await serviceClient.from('jobs').delete().in('id', jobIds);
      if (delJobsError) {
        console.error('Failed to delete jobs:', delJobsError);
        return c.json({ success: false, error: 'Failed to delete related data' }, 500);
      }
      deletedJobsCount = jobIds.length;
    }

    // 5) Delete the person
    const { error: delPersonError } = await serviceClient
      .from('library_people')
      .delete()
      .eq('user_id', userId)
      .eq('client_person_id', clientPersonId);

    if (delPersonError) {
      console.error('Failed to delete person:', delPersonError);
      return c.json({ success: false, error: 'Failed to delete person' }, 500);
    }

    return c.json({
      success: true,
      deletedJobs: deletedJobsCount,
      deletedFiles: deletedFilesCount,
      deletedPersonId: clientPersonId,
      deletedPersonName: personName || null,
    });
  } catch (err: any) {
    console.error('Delete person error:', err);
    return c.json({ success: false, error: 'An unexpected error occurred' }, 500);
  }
});

export default router;

