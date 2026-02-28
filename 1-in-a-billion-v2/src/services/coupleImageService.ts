import { env } from '@/config/env';
import { useAuthStore } from '@/store/authStore';
import { getAuthHeaders } from '@/services/api';

export interface CoupleImageResult {
    success: boolean;
    coupleImageUrl?: string;
    error?: string;
}

export async function getCoupleImage(
    person1Id: string,
    person2Id: string,
    portrait1Url: string,
    portrait2Url: string,
    forceRegenerate = false
): Promise<CoupleImageResult> {
    try {
        const userId = useAuthStore.getState().user?.id;
        if (!userId) {
            return { success: false, error: 'User not authenticated' };
        }

        const backendUrl = env.CORE_API_URL;
        if (!backendUrl) {
            return { success: false, error: 'Backend API not configured' };
        }

        const response = await fetch(`${backendUrl}/api/couples/image`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                ...getAuthHeaders(),
            },
            body: JSON.stringify({
                person1Id,
                person2Id,
                portrait1Url,
                portrait2Url,
                forceRegenerate,
            }),
        });

        if (!response.ok) {
            const text = await response.text().catch(() => '');
            return {
                success: false,
                error: text || `Failed to generate couple image (${response.status})`,
            };
        }

        const result = await response.json();
        if (!result?.success) {
            return { success: false, error: result?.error || 'Couple image generation failed' };
        }

        return {
            success: true,
            coupleImageUrl: typeof result.coupleImageUrl === 'string' ? result.coupleImageUrl : undefined,
        };
    } catch (error: any) {
        return {
            success: false,
            error: error?.message || 'Unknown couple image error',
        };
    }
}
