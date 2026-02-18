/**
 * AI PORTRAIT SERVICE
 * 
 * Transforms user photos into AI-styled portraits
 * using Google AI Studio (image-to-image transformation).
 * 
 * Purpose: Privacy-preserving profile images for the matching system.
 * When users match, they see each other's AI-generated portraits, not real photos.
 */

import { GoogleGenAI } from '@google/genai';
import * as fs from 'fs';
import * as path from 'path';
import sharp from 'sharp';
import { getApiKey } from './apiKeys';
import { env } from '../config/env';
import { createSupabaseServiceClient } from './supabaseClient';
import { loadImagePromptLayer } from '../promptEngine/imagePromptLayers';

// ═══════════════════════════════════════════════════════════════════════════
// EXAMPLE IMAGES (loaded at startup for style reference)
// ═══════════════════════════════════════════════════════════════════════════

let exampleImagesBase64: string[] = [];

function loadExampleImages() {
  if (exampleImagesBase64.length > 0) return; // Already loaded
  
  const examplesDir = path.join(__dirname, '../../assets/example-portraits');
  try {
    if (fs.existsSync(examplesDir)) {
      const files = fs.readdirSync(examplesDir).filter(f => /\.(jpg|jpeg|png)$/i.test(f));
      exampleImagesBase64 = files.slice(0, 3).map(file => {
        const buffer = fs.readFileSync(path.join(examplesDir, file));
        return buffer.toString('base64');
      });
      console.log(`📸 [AI Portrait] Loaded ${exampleImagesBase64.length} example images for style reference`);
    }
  } catch (err) {
    console.warn('⚠️ [AI Portrait] Could not load example images:', err);
  }
}

// Load on module init
loadExampleImages();

// ═══════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════

export interface AIPortraitResult {
  success: boolean;
  imageUrl?: string;
  originalUrl?: string;
  storagePath?: string;
  error?: string;
  cost?: number;
}

// ═══════════════════════════════════════════════════════════════════════════
// MAIN SERVICE
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Generate an AI-styled portrait from a user's photo
 * 
 * Single-step image-to-image transformation using Google AI Studio.
 * Sends photo + style prompt directly to generate AI portrait.
 */
export async function generateAIPortrait(
  photoBase64: string,
  userId: string,
  personId?: string
): Promise<AIPortraitResult> {
  const supabase = createSupabaseServiceClient();
  if (!supabase) {
    return { success: false, error: 'Supabase not configured' };
  }

  try {
    const googleKey = await getApiKey('google_ai_studio', env.GOOGLE_AI_STUDIO_API_KEY || '');
    
    if (!googleKey) {
      return { success: false, error: 'Google AI Studio API key not found' };
    }

    console.log('🎨 [AI Portrait] Starting portrait generation with Google AI Studio...');
    console.log('🔑 [AI Portrait] Key length:', googleKey.length, 'prefix:', googleKey.substring(0, 15) + '...');
    
    // Ensure example images are loaded
    loadExampleImages();

    // ─────────────────────────────────────────────────────────────────────
    // STEP 0: Store original image first
    // ─────────────────────────────────────────────────────────────────────
    console.log('📸 [AI Portrait] Step 0: Storing original image...');
    
    const originalBuffer = Buffer.from(photoBase64, 'base64');
    const originalPath = `${userId}/${personId || 'self'}/original.jpg`;
    
    const { error: originalUploadError } = await supabase.storage
      .from('profile-images')
      .upload(originalPath, originalBuffer, {
        contentType: 'image/jpeg',
        upsert: true,
      });
    
    let originalUrl: string | undefined;
    if (!originalUploadError) {
      const { data: originalUrlData } = supabase.storage
        .from('profile-images')
        .getPublicUrl(originalPath);
      originalUrl = originalUrlData.publicUrl;
      console.log('✅ [AI Portrait] Original stored at:', originalUrl);
    } else {
      console.warn('⚠️ [AI Portrait] Could not store original:', originalUploadError.message);
    }

    // ─────────────────────────────────────────────────────────────────────
    // STEP 1: Resize input image to max 2000px (Google AI Studio limit)
    // ─────────────────────────────────────────────────────────────────────
    console.log('📐 [AI Portrait] Resizing input image to max 2000px for Google AI Studio...');
    
    const originalImageBuffer = Buffer.from(photoBase64.includes(',') ? photoBase64.split(',')[1] : photoBase64, 'base64');
    
    // Get image metadata to check dimensions
    const metadata = await sharp(originalImageBuffer).metadata();
    const maxDimension = Math.max(metadata.width || 0, metadata.height || 0);
    
    let resizedForAPI: Buffer;
    if (maxDimension > 2000) {
      console.log(`   Original size: ${metadata.width}x${metadata.height}, resizing to max 2000px...`);
      // Resize to max 2000px on longest side, maintaining aspect ratio
      resizedForAPI = await sharp(originalImageBuffer)
        .resize(2000, 2000, { fit: 'inside', withoutEnlargement: true })
        .jpeg({ quality: 90 })
        .toBuffer();
      
      const resizedMetadata = await sharp(resizedForAPI).metadata();
      console.log(`   Resized to: ${resizedMetadata.width}x${resizedMetadata.height}`);
    } else {
      console.log(`   Image size OK: ${metadata.width}x${metadata.height} (under 2000px limit)`);
      resizedForAPI = originalImageBuffer;
    }

    // ─────────────────────────────────────────────────────────────────────
    // STEP 2: Generate AI portrait directly with Google AI Studio (image-to-image)
    // ─────────────────────────────────────────────────────────────────────
    console.log('🎨 [AI Portrait] Generating AI portrait with Google AI Studio...');

    const ai = new GoogleGenAI({ apiKey: googleKey });

    // Build parts array: image first, then text (matching working code)
    const parts: any[] = [];
    
    // Add resized image (convert to base64)
    const resizedBase64 = resizedForAPI.toString('base64');
    parts.push({
      inlineData: {
        data: resizedBase64,
        mimeType: 'image/jpeg'
      }
    });

    // Add text prompt (loaded from editable prompt layer markdown)
    let stylePrompt = '';
    try {
      stylePrompt = loadImagePromptLayer('single_portrait');
      console.log(`🧾 [AI Portrait] Using image prompt layer "single_portrait": ${stylePrompt.replace(/\s+/g, ' ').slice(0, 140)}...`);
    } catch (err) {
      console.warn('⚠️ [AI Portrait] Failed to load image prompt layer, using fallback:', (err as Error)?.message || err);
      stylePrompt = `High-contrast Linoleum analog handcrafted style. Bold black strokes on textured off-white paper. Smooth, hand-carved edges and negative space. Minimalist palette (mostly black/white with a single accent color like red). 2D graphic illustration. Isolated on white. Extreme close-up zoomed in, subject fills entire frame edge to edge, no empty margins or white space around subject.`;
    }
    parts.push({ text: stylePrompt });

    // Generate using the SDK (matching working code structure)
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash-image',
      contents: { parts },
      config: {
        imageConfig: {
          aspectRatio: "1:1"
        }
      }
    });

    // Extract image from response (loop through parts to find inlineData)
    let generatedImageB64: string | undefined;
    if (response.candidates?.[0]?.content?.parts) {
      for (const part of response.candidates[0].content.parts) {
        if (part.inlineData?.data) {
          generatedImageB64 = part.inlineData.data;
          break;
        }
      }
    }

    if (!generatedImageB64) {
      console.error('❌ [AI Portrait] No image found in response:', {
        hasCandidates: !!response.candidates,
        candidateCount: response.candidates?.length,
        hasContent: !!response.candidates?.[0]?.content,
        partsCount: response.candidates?.[0]?.content?.parts?.length,
        finishReason: response.candidates?.[0]?.finishReason
      });
      return { success: false, error: 'Failed to generate AI portrait with Google AI Studio' };
    }

    console.log('✅ [AI Portrait] Image generated successfully with Google AI Studio');

    // ─────────────────────────────────────────────────────────────────────
    // STEP 3: Post-process for consistent framing + subtle color lift
    // - Auto-crop white space around subject
    // - Normalize framing so people don't appear "smaller" depending on source photo
    // - Slight saturation/contrast bump to avoid a washed-out look
    // ─────────────────────────────────────────────────────────────────────
    const rawImageBuffer = Buffer.from(generatedImageB64, 'base64');
    
    // First trim white/off-white background
    const trimmedBuffer = await sharp(rawImageBuffer)
      .trim({ threshold: 30 })  // Trim pixels similar to white/off-white
      .toBuffer();
    
    // Then apply other processing
    const imageBuffer = await sharp(trimmedBuffer)
      // Normalize to 1024x1024, crop using attention to keep the subject prominent
      .resize(1024, 1024, { fit: 'cover', position: 'attention' })
      // Slight lift: a touch more saturation and contrast
      .modulate({ saturation: 1.12, brightness: 1.02 })
      .linear(1.06, -4)
      .sharpen(0.4)
      .png()
      .toBuffer();

    // ─────────────────────────────────────────────────────────────────────
    // STEP 4: Upload portrait to Supabase Storage
    // ─────────────────────────────────────────────────────────────────────
    const storagePath = `${userId}/${personId || 'self'}/AI-generated-portrait.png`;

    console.log('📤 [AI Portrait] Uploading to storage:', storagePath);

    const { error: uploadError } = await supabase.storage
      .from('profile-images')
      .upload(storagePath, imageBuffer, {
        contentType: 'image/png',
        upsert: true,
      });

    if (uploadError) {
      console.error('❌ [AI Portrait] Upload error:', uploadError);
      return { success: false, error: `Upload failed: ${uploadError.message}` };
    }

    // Get public URL
    const { data: publicUrlData } = supabase.storage
      .from('profile-images')
      .getPublicUrl(storagePath);

    const imageUrl = publicUrlData.publicUrl;
    console.log('✅ [AI Portrait] Uploaded to:', imageUrl);

    // ─────────────────────────────────────────────────────────────────────
    // STEP 5: Update library_people record
    //
    // IMPORTANT (schema): `library_people` does NOT have an `id` column. The unique
    // identifier is (`user_id`, `client_person_id`), plus `is_user` for the self row.
    //
    // - If `personId` is provided, treat it as `client_person_id` and update THAT person.
    // - Otherwise, update the user's self record (`is_user = true`).
    // ─────────────────────────────────────────────────────────────────────
    const updateQuery = supabase
      .from('library_people')
      .update({
        portrait_url: imageUrl,
        original_photo_url: originalUrl,
        updated_at: new Date().toISOString(),
      })
      .eq('user_id', userId);

    const { error: updateError } = personId
      ? await updateQuery.eq('client_person_id', personId)
      : await updateQuery.eq('is_user', true);

    if (updateError) {
      console.warn('⚠️ [AI Portrait] Could not update library_people:', updateError);
    } else {
      console.log('✅ [AI Portrait] Updated library_people with both URLs');
    }

    return {
      success: true,
      imageUrl,
      originalUrl,
      storagePath,
      cost: 0.05, // Google AI Studio image generation (estimated)
    };

  } catch (error: any) {
    console.error('❌ [AI Portrait] Error:', error.message);
    if (error.response?.data) {
      console.error('   Response data:', JSON.stringify(error.response.data, null, 2));
    }
    return { success: false, error: error.message };
  }
}

/**
 * Check if a user/person already has a AI portrait
 */
export async function getAIPortrait(
  userId: string,
  personId?: string
): Promise<string | null> {
  const supabase = createSupabaseServiceClient();
  if (!supabase) return null;

  // Check library_people first
  if (personId) {
    const { data } = await supabase
      .from('library_people')
      .select('portrait_url')
      .eq('user_id', userId)
      .eq('client_person_id', personId)
      .maybeSingle();

    if (data?.portrait_url) {
      return data.portrait_url;
    }
  } else {
    const { data } = await supabase
      .from('library_people')
      .select('portrait_url')
      .eq('user_id', userId)
      .eq('is_user', true)
      .maybeSingle();

    if (data?.portrait_url) return data.portrait_url;
  }

  // Check storage directly
  const storagePath = `${userId}/${personId || 'self'}/AI-generated-portrait.png`;
  const { data } = supabase.storage
    .from('profile-images')
    .getPublicUrl(storagePath);

  // Verify the file exists by checking if it's accessible
  try {
    const response = await fetch(data.publicUrl, { method: 'HEAD' });
    if (response.ok) {
      return data.publicUrl;
    }
  } catch {
    // File doesn't exist
  }

  return null;
}
