import 'dotenv/config';
import { createSupabaseServiceClient } from '../services/supabaseClient';

/**
 * Investigate whether an email is associated with:
 * - multiple Supabase Auth users (should not happen under normal settings)
 * - a matching library_people (is_user=true) profile row
 * - jobs in the V2 queue (jobs / job_tasks / job_artifacts)
 *
 * Usage:
 *   EMAIL="cooltantra@gmail.com" ts-node src/scripts/investigateAccountByEmail.ts
 */
async function main() {
  const emailRaw = process.env.EMAIL;
  const email = typeof emailRaw === 'string' ? emailRaw.trim().toLowerCase() : '';
  if (!email) {
    throw new Error('Missing EMAIL env var. Example: EMAIL="cooltantra@gmail.com" ts-node src/scripts/investigateAccountByEmail.ts');
  }

  const supabase = createSupabaseServiceClient();
  if (!supabase) {
    throw new Error('Supabase service client not configured. Check SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.');
  }

  // 1) Find ALL auth users matching this email (admin listUsers is paginated).
  const perPage = 200;
  let page = 1;
  const authMatches: any[] = [];

  for (;;) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage });
    if (error) throw error;

    const users = data?.users || [];
    for (const u of users) {
      const uEmail = (u?.email || '').trim().toLowerCase();
      if (uEmail === email) authMatches.push(u);
    }

    if (users.length < perPage) break;
    page += 1;
  }

  // 2) Find library_people user profiles by email and by user_id (for each auth match).
  const { data: profilesByEmail, error: profilesByEmailError } = await supabase
    .from('library_people')
    .select('user_id, is_user, name, email, created_at, updated_at')
    .eq('is_user', true)
    .ilike('email', email);

  if (profilesByEmailError) throw profilesByEmailError;

  const profilesByUserId: Record<string, any[]> = {};
  for (const u of authMatches) {
    const uid = u.id;
    const { data: profiles, error } = await supabase
      .from('library_people')
      .select('user_id, is_user, name, email, created_at, updated_at, birth_data, hook_readings')
      .eq('is_user', true)
      .eq('user_id', uid);
    if (error) throw error;
    profilesByUserId[uid] = profiles || [];
  }

  // 3) Jobs counts per user id (jobs table)
  const jobsByUserId: Record<string, any> = {};
  for (const u of authMatches) {
    const uid = u.id;

    const { count: jobsCount, error: jobsErr } = await supabase
      .from('jobs')
      .select('id', { head: true, count: 'exact' })
      .eq('user_id', uid);
    if (jobsErr) throw jobsErr;
    jobsByUserId[uid] = { jobsCount: jobsCount || 0 };
  }

  const result = {
    ok: true,
    email,
    authMatches: authMatches.map((u) => ({
      id: u.id,
      email: u.email,
      created_at: u.created_at,
      last_sign_in_at: u.last_sign_in_at,
      provider: u.app_metadata?.provider || 'email',
      providers: u.app_metadata?.providers || undefined,
      user_metadata: u.user_metadata || undefined,
    })),
    profilesByEmail,
    profilesByUserId,
    jobsByUserId,
    interpretationHints: {
      ifMultipleAuthUsers:
        'If authMatches.length > 1, this indicates duplicate emails in Supabase Auth OR you are pointing at different Supabase projects in different builds.',
      ifNoProfiles:
        'If authMatches exists but profilesByUserId[uid] is empty, the app will look like "no people" because everything is keyed off user_id in library_people/jobs.',
    },
  };

  // Print as JSON for easy copy/paste.
  // eslint-disable-next-line no-console
  console.log(JSON.stringify(result, null, 2));
}

main().catch((err) => {
  const safeErr =
    err && typeof err === 'object'
      ? JSON.stringify(err, Object.getOwnPropertyNames(err))
      : String(err);
  // eslint-disable-next-line no-console
  console.error(JSON.stringify({ ok: false, error: err?.message || safeErr }));
  process.exit(1);
});

