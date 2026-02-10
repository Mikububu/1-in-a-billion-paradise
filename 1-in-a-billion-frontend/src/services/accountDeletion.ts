/**
 * ACCOUNT DELETION API
 * 
 * Calls the backend hard-delete endpoint to permanently delete
 * all user data including auth.users record.
 */

import { supabase } from './supabase';
import { env } from '@/config/env';

async function fetchWithTimeout(input: RequestInfo, init: RequestInit & { timeoutMs?: number } = {}) {
  const { timeoutMs = 15000, ...rest } = init;
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(input, { ...rest, signal: controller.signal });
  } finally {
    clearTimeout(t);
  }
}

/**
 * Delete user account and all associated data
 * 
 * This calls the backend /api/account/purge endpoint which:
 * 1. Deletes library_people records
 * 2. Deletes jobs (cascades to job_tasks and job_artifacts)
 * 3. Deletes vedic matchmaking data (vedic_people, vedic_matches, vedic_match_jobs)
 * 4. Deletes user tracking data (user_activity, user_notes, subscription_history)
 * 5. Deletes audiobook jobs and chapters
 * 6. Deletes Supabase Storage files
 * 7. Deletes commercial state
 * 8. Deletes auth.users record (final step)
 * 
 * GDPR Compliant: Complete data wipe with zero orphaned records.
 * 
 * @throws Error if deletion fails
 */
export async function deleteAccount(): Promise<void> {
    // Get current session for auth token
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();

    if (sessionError || !session) {
        throw new Error('Not authenticated');
    }

    const accessToken = session.access_token;

    const baseCandidates = [
        env.CORE_API_URL,
        // Fallbacks (helpful when env points at Fly but dev backend is running locally)
        'http://172.20.10.2:8787',
        'http://localhost:8787',
        'http://127.0.0.1:8787',
        'https://1-in-a-billion-backend.fly.dev',
    ];
    const bases = Array.from(new Set(baseCandidates.filter(Boolean)));

    let lastErr: any = null;
    for (const base of bases) {
        const fullUrl = `${base}/api/account/purge`;
        try {
            console.log('🗑️ DELETE Account - Trying:', fullUrl);
            const response = await fetchWithTimeout(fullUrl, {
                method: 'DELETE',
                headers: {
                    'Authorization': `Bearer ${accessToken}`,
                    'Content-Type': 'application/json',
                },
                timeoutMs: 15000,
            });

            console.log('🗑️ DELETE Account - Response status:', response.status, 'base:', base);

            if (response.status === 404) {
                const text = await response.text().catch(() => '');
                console.error('❌ 404 Not Found:', { fullUrl, base, text });
                lastErr = new Error(`Endpoint not found: ${fullUrl}`);
                continue; // try next base
            }

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({} as any));
                lastErr = new Error(errorData.error || `Failed to delete account: ${response.status}`);
                continue; // try next base
            }

            const result = await response.json();
            if (!result.success) {
                lastErr = new Error(result.error || 'Account deletion failed');
                continue;
            }

            // Success
            lastErr = null;
            break;
        } catch (e: any) {
            console.error('❌ Account deletion network error for base:', base, e?.message || e);
            lastErr = e;
            continue;
        }
    }

    if (lastErr) {
        // Surface a user-friendly error
        throw new Error(lastErr?.message || 'Network error deleting account');
    }

    // Sign out locally (session is already invalid on backend)
    await supabase.auth.signOut();
}
