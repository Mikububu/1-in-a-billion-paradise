/**
 * CLAYMATION PORTRAIT SERVICE
 * 
 * Transforms user photos into handcrafted claymation-style portraits
 * using Google AI Studio (image-to-image transformation).
 * 
 * Purpose: Privacy-preserving profile images for the matching system.
 * When users match, they see each other's claymation portraits, not real photos.
 */

import { GoogleGenAI } from '@google/genai';
import * as fs from 'fs';
import * as path from 'path';
import sharp from 'sharp';
import { getApiKey } from './apiKeys';
import { env } from '../config/env';
import { createSupabaseServiceClient } from './supabaseClient';

// ═══════════════════════════════════════════════════════════════════════════
// EXAMPLE IMAGES (loaded at startup for style reference)
// ═══════════════════════════════════════════════════════════════════════════

let exampleImagesBase64: string[] = [];

function loadExampleImages() {
  if (exampleImagesBase64.length > 0) return; // Already loaded
  
  const examplesDir = path.join(__dirname, '../../assets/example-claymation');
  try {
    if (fs.existsSync(examplesDir)) {
      const files = fs.readdirSync(examplesDir).filter(f => /\.(jpg|jpeg|png)$/i.test(f));
      exampleImagesBase64 = files.slice(0, 3).map(file => {
        const buffer = fs.readFileSync(path.join(examplesDir, file));
        return buffer.toString('base64');
      });
      console.log(`📸 [Claymation] Loaded ${exampleImagesBase64.length} example images for style reference`);
    }
  } catch (err) {
    console.warn('⚠️ [Claymation] Could not load example images:', err);
  }
}

// Load on module init
loadExampleImages();

// ═══════════════════════════════════════════════════════════════════════════
// CLAYMATION PROMPT (from CLAYMATION_PORTRAIT.md)
// ═══════════════════════════════════════════════════════════════════════════

const CLAYMATION_STYLE_PROMPT = `Create a handcrafted claymation sculpture portrait. 

Style: Matte clay with tactile texture, finger marks, and handmade imperfections. Soft natural lighting. Analog and artisanal aesthetic.

Background: Pure white.

Avoid: Digital smoothness, gloss, text, borders, or graphic elements.`;

// ═══════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════

export interface ClaymationResult {
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
 * Generate a claymation portrait from a user's photo
 * 
 * Single-step image-to-image transformation using Google AI Studio.
 * Sends photo + style prompt directly to generate claymation portrait.
 */
export async function generateClaymationPortrait(
  photoBase64: string,
  userId: string,
  personId?: string
): Promise<ClaymationResult> {
  const supabase = createSupabaseServiceClient();
  if (!supabase) {
    return { success: false, error: 'Supabase not configured' };
  }

  try {
    const googleKey = await getApiKey('google_ai_studio', env.GOOGLE_AI_STUDIO_API_KEY || '');
    
    if (!googleKey) {
      return { success: false, error: 'Google AI Studio API key not found' };
    }

    console.log('🎨 [Claymation] Starting portrait generation with Google AI Studio...');
    
    // Ensure example images are loaded
    loadExampleImages();

    // ─────────────────────────────────────────────────────────────────────
    // STEP 0: Store original image first
    // ─────────────────────────────────────────────────────────────────────
    console.log('📸 [Claymation] Step 0: Storing original image...');
    
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
      console.log('✅ [Claymation] Original stored at:', originalUrl);
    } else {
      console.warn('⚠️ [Claymation] Could not store original:', originalUploadError.message);
    }

    // ─────────────────────────────────────────────────────────────────────
    // Generate claymation directly with Google AI Studio (image-to-image)
    // ─────────────────────────────────────────────────────────────────────
    console.log('🎨 [Claymation] Generating claymation with Google AI Studio...');

    const ai = new GoogleGenAI({ apiKey: googleKey });

    // Build parts array: image first, then text (matching working code)
    const parts: any[] = [];
    
    // Add image (remove data:image/jpeg;base64, prefix if present)
    const base64Data = photoBase64.includes(',') ? photoBase64.split(',')[1] : photoBase64;
    parts.push({
      inlineData: {
        data: base64Data,
        mimeType: 'image/jpeg'
      }
    });

    // Add text prompt (keep it positive; aim for tactile clay + richer natural color)
    const stylePrompt = `Transform this portrait into a handcrafted clay sculpture portrait. Emphasize tactile clay texture with visible finger impressions, matte finish, and artisanal realism. Keep real facial proportions and a natural, slightly warm color palette (not desaturated). Soft studio lighting, pure white background, clean centered composition.`;
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
      console.error('❌ [Claymation] No image found in response:', {
        hasCandidates: !!response.candidates,
        candidateCount: response.candidates?.length,
        hasContent: !!response.candidates?.[0]?.content,
        partsCount: response.candidates?.[0]?.content?.parts?.length,
        finishReason: response.candidates?.[0]?.finishReason
      });
      return { success: false, error: 'Failed to generate claymation image with Google AI Studio' };
    }

    console.log('✅ [Claymation] Image generated successfully with Google AI Studio');

    // ─────────────────────────────────────────────────────────────────────
    // STEP 3: Post-process for consistent framing + subtle color lift
    // - Normalize framing so people don't appear "smaller" depending on source photo
    // - Slight saturation/contrast bump to avoid a washed-out look
    // ─────────────────────────────────────────────────────────────────────
    const rawImageBuffer = Buffer.from(generatedImageB64, 'base64');
    const imageBuffer = await sharp(rawImageBuffer)
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
    const storagePath = `${userId}/${personId || 'self'}/claymation.png`;

    console.log('📤 [Claymation] Uploading to storage:', storagePath);

    const { error: uploadError } = await supabase.storage
      .from('profile-images')
      .upload(storagePath, imageBuffer, {
        contentType: 'image/png',
        upsert: true,
      });

    if (uploadError) {
      console.error('❌ [Claymation] Upload error:', uploadError);
      return { success: false, error: `Upload failed: ${uploadError.message}` };
    }

    // Get public URL
    const { data: publicUrlData } = supabase.storage
      .from('profile-images')
      .getPublicUrl(storagePath);

    const imageUrl = publicUrlData.publicUrl;
    console.log('✅ [Claymation] Uploaded to:', imageUrl);

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
        claymation_url: imageUrl,
        original_photo_url: originalUrl,
        updated_at: new Date().toISOString(),
      })
      .eq('user_id', userId);

    const { error: updateError } = personId
      ? await updateQuery.eq('client_person_id', personId)
      : await updateQuery.eq('is_user', true);

    if (updateError) {
      console.warn('⚠️ [Claymation] Could not update library_people:', updateError);
    } else {
      console.log('✅ [Claymation] Updated library_people with both URLs');
    }

    return {
      success: true,
      imageUrl,
      originalUrl,
      storagePath,
      cost: 0.05, // Google AI Studio image generation (estimated)
    };

  } catch (error: any) {
    console.error('❌ [Claymation] Error:', error.message);
    if (error.response?.data) {
      console.error('   Response data:', JSON.stringify(error.response.data, null, 2));
    }
    return { success: false, error: error.message };
  }
}

/**
 * Check if a user/person already has a claymation portrait
 */
export async function getClaymationPortrait(
  userId: string,
  personId?: string
): Promise<string | null> {
  const supabase = createSupabaseServiceClient();
  if (!supabase) return null;

  // Check library_people first
  if (personId) {
    const { data } = await supabase
      .from('library_people')
      .select('claymation_url')
      .eq('user_id', userId)
      .eq('client_person_id', personId)
      .maybeSingle();

    if (data?.claymation_url) {
      return data.claymation_url;
    }
  } else {
    const { data } = await supabase
      .from('library_people')
      .select('claymation_url')
      .eq('user_id', userId)
      .eq('is_user', true)
      .maybeSingle();

    if (data?.claymation_url) return data.claymation_url;
  }

  // Check storage directly
  const storagePath = `${userId}/${personId || 'self'}/claymation.png`;
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
