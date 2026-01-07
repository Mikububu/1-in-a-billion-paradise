/**
 * ACCOUNT DELETION API
 * 
 * Calls the backend hard-delete endpoint to permanently delete
 * all user data including auth.users record.
 */

import { supabase } from './supabase';

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

    // Get backend URL from environment
    // Use centralized env config (same as other services)
    const backendUrl = process.env.EXPO_PUBLIC_CORE_API_URL || process.env.EXPO_PUBLIC_API_URL || 'https://1-in-a-billion-backend.fly.dev';

    if (!backendUrl) {
        throw new Error('Backend URL not configured. Please set EXPO_PUBLIC_CORE_API_URL in your .env file.');
    }

    // Construct full URL
    const fullUrl = `${backendUrl}/api/account/purge`;
    console.log('🗑️ DELETE Account - Full URL:', fullUrl);
    console.log('🗑️ DELETE Account - Has token:', !!accessToken);

    // Call backend hard-delete endpoint
    const response = await fetch(fullUrl, {
        method: 'DELETE',
        headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
        },
    });

    console.log('🗑️ DELETE Account - Response status:', response.status);

    // Log 404 details for debugging
    if (response.status === 404) {
        console.error('❌ 404 Not Found - Request details:');
        console.error('   URL:', fullUrl);
        console.error('   Method: DELETE');
        console.error('   Backend URL:', backendUrl);
        const text = await response.text();
        console.error('   Response body:', text);
        throw new Error(`Endpoint not found: ${fullUrl}`);
    }

    if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `Failed to delete account: ${response.status}`);
    }

    const result = await response.json();

    if (!result.success) {
        throw new Error(result.error || 'Account deletion failed');
    }

    // Sign out locally (session is already invalid on backend)
    await supabase.auth.signOut();
}
