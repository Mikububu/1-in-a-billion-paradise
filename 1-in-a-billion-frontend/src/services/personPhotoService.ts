/**
 * PERSON PHOTO SERVICE
 * 
 * Handles uploading photos for people in Karmic Zoo and generating AI portrait images.
 */

import { env } from '@/config/env';
import { useAuthStore } from '@/store/authStore';
import * as FileSystem from 'expo-file-system/legacy';

export interface UploadPhotoResult {
  success: boolean;
  originalUrl?: string;
  portraitUrl?: string;
  error?: string;
}

/**
 * Upload a person's photo and generate AI portrait version
 * Sends photo directly to backend which handles storage and AI generation
 */
export async function uploadPersonPhoto(
  personId: string,
  photoUri: string
): Promise<UploadPhotoResult> {
  try {
    console.log('📸 Starting photo upload for person:', personId);

    // 1. Read image file as base64
    const base64 = await FileSystem.readAsStringAsync(photoUri, {
      encoding: FileSystem.EncodingType.Base64,
    });

    if (!base64) {
      return { success: false, error: 'Could not read image file' };
    }

    console.log('✅ Photo read as base64, length:', base64.length);

    // 2. Get userId for backend auth
    const userId = useAuthStore.getState().user?.id;
    if (!userId) {
      return { success: false, error: 'User not authenticated' };
    }

    // 3. Call backend to generate AI portrait (backend handles storage with service role key)
    const backendUrl = env.CORE_API_URL;
    if (!backendUrl) {
      return { 
        success: false, 
        error: 'Backend API not configured'
      };
    }

    // userId already retrieved above

    console.log('🎨 Requesting AI portrait generation from backend...');
    const portraitResponse = await fetch(`${backendUrl}/api/profile/portrait`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-User-Id': userId,
      },
      body: JSON.stringify({
        photoBase64: base64,
        personId,
      }),
    });

    if (!portraitResponse.ok) {
      const errorText = await portraitResponse.text();
      console.error('AI portrait generation failed:', errorText);
      return {
        success: false,
        error: `AI portrait generation failed: ${portraitResponse.status}`
      };
    }

    const portraitResult = await portraitResponse.json();
    
    if (!portraitResult.success || !portraitResult.imageUrl) {
      return {
        success: false,
        error: portraitResult.error || 'AI portrait generation failed'
      };
    }

    console.log('✅ AI portrait generated:', portraitResult.imageUrl);

    return {
      success: true,
      portraitUrl: portraitResult.imageUrl,
    };
  } catch (error: any) {
    console.error('Photo upload error:', error);
    return {
      success: false,
      error: error?.message || 'Unknown error',
    };
  }
}

