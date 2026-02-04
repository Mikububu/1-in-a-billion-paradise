/**
 * PERSON PHOTO SERVICE
 * 
 * Handles uploading photos for people in Karmic Zoo and generating AI portrait images.
 */

import { supabase } from './supabase';
import { env } from '@/config/env';
import { useAuthStore } from '@/store/authStore';
import * as FileSystem from 'expo-file-system/legacy';

// Use same bucket as backend (profile-images)
const PHOTOS_BUCKET = 'profile-images';

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

    // 2. Upload original photo to Supabase Storage (profile-images bucket)
    const userId = useAuthStore.getState().user?.id;
    if (!userId) {
      return { success: false, error: 'User not authenticated' };
    }
    
    const originalFileName = `${userId}/${personId}/original-${Date.now()}.jpg`;
    const { error: uploadError } = await supabase.storage
      .from(PHOTOS_BUCKET)
      .upload(originalFileName, decode(base64), {
        contentType: 'image/jpeg',
        upsert: true,
      });

    if (uploadError) {
      console.error('Failed to upload original photo:', uploadError);
      return { success: false, error: uploadError.message };
    }

    // Get public URL for original photo
    const { data: originalUrlData } = supabase.storage
      .from(PHOTOS_BUCKET)
      .getPublicUrl(originalFileName);
    
    const originalUrl = originalUrlData.publicUrl;
    console.log('✅ Original photo uploaded:', originalUrl);

    // 3. Call backend to generate AI portrait
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

/**
 * Helper to decode base64 to Uint8Array for Supabase upload
 */
function decode(base64: string): Uint8Array {
  const binaryString = atob(base64);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}
