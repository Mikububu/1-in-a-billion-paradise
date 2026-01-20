/**
 * COUPLE IMAGE SERVICE
 * 
 * Creates AI-generated romantic couple portraits from two individual
 * claymation portraits using Google AI Studio.
 */

import { GoogleGenAI } from '@google/genai';
import { createSupabaseServiceClient } from './supabaseClient';
import { getApiKey } from './apiKeys';
import { env } from '../config/env';
import sharp from 'sharp';

const COUPLE_IMAGES_BUCKET = 'couple-claymations';

export interface CoupleImageResult {
  success: boolean;
  coupleImageUrl?: string;
  storagePath?: string;
  error?: string;
}

/**
 * Generate a romantic couple portrait using AI
 * Takes two individual claymation portraits and creates an intimate "lovers" composition
 */
export async function composeCoupleImage(
  userId: string,
  person1Id: string,
  person2Id: string,
  claymation1Url: string,
  claymation2Url: string
): Promise<CoupleImageResult> {
  const supabase = createSupabaseServiceClient();
  if (!supabase) {
    return { success: false, error: 'Supabase not configured' };
  }

  try {
    const googleKey = await getApiKey('google_ai_studio', env.GOOGLE_AI_STUDIO_API_KEY || '');
    if (!googleKey) {
      return { success: false, error: 'Google AI Studio API key not found' };
    }

    console.log(`👫 [Couple] Generating AI couple portrait for ${person1Id} + ${person2Id}...`);

    // 1. Download both claymation images
    const [image1Response, image2Response] = await Promise.all([
      fetch(claymation1Url),
      fetch(claymation2Url),
    ]);

    if (!image1Response.ok || !image2Response.ok) {
      return { success: false, error: 'Failed to download claymation images' };
    }

    const [image1Buffer, image2Buffer] = await Promise.all([
      image1Response.arrayBuffer(),
      image2Response.arrayBuffer(),
    ]);

    // Convert to base64
    const image1Base64 = Buffer.from(image1Buffer).toString('base64');
    const image2Base64 = Buffer.from(image2Buffer).toString('base64');

    // 2. Generate couple portrait with Google AI Studio
    const ai = new GoogleGenAI({ apiKey: googleKey });

    const parts: any[] = [
      // First person's portrait
      {
        inlineData: {
          data: image1Base64,
          mimeType: 'image/png'
        }
      },
      // Second person's portrait
      {
        inlineData: {
          data: image2Base64,
          mimeType: 'image/png'
        }
      },
      // Romantic couple prompt
      {
        text: `Exquisite artisan clay portrait. Extreme close-up. Soft, sophisticated color palette. Hand-sculpted details with visible fingerprints. Expressive glass bead eyes. Close together in love.`
      }
    ];

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash-image',
      contents: { parts },
      config: {
        imageConfig: {
          aspectRatio: "1:1"
        }
      }
    });

    // Extract generated image
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
      console.error('❌ [Couple] No image in AI response, falling back to side-by-side composition');
      return await composeCoupleImageFallback(userId, person1Id, person2Id, claymation1Url, claymation2Url);
    }

    console.log('✅ [Couple] AI couple portrait generated successfully');

    // 3. Post-process the image
    const rawImageBuffer = Buffer.from(generatedImageB64, 'base64');
    const imageBuffer = await sharp(rawImageBuffer)
      .resize(1024, 1024, { fit: 'cover', position: 'attention' })
      .modulate({ saturation: 1.1, brightness: 1.02 })
      .sharpen(0.3)
      .png()
      .toBuffer();

    // 4. Upload to Supabase Storage
    const fileName = `couple-${person1Id}-${person2Id}-${Date.now()}.png`;
    const { error: uploadError } = await supabase.storage
      .from(COUPLE_IMAGES_BUCKET)
      .upload(fileName, imageBuffer, {
        contentType: 'image/png',
        upsert: true,
      });

    if (uploadError) {
      console.error('Failed to upload couple image:', uploadError);
      return { success: false, error: uploadError.message };
    }

    // 5. Get public URL
    const { data: urlData } = supabase.storage
      .from(COUPLE_IMAGES_BUCKET)
      .getPublicUrl(fileName);

    const coupleImageUrl = urlData.publicUrl;
    console.log(`✅ [Couple] Couple image uploaded:`, coupleImageUrl);

    // 6. Save to couple_claymations table
    const { error: dbError } = await supabase
      .from('couple_claymations')
      .upsert({
        user_id: userId,
        person1_id: person1Id,
        person2_id: person2Id,
        couple_image_url: coupleImageUrl,
        person1_solo_url: claymation1Url,
        person2_solo_url: claymation2Url,
        updated_at: new Date().toISOString(),
      }, {
        onConflict: 'user_id,person1_id,person2_id',
      });

    if (dbError) {
      console.warn('⚠️ [Couple] Failed to save to database:', dbError.message);
    }

    return {
      success: true,
      coupleImageUrl,
      storagePath: fileName,
    };
  } catch (error: any) {
    console.error('❌ [Couple] AI generation failed, trying fallback:', error.message);
    return await composeCoupleImageFallback(userId, person1Id, person2Id, claymation1Url, claymation2Url);
  }
}

/**
 * Fallback: Simple side-by-side composition if AI generation fails
 */
async function composeCoupleImageFallback(
  userId: string,
  person1Id: string,
  person2Id: string,
  claymation1Url: string,
  claymation2Url: string
): Promise<CoupleImageResult> {
  const supabase = createSupabaseServiceClient();
  if (!supabase) {
    return { success: false, error: 'Supabase not configured' };
  }

  try {
    console.log(`👫 [Couple] Fallback: Creating side-by-side composition...`);

    const [image1Response, image2Response] = await Promise.all([
      fetch(claymation1Url),
      fetch(claymation2Url),
    ]);

    if (!image1Response.ok || !image2Response.ok) {
      return { success: false, error: 'Failed to download claymation images' };
    }

    const [image1Buffer, image2Buffer] = await Promise.all([
      image1Response.arrayBuffer(),
      image2Response.arrayBuffer(),
    ]);

    const height = 800;
    const width = Math.round(height * 0.75);

    const [resized1, resized2] = await Promise.all([
      sharp(Buffer.from(image1Buffer)).resize(width, height, { fit: 'cover' }).toBuffer(),
      sharp(Buffer.from(image2Buffer)).resize(width, height, { fit: 'cover' }).toBuffer(),
    ]);

    const gap = 10;
    const composedImage = await sharp({
      create: {
        width: width * 2 + gap,
        height: height,
        channels: 3,
        background: { r: 255, g: 255, b: 255 },
      },
    })
      .composite([
        { input: resized1, top: 0, left: 0 },
        { input: resized2, top: 0, left: width + gap },
      ])
      .jpeg({ quality: 90 })
      .toBuffer();

    const fileName = `couple-fallback-${person1Id}-${person2Id}-${Date.now()}.jpg`;
    const { error: uploadError } = await supabase.storage
      .from(COUPLE_IMAGES_BUCKET)
      .upload(fileName, composedImage, {
        contentType: 'image/jpeg',
        upsert: true,
      });

    if (uploadError) {
      return { success: false, error: uploadError.message };
    }

    const { data: urlData } = supabase.storage
      .from(COUPLE_IMAGES_BUCKET)
      .getPublicUrl(fileName);

    const coupleImageUrl = urlData.publicUrl;
    console.log(`✅ [Couple] Fallback image created:`, coupleImageUrl);

    const { error: dbError } = await supabase
      .from('couple_claymations')
      .upsert({
        user_id: userId,
        person1_id: person1Id,
        person2_id: person2Id,
        couple_image_url: coupleImageUrl,
        person1_solo_url: claymation1Url,
        person2_solo_url: claymation2Url,
        updated_at: new Date().toISOString(),
      }, {
        onConflict: 'user_id,person1_id,person2_id',
      });

    if (dbError) {
      console.warn('⚠️ [Couple] Failed to save fallback to database:', dbError.message);
    }

    return {
      success: true,
      coupleImageUrl,
      storagePath: fileName,
    };
  } catch (error: any) {
    console.error('❌ [Couple] Fallback composition also failed:', error);
    return {
      success: false,
      error: error?.message || 'Unknown error',
    };
  }
}

/**
 * Get existing couple image URL, or generate if it doesn't exist
 */
export async function getCoupleImage(
  userId: string,
  person1Id: string,
  person2Id: string,
  claymation1Url: string,
  claymation2Url: string,
  forceRegenerate: boolean = false
): Promise<CoupleImageResult> {
  const supabase = createSupabaseServiceClient();
  if (!supabase) {
    return { success: false, error: 'Supabase not configured' };
  }

  try {
    // Normalize person IDs (always store in alphabetical order for consistency)
    const [id1, id2, url1, url2] = person1Id < person2Id
      ? [person1Id, person2Id, claymation1Url, claymation2Url]
      : [person2Id, person1Id, claymation2Url, claymation1Url];

    // Check if couple image already exists
    if (!forceRegenerate) {
      const { data, error } = await supabase
        .from('couple_claymations')
        .select('couple_image_url, person1_solo_url, person2_solo_url')
        .eq('user_id', userId)
        .eq('person1_id', id1)
        .eq('person2_id', id2)
        .single();

      if (!error && data) {
        // Check if solo URLs match (if changed, regenerate)
        const solosMatch = data.person1_solo_url === url1 && data.person2_solo_url === url2;
        
        if (solosMatch) {
          console.log('✅ [Couple] Using cached couple image');
          return { success: true, coupleImageUrl: data.couple_image_url };
        } else {
          console.log('🔄 [Couple] Solo images changed, regenerating...');
        }
      }
    }

    // Generate new couple image
    return await composeCoupleImage(userId, id1, id2, url1, url2);
  } catch (error: any) {
    console.error('❌ [Couple] Error getting couple image:', error);
    return {
      success: false,
      error: error?.message || 'Unknown error',
    };
  }
}
