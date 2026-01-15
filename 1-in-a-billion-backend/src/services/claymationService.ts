/**
 * CLAYMATION PORTRAIT SERVICE
 * 
 * Transforms user photos into handcrafted claymation-style portraits
 * using OpenAI's GPT-4o Vision + DALL-E 3.
 * 
 * Purpose: Privacy-preserving profile images for the matching system.
 * When users match, they see each other's claymation portraits, not real photos.
 */

import axios from 'axios';
import * as fs from 'fs';
import * as path from 'path';
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

const CLAYMATION_STYLE_PROMPT = `Transform this portrait into a handcrafted analog claymation and collage sculpture aesthetic.

The subject must appear as a physically sculpted clay figure with realistic human proportions and a serious contemplative presence.

All surfaces should be matte and tactile, showing finger marks, rough material edges, slight asymmetry, and handcrafted imperfections.

Use soft directional lighting that creates warm natural shadows and emphasizes physical depth and texture.

The overall look must feel fully analog and handmade using the visual language of clay, carved plaster, linoleum collage, and aged paper.

CRITICAL: The background MUST be pure white (#FFFFFF). No colored backgrounds, no gradients, no textures in the background - just clean white.

AVOID: Any digital smoothness, gloss, airbrushing, typography, symbols, text, borders, stamps, or graphic elements. No aged paper or canvas backgrounds - the background must be WHITE.

The image should feel like a photographed physical sculpture rather than a digital illustration, grounded in a philosophical artisanal and material driven aesthetic.`;

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
 * Two-step process:
 * 1. Analyze the photo with GPT-4o Vision to describe the person
 * 2. Generate claymation with DALL-E 3 using the description
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
    const apiKey = await getApiKey('openai', env.OPENAI_API_KEY);
    if (!apiKey) {
      return { success: false, error: 'OpenAI API key not found' };
    }

    console.log('🎨 [Claymation] Starting portrait generation...');
    
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
    // STEP 1: Analyze photo with GPT-4o Vision (with style examples)
    // ─────────────────────────────────────────────────────────────────────
    console.log('👁️ [Claymation] Step 1: Analyzing photo with GPT-4o Vision...');
    
    // Build content array with user photo and optional style examples
    const contentArray: any[] = [
      {
        type: 'text',
        text: `You are helping create a claymation portrait. First, study these example claymation images to understand the desired aesthetic style:`
      }
    ];
    
    // Add example images as style references
    if (exampleImagesBase64.length > 0) {
      console.log(`📸 [Claymation] Including ${exampleImagesBase64.length} style examples...`);
      for (const exampleB64 of exampleImagesBase64) {
        contentArray.push({
          type: 'image_url',
          image_url: {
            url: `data:image/jpeg;base64,${exampleB64}`,
            detail: 'low' // Low detail for style examples to save tokens
          }
        });
      }
    }
    
    // Add the actual user photo and analysis request
    contentArray.push({
      type: 'text',
      text: `Now, describe the following person's appearance for an artist who will create a clay sculpture portrait in the SAME STYLE as the examples above. Include:
- Face shape (oval, round, square, heart-shaped, etc.)
- Hair color, length, and style
- Eye color and shape
- Skin tone
- Any distinctive features (beard, glasses, freckles, etc.)
- Expression/mood
- Approximate age range
- Gender presentation

Be specific and detailed but neutral. This description will be used to create an artistic claymation portrait matching the aesthetic of the examples.`
    });
    
    contentArray.push({
      type: 'image_url',
      image_url: {
        url: `data:image/jpeg;base64,${photoBase64}`,
        detail: 'high'
      }
    });
    
    const analysisResponse = await axios.post(
      'https://api.openai.com/v1/chat/completions',
      {
        model: 'gpt-4o',
        messages: [
          {
            role: 'user',
            content: contentArray
          }
        ],
        max_tokens: 500,
      },
      {
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        timeout: 90000, // Increased for multiple images
      }
    );

    const description = analysisResponse.data.choices?.[0]?.message?.content;
    if (!description) {
      return { success: false, error: 'Failed to analyze photo' };
    }

    console.log('📝 [Claymation] Got description:', description.slice(0, 100) + '...');

    // ─────────────────────────────────────────────────────────────────────
    // STEP 2: Generate claymation portrait with DALL-E 3
    // ─────────────────────────────────────────────────────────────────────
    console.log('🎭 [Claymation] Step 2: Generating claymation with DALL-E 3...');

    const dallePrompt = `Create a portrait of a person with these features:

${description}

${CLAYMATION_STYLE_PROMPT}

The portrait should be a bust (head and shoulders), centered, on a PURE WHITE BACKGROUND. No textures, no gradients, no aged paper - just clean white (#FFFFFF).`;

    const dalleResponse = await axios.post(
      'https://api.openai.com/v1/images/generations',
      {
        model: 'dall-e-3',
        prompt: dallePrompt,
        n: 1,
        size: '1024x1024',
        quality: 'hd',
        style: 'natural',
        response_format: 'b64_json',
      },
      {
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        timeout: 120000, // 2 min for image generation
      }
    );

    const generatedImageB64 = dalleResponse.data.data?.[0]?.b64_json;
    if (!generatedImageB64) {
      return { success: false, error: 'Failed to generate claymation image' };
    }

    console.log('✅ [Claymation] Image generated successfully');

    // ─────────────────────────────────────────────────────────────────────
    // STEP 3: Upload claymation to Supabase Storage
    // ─────────────────────────────────────────────────────────────────────
    const imageBuffer = Buffer.from(generatedImageB64, 'base64');
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
    // STEP 4: Update library_people record (if personId provided)
    // ─────────────────────────────────────────────────────────────────────
    if (personId) {
      const { error: updateError } = await supabase
        .from('library_people')
        .update({ 
          claymation_url: imageUrl,
          original_photo_url: originalUrl,
        })
        .eq('id', personId);

      if (updateError) {
        console.warn('⚠️ [Claymation] Could not update library_people:', updateError);
      } else {
        console.log('✅ [Claymation] Updated library_people with both URLs');
      }
    }

    return {
      success: true,
      imageUrl,
      originalUrl,
      storagePath,
      cost: 0.12, // Approximate: $0.04 vision (with examples) + $0.08 DALL-E 3 HD
    };

  } catch (error: any) {
    console.error('❌ [Claymation] Error:', error.message);
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
      .eq('id', personId)
      .single();

    if (data?.claymation_url) {
      return data.claymation_url;
    }
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
