import 'dotenv/config';
import { createSupabaseServiceClient } from '../services/supabaseClient';

/**
 * Delete a Supabase auth user by email (service role required).
 *
 * Usage:
 *   EMAIL="user@example.com" ts-node src/scripts/deleteUserByEmail.ts
 */
async function main() {
  const emailRaw = process.env.EMAIL;
  const email = typeof emailRaw === 'string' ? emailRaw.trim().toLowerCase() : '';
  if (!email) {
    throw new Error('Missing EMAIL env var. Example: EMAIL="user@example.com" ts-node src/scripts/deleteUserByEmail.ts');
  }

  const supabase = createSupabaseServiceClient();
  if (!supabase) {
    throw new Error('Supabase service client not configured. Check SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.');
  }

  // Find user by iterating pages (Supabase admin listUsers is paginated).
  const perPage = 200;
  let page = 1;
  let foundUserId: string | null = null;

  for (;;) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage });
    if (error) throw error;

    const users = data?.users || [];
    const match = users.find((u: { id?: string; email?: string | null }) => (u.email || '').trim().toLowerCase() === email);
    if (match?.id) {
      foundUserId = match.id;
      break;
    }

    if (users.length < perPage) break; // reached end
    page += 1;
  }

  if (!foundUserId) {
    console.log(JSON.stringify({ ok: true, action: 'noop', message: 'User not found for email', email }));
    return;
  }

  const { error: delErr } = await supabase.auth.admin.deleteUser(foundUserId);
  if (delErr) throw delErr;

  console.log(JSON.stringify({ ok: true, action: 'deleted', email, userId: foundUserId }));
}

main().catch((err) => {
  console.error(JSON.stringify({ ok: false, error: err?.message || String(err) }));
  process.exit(1);
});


