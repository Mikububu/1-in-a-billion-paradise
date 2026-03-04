import axios from 'axios';
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

        const response = await axios.post(`${env.CORE_API_URL}/api/profile/portrait`, {
            personId,
            photoBase64,
        }, {
            headers: {
                ...getAuthHeaders(),
            },
            timeout: 60000, // 60 seconds timeout since AI generation takes ~20s
        });

        const data = response.data;
        if (!data?.success || !data?.imageUrl) {
            return { success: false, error: data?.error || 'Portrait generation failed' };
        }

        return {
            success: true,
            portraitUrl: String(data.imageUrl),
            originalUrl: typeof data.originalUrl === 'string' ? data.originalUrl : undefined,
        };
    } catch (error: any) {
        // Axios wraps the response in error.response
        if (error.response) {
            return {
                success: false,
                error: error.response.data?.error || `Upload failed (${error.response.status})`
            };
        }
        return { success: false, error: error?.message || 'Unknown error' };
    }
}
