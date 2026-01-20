/**
 * PERSON PHOTO SERVICE
 * 
 * Handles uploading photos for people in Karmic Zoo and generating claymation images.
 */

import { supabase } from './supabase';
import { env } from '@/config/env';
import { useAuthStore } from '@/store/authStore';
import * as FileSystem from 'expo-file-system';

const PHOTOS_BUCKET = 'person-photos';
const CLAYMATIONS_BUCKET = 'claymations';

export interface UploadPhotoResult {
  success: boolean;
  originalUrl?: string;
  claymationUrl?: string;
  error?: string;
}

/**
 * Upload a person's photo and generate claymation version
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

    // 2. Upload original photo to Supabase Storage
    const originalFileName = `${personId}-original-${Date.now()}.jpg`;
    const { data: uploadData, error: uploadError } = await supabase.storage
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

    // 3. Call backend to generate claymation
    const backendUrl = env.CORE_API_URL;
    if (!backendUrl) {
      return { 
        success: false, 
        error: 'Backend API not configured',
        originalUrl 
      };
    }

    // Get userId for backend auth
    const userId = useAuthStore.getState().user?.id;
    if (!userId) {
      return {
        success: false,
        error: 'User not authenticated',
        originalUrl,
      };
    }

    console.log('🎨 Requesting claymation generation from backend...');
    const claymationResponse = await fetch(`${backendUrl}/api/profile/claymation`, {
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

    if (!claymationResponse.ok) {
      const errorText = await claymationResponse.text();
      console.error('Claymation generation failed:', errorText);
      return {
        success: false,
        error: `Claymation generation failed: ${claymationResponse.status}`,
        originalUrl,
      };
    }

    const claymationResult = await claymationResponse.json();
    
    if (!claymationResult.success || !claymationResult.imageUrl) {
      return {
        success: false,
        error: claymationResult.error || 'Claymation generation failed',
        originalUrl,
      };
    }

    console.log('✅ Claymation generated:', claymationResult.imageUrl);

    return {
      success: true,
      originalUrl,
      claymationUrl: claymationResult.imageUrl,
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
