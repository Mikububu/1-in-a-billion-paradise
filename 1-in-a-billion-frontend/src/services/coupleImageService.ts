/**
 * COUPLE IMAGE SERVICE (Frontend)
 * 
 * Handles couple portrait image generation and caching.
 */

import { env } from '@/config/env';
import { useAuthStore } from '@/store/authStore';

export interface CoupleImageResult {
  success: boolean;
  coupleImageUrl?: string;
  error?: string;
}

/**
 * Get or generate couple claymation image
 */
export async function getCoupleImage(
  person1Id: string,
  person2Id: string,
  claymation1Url: string,
  claymation2Url: string,
  forceRegenerate: boolean = false
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

    console.log('👫 Requesting couple image generation...');
    
    const response = await fetch(`${backendUrl}/api/couples/image`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-User-Id': userId,
      },
      body: JSON.stringify({
        person1Id,
        person2Id,
        claymation1Url,
        claymation2Url,
        forceRegenerate,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Couple image generation failed:', errorText);
      return {
        success: false,
        error: `Failed to generate couple image: ${response.status}`,
      };
    }

    const result = await response.json();
    
    if (!result.success) {
      return {
        success: false,
        error: result.error || 'Couple image generation failed',
      };
    }

    console.log('✅ Couple image ready:', result.coupleImageUrl);
    return result;
  } catch (error: any) {
    console.error('Couple image error:', error);
    return {
      success: false,
      error: error?.message || 'Unknown error',
    };
  }
}
