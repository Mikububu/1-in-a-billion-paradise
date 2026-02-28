import { env } from '@/config/env';
import { useAuthStore } from '@/store/authStore';
import { getAuthHeaders } from '@/services/api';

export type UploadPhotoResult = {
    success: boolean;
    portraitUrl?: string;
    originalUrl?: string;
    error?: string;
};

export async function uploadPersonPhoto(personId: string, photoBase64: string): Promise<UploadPhotoResult> {
    try {
        const userId = useAuthStore.getState().session?.user?.id || useAuthStore.getState().user?.id;
        if (!userId) return { success: false, error: 'User not authenticated' };
        if (!env.CORE_API_URL) return { success: false, error: 'CORE_API_URL is not configured' };

        const response = await fetch(`${env.CORE_API_URL}/api/profile/portrait`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                ...getAuthHeaders(),
            },
            body: JSON.stringify({
                personId,
                photoBase64,
            }),
        });

        if (!response.ok) {
            const text = await response.text().catch(() => '');
            return { success: false, error: text || `Upload failed (${response.status})` };
        }

        const data = await response.json();
        if (!data?.success || !data?.imageUrl) {
            return { success: false, error: data?.error || 'Portrait generation failed' };
        }

        return {
            success: true,
            portraitUrl: String(data.imageUrl),
            originalUrl: typeof data.originalUrl === 'string' ? data.originalUrl : undefined,
        };
    } catch (error: any) {
        return { success: false, error: error?.message || 'Unknown error' };
    }
}
