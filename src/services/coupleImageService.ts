/**
 * COUPLE IMAGE SERVICE
 * 
 * Creates AI-generated romantic couple portraits by composing two 
 * already-generated individual styled portraits together.
 * 
 * ⚠️ CRITICAL - DO NOT CHANGE THIS APPROACH:
 * 
 * This service MUST take already-styled portraits (from aiPortraitService.ts)
 * as inputs, NOT original photos. This is the ONLY way to ensure facial 
 * features are preserved in couple portraits regardless of artistic style.
 * 
 * Workflow:
 * 1. Generate individual portrait for Person 1 (original photo → styled portrait)
 * 2. Generate individual portrait for Person 2 (original photo → styled portrait)  
 * 3. Compose couple portrait (styled portrait 1 + styled portrait 2 → couple image)
 * 
 * This approach works for ANY artistic style (linoleum, clay, watercolor, etc.)
 * and ensures both faces remain recognizable in the couple composition.
 */

import { GoogleGenAI } from '@google/genai';
import { createSupabaseServiceClient } from './supabaseClient';
import { getApiKey } from './apiKeys';
import { env } from '../config/env';
import sharp from 'sharp';

const COUPLE_IMAGES_BUCKET = 'couple-portraits';

export interface CoupleImageResult {
  success: boolean;
  coupleImageUrl?: string;
  storagePath?: string;
  error?: string;
}

/**
 * Generate a romantic couple portrait using AI
 * 
 * Takes two already-generated styled portraits (e.g., linoleum/AI portrait style) 
 * and composes them into an intimate "lovers" composition.
 * 
 * The AI preserves the facial features from both input portraits while creating
 * a unified romantic composition. This approach ensures face consistency regardless
 * of the artistic style used.
 */
export async function composeCoupleImage(
  userId: string,
  person1Id: string,
  person2Id: string,
  portrait1Url: string,
  portrait2Url: string
): Promise<CoupleImageResult> {
  const supabase = createSupabaseServiceClient();
  if (!supabase) {
    return { success: false, error: 'Supabase not configured' };
  }

  try {
    // ⚠️ CRITICAL VALIDATION: Ensure we're receiving styled portraits, not original photos
    // Styled portraits should be in profile-images bucket with /AI-generated-portrait.png suffix
    // or in couple-portraits bucket
    const isStyledPortrait1 = portrait1Url.includes('/AI-generated-portrait.png') || portrait1Url.includes('couple-portraits') || portrait1Url.includes('/claymation.png') || portrait1Url.includes('couple-claymations');
    const isStyledPortrait2 = portrait2Url.includes('/AI-generated-portrait.png') || portrait2Url.includes('couple-portraits') || portrait2Url.includes('/claymation.png') || portrait2Url.includes('couple-claymations');
    
    if (!isStyledPortrait1 || !isStyledPortrait2) {
      console.warn('⚠️ [Couple] WARNING: URLs do not appear to be styled portraits!');
      console.warn('   Person 1 URL:', portrait1Url);
      console.warn('   Person 2 URL:', portrait2Url);
      console.warn('   Expected URLs to contain "/AI-generated-portrait.png"');
      console.warn('   Couple portraits MUST be composed from styled portraits, not original photos!');
      // Don't fail completely, but log the warning
    }
    
    const googleKey = await getApiKey('google_ai_studio', env.GOOGLE_AI_STUDIO_API_KEY || '');
    if (!googleKey) {
      return { success: false, error: 'Google AI Studio API key not found' };
    }

    console.log(`👫 [Couple] Generating AI couple portrait for ${person1Id} + ${person2Id}...`);

    // 1. Download both portrait images
    const [image1Response, image2Response] = await Promise.all([
      fetch(portrait1Url),
      fetch(portrait2Url),
    ]);

    if (!image1Response.ok || !image2Response.ok) {
      return { success: false, error: 'Failed to download portrait images' };
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
      // Romantic couple composition prompt
      {
        text: `Compose these two stylized portraits into a romantic couple portrait. Keep the exact same artistic style from the input portraits. Show them pressed close together in love, intimate composition. Preserve the facial features from both portraits exactly as shown - do not change or reinterpret the faces. Extreme close-up zoomed in, subjects fill entire frame edge to edge, no empty margins or white space around subjects.`
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
      return await composeCoupleImageFallback(userId, person1Id, person2Id, portrait1Url, portrait2Url);
    }

    console.log('✅ [Couple] AI couple portrait generated successfully');

    // 3. Post-process the image: auto-crop white space, then enhance
    const rawImageBuffer = Buffer.from(generatedImageB64, 'base64');
    
    // First trim white/off-white background
    const trimmedBuffer = await sharp(rawImageBuffer)
      .trim({ threshold: 30 })  // Trim pixels similar to white/off-white
      .toBuffer();
    
    // Then apply other processing
    const imageBuffer = await sharp(trimmedBuffer)
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

    // 6. Save to couple_portraits table
    const { error: dbError } = await supabase
      .from('couple_portraits')
      .upsert({
        user_id: userId,
        person1_id: person1Id,
        person2_id: person2Id,
        couple_image_url: coupleImageUrl,
        person1_solo_url: portrait1Url,
        person2_solo_url: portrait2Url,
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
    return await composeCoupleImageFallback(userId, person1Id, person2Id, portrait1Url, portrait2Url);
  }
}

/**
 * Fallback: Simple side-by-side composition if AI generation fails
 */
async function composeCoupleImageFallback(
  userId: string,
  person1Id: string,
  person2Id: string,
  portrait1Url: string,
  portrait2Url: string
): Promise<CoupleImageResult> {
  const supabase = createSupabaseServiceClient();
  if (!supabase) {
    return { success: false, error: 'Supabase not configured' };
  }

  try {
    console.log(`👫 [Couple] Fallback: Creating side-by-side composition...`);

    const [image1Response, image2Response] = await Promise.all([
      fetch(portrait1Url),
      fetch(portrait2Url),
    ]);

    if (!image1Response.ok || !image2Response.ok) {
      return { success: false, error: 'Failed to download portrait images' };
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
      .from('couple_portraits')
      .upsert({
        user_id: userId,
        person1_id: person1Id,
        person2_id: person2Id,
        couple_image_url: coupleImageUrl,
        person1_solo_url: portrait1Url,
        person2_solo_url: portrait2Url,
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
  portrait1Url: string,
  portrait2Url: string,
  forceRegenerate: boolean = false
): Promise<CoupleImageResult> {
  const supabase = createSupabaseServiceClient();
  if (!supabase) {
    return { success: false, error: 'Supabase not configured' };
  }

  try {
    // Normalize person IDs (always store in alphabetical order for consistency)
    const [id1, id2, url1, url2] = person1Id < person2Id
      ? [person1Id, person2Id, portrait1Url, portrait2Url]
      : [person2Id, person1Id, portrait2Url, portrait1Url];

    // Check if couple image already exists
    if (!forceRegenerate) {
      const { data, error } = await supabase
        .from('couple_portraits')
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
