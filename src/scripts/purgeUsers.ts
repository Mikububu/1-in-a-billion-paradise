import 'dotenv/config';
import { createSupabaseServiceClient } from '../services/supabaseClient';

/**
 * Purge a user (all app data + storage + auth user) by userId.
 * This intentionally mirrors the deletion order in `src/routes/account.ts`.
 */
async function purgeUserById(serviceClient: any, userId: string) {
  console.log(JSON.stringify({ step: 'start', userId }));

  // STEP 1: Delete library_people (self profile + partners)
  await serviceClient.from('library_people').delete().eq('user_id', userId);

  // STEP 2: Delete jobs (cascades to job_tasks and job_artifacts)
  await serviceClient.from('jobs').delete().eq('user_id', userId);

  // STEP 3: Delete commercial state (optional table)
  try {
    await serviceClient.from('user_commercial_state').delete().eq('user_id', userId);
  } catch {}

  // STEP 4: Delete Vedic matchmaking data (optional tables)
  try {
    const { data: vedicJobs } = await serviceClient
      .from('vedic_match_jobs')
      .select('id')
      .eq('user_id', userId);

    const ids = Array.isArray(vedicJobs) ? vedicJobs.map((j: any) => j.id) : [];
    if (ids.length) {
      await serviceClient.from('vedic_job_artifacts').delete().in('job_id', ids);
    }

    await serviceClient.from('vedic_match_jobs').delete().eq('user_id', userId);
    await serviceClient.from('vedic_matches').delete().eq('user_id', userId);
    await serviceClient.from('vedic_people').delete().eq('user_id', userId);
  } catch {}

  // STEP 5: Delete tracking data (optional tables)
  try {
    await serviceClient.from('user_activity').delete().eq('user_id', userId);
    await serviceClient.from('user_notes').delete().eq('user_id', userId);
    await serviceClient.from('subscription_history').delete().eq('user_id', userId);
  } catch {}

  // STEP 6: Delete audiobook jobs and chapters (optional tables)
  try {
    const { data: audiobookJobs } = await serviceClient
      .from('audiobook_jobs')
      .select('id')
      .eq('user_id', userId);
    const jobIds = Array.isArray(audiobookJobs) ? audiobookJobs.map((j: any) => j.id) : [];
    if (jobIds.length) {
      await serviceClient.from('audiobook_chapters').delete().in('job_id', jobIds);
    }
    await serviceClient.from('audiobook_jobs').delete().eq('user_id', userId);
  } catch {}

  // STEP 7: Delete Supabase Storage artifacts (job-artifacts bucket)
  try {
    const { data: files } = await serviceClient.storage.from('job-artifacts').list(userId);
    const names = Array.isArray(files) ? files.map((f: any) => f.name).filter(Boolean) : [];
    if (names.length) {
      const filePaths = names.map((n: string) => `${userId}/${n}`);
      await serviceClient.storage.from('job-artifacts').remove(filePaths);
    }
  } catch {}

  // STEP 8: Delete auth user (final)
  await serviceClient.auth.admin.deleteUser(userId);

  console.log(JSON.stringify({ step: 'done', userId }));
}

async function findUserIdByEmail(serviceClient: any, email: string): Promise<string | null> {
  const perPage = 200;
  let page = 1;
  for (;;) {
    const { data, error } = await serviceClient.auth.admin.listUsers({ page, perPage });
    if (error) throw error;
    const users = data?.users || [];
    const match = users.find((u: { id?: string; email?: string | null }) => (u.email || '').trim().toLowerCase() === email);
    if (match?.id) return match.id;
    if (users.length < perPage) return null;
    page += 1;
  }
}

async function listAllUserIds(serviceClient: any): Promise<string[]> {
  const perPage = 200;
  let page = 1;
  const ids: string[] = [];
  for (;;) {
    const { data, error } = await serviceClient.auth.admin.listUsers({ page, perPage });
    if (error) throw error;
    const users = data?.users || [];
    for (const u of users) if (u?.id) ids.push(u.id);
    if (users.length < perPage) break;
    page += 1;
  }
  return ids;
}

async function main() {
  const confirm = (process.env.CONFIRM || '').trim();
  if (confirm !== 'WIPE_ALL') {
    throw new Error('Refusing to run without CONFIRM=WIPE_ALL');
  }

  const serviceClient = createSupabaseServiceClient();
  if (!serviceClient) {
    throw new Error('Supabase service client not configured (SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY).');
  }

  const emailRaw = process.env.EMAIL;
  const email = typeof emailRaw === 'string' ? emailRaw.trim().toLowerCase() : '';

  if (email) {
    const id = await findUserIdByEmail(serviceClient, email);
    if (!id) {
      console.log(JSON.stringify({ ok: true, action: 'noop', message: 'No user found for email', email }));
      return;
    }
    await purgeUserById(serviceClient, id);
    console.log(JSON.stringify({ ok: true, action: 'purged_email', email, userId: id }));
    return;
  }

  // No EMAIL provided -> purge ALL users
  const ids = await listAllUserIds(serviceClient);
  console.log(JSON.stringify({ ok: true, action: 'purge_all_start', count: ids.length }));
  for (const id of ids) {
    await purgeUserById(serviceClient, id);
  }
  console.log(JSON.stringify({ ok: true, action: 'purge_all_done', count: ids.length }));
}

main().catch((err) => {
  console.error(JSON.stringify({ ok: false, error: err?.message || String(err) }));
  process.exit(1);
});


