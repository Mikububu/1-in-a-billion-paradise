/**
 * COUPLE IMAGE COMPOSITION SERVICE
 * 
 * Creates side-by-side couple claymation images for matched pairs
 * and synastry readings.
 */

import { createSupabaseServiceClient } from './supabaseClient';
import sharp from 'sharp';

const COUPLE_IMAGES_BUCKET = 'couple-claymations';

export interface CoupleImageResult {
  success: boolean;
  coupleImageUrl?: string;
  storagePath?: string;
  error?: string;
}

/**
 * Compose two claymation images side-by-side with white background
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
    console.log(`👫 [Couple] Composing couple image for ${person1Id} + ${person2Id}...`);

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

    // 2. Load images with sharp
    const img1 = sharp(Buffer.from(image1Buffer));
    const img2 = sharp(Buffer.from(image2Buffer));

    // Get metadata to ensure consistent sizing
    const [meta1, meta2] = await Promise.all([
      img1.metadata(),
      img2.metadata(),
    ]);

    const height = 800; // Target height for each portrait
    const width = Math.round(height * 0.75); // 3:4 aspect ratio for portraits

    // 3. Resize both images to consistent size
    const [resized1, resized2] = await Promise.all([
      img1.resize(width, height, { fit: 'cover' }).toBuffer(),
      img2.resize(width, height, { fit: 'cover' }).toBuffer(),
    ]);

    // 4. Compose side-by-side with small gap
    const gap = 40; // Gap between images
    const canvasWidth = width * 2 + gap;
    const canvasHeight = height;

    const composedImage = await sharp({
      create: {
        width: canvasWidth,
        height: canvasHeight,
        channels: 3,
        background: { r: 255, g: 255, b: 255 }, // Pure white background
      },
    })
      .composite([
        {
          input: resized1,
          top: 0,
          left: 0,
        },
        {
          input: resized2,
          top: 0,
          left: width + gap,
        },
      ])
      .jpeg({ quality: 90 })
      .toBuffer();

    // 5. Upload to Supabase Storage
    const fileName = `couple-${person1Id}-${person2Id}-${Date.now()}.jpg`;
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from(COUPLE_IMAGES_BUCKET)
      .upload(fileName, composedImage, {
        contentType: 'image/jpeg',
        upsert: true,
      });

    if (uploadError) {
      console.error('Failed to upload couple image:', uploadError);
      return { success: false, error: uploadError.message };
    }

    // 6. Get public URL
    const { data: urlData } = supabase.storage
      .from(COUPLE_IMAGES_BUCKET)
      .getPublicUrl(fileName);

    const coupleImageUrl = urlData.publicUrl;
    console.log(`✅ [Couple] Couple image created:`, coupleImageUrl);

    // 7. Save to couple_claymations table
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
      // Non-fatal - we still have the image URL
    }

    return {
      success: true,
      coupleImageUrl,
      storagePath: fileName,
    };
  } catch (error: any) {
    console.error('❌ [Couple] Error creating couple image:', error);
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
