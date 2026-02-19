/**
 * ACCOUNT DELETION API
 * 
 * Calls the backend hard-delete endpoint to permanently delete
 * all user data.
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

            if (response.status === 404) {
                lastErr = new Error(`Endpoint not found: ${fullUrl}`);
                continue;
            }

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({} as any));
                lastErr = new Error(errorData.error || `Failed to delete account: ${response.status}`);
                continue;
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
            lastErr = e;
            continue;
        }
    }

    if (lastErr) {
        throw new Error(lastErr?.message || 'Network error deleting account');
    }

    // Sign out locally
    await supabase.auth.signOut();
}
