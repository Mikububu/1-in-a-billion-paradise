/**
 * SUPABASE HOOK AUDIO SYNC (CLIENT)
 *
 * Uploads hook audio (base64 mp3) to Supabase Storage and returns a storage path.
 * This lets us reuse hook audio across devices/re-installs for:
 * - main user (onboarding hookAudio)
 * - 3rd-person people (partnerAudio flow)
 *
 * Storage bucket (recommended): "library"
 * - private bucket
 * - default storage.objects owner should be the authed user
 */

import { supabase, isSupabaseConfigured } from '@/services/supabase';

export const HOOK_AUDIO_BUCKET = 'library';

export type HookAudioType = 'sun' | 'moon' | 'rising';

export async function uploadHookAudioBase64(params: {
    userId: string;
    personId: string;
    type: HookAudioType;
    audioBase64: string;
}): Promise<{ success: true; path: string } | { success: false; error: string }> {
    const { userId, personId, type, audioBase64 } = params;

    if (!isSupabaseConfigured) return { success: false, error: 'Supabase not configured' };
    if (!userId) return { success: false, error: 'Missing userId' };
    if (!personId) return { success: false, error: 'Missing personId' };
    if (!audioBase64) return { success: false, error: 'Missing audioBase64' };

    // Stable path so we can upsert without growing storage endlessly.
    const path = `hook-audio/${userId}/${personId}/${type}.mp3`;

    try {
        // Convert base64 → Blob via data URL (works in Expo/React Native fetch)
        const blob = await (await fetch(`data:audio/mpeg;base64,${audioBase64}`)).blob();

        const { error } = await supabase.storage
            .from(HOOK_AUDIO_BUCKET)
            .upload(path, blob, {
                contentType: 'audio/mpeg',
                upsert: true,
                cacheControl: '3600',
            });

        if (error) return { success: false, error: error.message };
        return { success: true, path };
    } catch (e: any) {
        return { success: false, error: e?.message || 'Upload failed' };
    }
}

export async function getHookAudioPublicUrl(path: string) {
    // Note: for private buckets, this URL may not be directly fetchable without a signed URL.
    // We keep it anyway for debugging / future signed-url support.
    if (!isSupabaseConfigured) return null;
    if (!path) return null;
    const { data } = supabase.storage.from(HOOK_AUDIO_BUCKET).getPublicUrl(path);
    return data?.publicUrl || null;
}

export async function getHookAudioSignedUrl(path: string, expiresIn = 3600) {
    if (!isSupabaseConfigured) return null;
    if (!path) return null;
    try {
        const { data, error } = await supabase.storage
            .from(HOOK_AUDIO_BUCKET)
            .createSignedUrl(path, expiresIn);
        if (error) return null;
        return data?.signedUrl || null;
    } catch {
        return null;
    }
}

/**
 * Download hook audio from Supabase Storage and return base64
 * Used for syncing audio across devices (reinstalls, new logins)
 */
export async function downloadHookAudioBase64(params: {
    userId: string;
    personId: string;
    type: HookAudioType;
}): Promise<{ success: true; audioBase64: string } | { success: false; error: string }> {
    const { userId, personId, type } = params;

    if (!isSupabaseConfigured) return { success: false, error: 'Supabase not configured' };
    if (!userId) return { success: false, error: 'Missing userId' };
    if (!personId) return { success: false, error: 'Missing personId' };

    const path = `hook-audio/${userId}/${personId}/${type}.mp3`;

    try {
        const { data, error } = await supabase.storage
            .from(HOOK_AUDIO_BUCKET)
            .download(path);

        if (error) return { success: false, error: error.message };
        if (!data) return { success: false, error: 'No data returned' };

        // Validate Blob
        console.log(`🔍 Downloaded blob: size=${data.size}, type=${data.type}`);

        if (data.size < 100) {
            // Too small for MP3, likely an error message
            const text = await new Response(data).text();
            return { success: false, error: `Downloaded data too small (${data.size}b) - content: ${text.substring(0, 100)}` };
        }

        if (data.type && (data.type.includes('text') || data.type.includes('json') || data.type.includes('html'))) {
            const text = await new Response(data).text();
            return { success: false, error: `Invalid content type: ${data.type} - content: ${text.substring(0, 100)}` };
        }

        // Convert Blob to base64
        const reader = new FileReader();
        const base64Promise = new Promise<string>((resolve, reject) => {
            reader.onloadend = () => {
                const result = reader.result as string;
                // Strip data URI prefix to get pure base64
                const base64 = result.split(',')[1] || result;
                resolve(base64);
            };
            reader.onerror = reject;
        });

        reader.readAsDataURL(data);
        const audioBase64 = await base64Promise;

        return { success: true, audioBase64 };
    } catch (e: any) {
        return { success: false, error: e?.message || 'Download failed' };
    }
}
