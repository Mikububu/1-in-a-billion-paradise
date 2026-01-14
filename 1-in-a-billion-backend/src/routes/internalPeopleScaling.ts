/**
 * INTERNAL PEOPLE SCALING ROUTES
 *
 * Purpose: allow the admin panel (server-side) to kick off "people scaling"
 * (match index recomputation) without requiring the full admin JWT system yet.
 *
 * Security model (V0):
 * - Requires header: `x-admin-secret: <ADMIN_PANEL_SECRET>`
 *
 * Later we can migrate this to the proper `/api/admin/*` routes protected by admin JWT + permissions.
 */

import { Hono } from 'hono';
import { z } from 'zod';
import { env } from '../config/env';
import { createSupabaseServiceClient } from '../services/supabaseClient';

const router = new Hono();

function requireAdminSecret(c: any) {
  const secret = c.req.header('x-admin-secret');
  if (!env.ADMIN_PANEL_SECRET || secret !== env.ADMIN_PANEL_SECRET) {
    return c.json({ error: 'Unauthorized' }, 401);
  }
  return null;
}

const startSchema = z.object({
  scope: z.enum(['all', 'recent']).default('all'),
  limit: z.coerce.number().min(1).max(100000).optional(),
  batchSize: z.coerce.number().min(1).max(500).default(50),
  dryRun: z.coerce.boolean().default(false),
  reason: z.string().max(200).optional(),
});

router.post('/start', async (c) => {
  const unauthorized = requireAdminSecret(c);
  if (unauthorized) return unauthorized;

  const supabase = createSupabaseServiceClient();
  if (!supabase) return c.json({ error: 'Database connection failed' }, 500);

  const body = await c.req.json();
  const params = startSchema.parse(body);

  // Select people IDs to process
  let peopleQuery = supabase
    .from('library_people')
    .select('id, created_at')
    .order('created_at', { ascending: false });

  if (params.scope === 'recent') {
    // If "recent", we still order by created_at desc, and apply limit
  }
  if (params.limit) {
    peopleQuery = peopleQuery.limit(params.limit);
  }

  const { data: people, error: peopleErr } = await peopleQuery;
  if (peopleErr) return c.json({ error: peopleErr.message }, 500);

  const ids = (people || []).map((p: any) => p.id);
  if (ids.length === 0) {
    return c.json({ ok: true, message: 'No people found to scale', jobId: null }, 200);
  }

  // Choose a valid user_id for FK constraints (jobs.user_id → auth.users).
  // Prefer an admin user if present, otherwise fall back to the first "is_user=true" library_people.
  let jobUserId: string | null = null;

  try {
    const { data: adminRow, error: adminErr } = await supabase
      .from('admin_users')
      .select('id')
      .limit(1)
      .maybeSingle();
    if (!adminErr && adminRow?.id) jobUserId = adminRow.id;
  } catch {
    // admin tables may not be deployed yet; ignore
  }

  if (!jobUserId) {
    const { data: lpRow } = await supabase
      .from('library_people')
      .select('user_id')
      .eq('is_user', true)
      .limit(1)
      .maybeSingle();
    if (lpRow?.user_id) jobUserId = lpRow.user_id;
  }

  if (!jobUserId) {
    return c.json({ error: 'Could not resolve a valid job user_id for FK constraints' }, 500);
  }

  const jobParams = {
    ...params,
    totalPeople: ids.length,
    startedAt: new Date().toISOString(),
    triggeredBy: 'admin-panel',
  };

  const { data: job, error: jobErr } = await supabase
    .from('jobs')
    .insert({
      user_id: jobUserId,
      type: 'people_scaling',
      status: 'queued',
      params: jobParams,
      progress: { percent: 0, phase: 'queued', message: '🧬 People scaling queued' },
      attempts: 0,
      max_attempts: 1,
    } as any)
    .select('id')
    .single();

  if (jobErr || !job?.id) return c.json({ error: jobErr?.message || 'Failed to create job' }, 500);

  // Create tasks (batched)
  const batchSize = params.batchSize;
  const batches: string[][] = [];
  for (let i = 0; i < ids.length; i += batchSize) {
    batches.push(ids.slice(i, i + batchSize));
  }

  const taskRows = batches.map((batchIds, idx) => ({
    job_id: job.id,
    task_type: 'people_scaling',
    status: 'pending',
    sequence: idx,
    input: {
      personIds: batchIds,
      dryRun: params.dryRun,
      batchNum: idx + 1,
      totalBatches: batches.length,
      reason: params.reason,
    },
    attempts: 0,
    max_attempts: 2,
    heartbeat_timeout_seconds: 600,
  }));

  const { error: tasksErr } = await supabase.from('job_tasks').insert(taskRows as any);
  if (tasksErr) {
    // If tasks fail, mark job error
    await supabase.from('jobs').update({ status: 'error', error: tasksErr.message }).eq('id', job.id);
    return c.json({ error: tasksErr.message }, 500);
  }

  return c.json({ ok: true, jobId: job.id, tasks: taskRows.length });
});

export default router;

