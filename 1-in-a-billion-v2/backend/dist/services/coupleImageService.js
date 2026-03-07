"use strict";
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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.composeCoupleImage = composeCoupleImage;
exports.getCoupleImage = getCoupleImage;
const genai_1 = require("@google/genai");
const supabaseClient_1 = require("./supabaseClient");
const apiKeys_1 = require("./apiKeys");
const env_1 = require("../config/env");
const sharp_1 = __importDefault(require("sharp"));
const fs_1 = __importDefault(require("fs"));
const imagePromptLayers_1 = require("../promptEngine/imagePromptLayers");
const layerLoader_1 = require("../promptEngine/layerLoader");
const avatarUtils_1 = require("../utils/avatarUtils");
const COUPLE_IMAGES_BUCKET = 'couple-portraits';
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
async function composeCoupleImage(userId, person1Id, person2Id, portrait1Url, portrait2Url) {
    const supabase = (0, supabaseClient_1.createSupabaseServiceClient)();
    if (!supabase) {
        return { success: false, error: 'Supabase not configured' };
    }
    try {
        // ⚠️ CRITICAL VALIDATION: Ensure we're receiving styled portraits, not original photos
        // Styled portraits should be in profile-images bucket with /AI-generated-portrait.png suffix
        // or in couple-portraits bucket
        const isStyledPortrait1 = portrait1Url.includes('/AI-generated-portrait.png') || portrait1Url.includes('couple-portraits') || (0, avatarUtils_1.isLocalFileUrl)(portrait1Url);
        const isStyledPortrait2 = portrait2Url.includes('/AI-generated-portrait.png') || portrait2Url.includes('couple-portraits') || (0, avatarUtils_1.isLocalFileUrl)(portrait2Url);
        if (!isStyledPortrait1 || !isStyledPortrait2) {
            console.warn('⚠️ [Couple] WARNING: URLs do not appear to be styled portraits!');
            console.warn('   Expected URLs to contain "/AI-generated-portrait.png" or be fallback avatars.');
            // Don't fail completely, but log the warning
        }
        const googleKey = await (0, apiKeys_1.getApiKey)('google_ai_studio', env_1.env.GOOGLE_AI_STUDIO_API_KEY || '');
        if (!googleKey) {
            return { success: false, error: 'Google AI Studio API key not found' };
        }
        console.log(`👫 [Couple] Generating AI couple portrait for ${person1Id} + ${person2Id}...`);
        // 1. Download both portrait images
        const fetchImage = async (url) => {
            if ((0, avatarUtils_1.isLocalFileUrl)(url)) {
                return await fs_1.default.promises.readFile((0, avatarUtils_1.getLocalFilePath)(url));
            }
            const res = await fetch(url);
            if (!res.ok)
                throw new Error(`HTTP ${res.status}`);
            const ab = await res.arrayBuffer();
            return Buffer.from(ab);
        };
        let image1Buffer;
        let image2Buffer;
        try {
            [image1Buffer, image2Buffer] = await Promise.all([
                fetchImage(portrait1Url),
                fetchImage(portrait2Url),
            ]);
        }
        catch (e) {
            return { success: false, error: `Failed to download portrait images: ${e.message}` };
        }
        // 1.5. Convert and resize images to 1024x1024 JPEG to prevent payload size timeouts
        console.log('📐 [Couple] Compressing images for Google AI Studio payload...');
        const [processed1, processed2] = await Promise.all([
            (0, sharp_1.default)(Buffer.from(image1Buffer))
                .resize(1024, 1024, { fit: 'inside', withoutEnlargement: true })
                .jpeg({ quality: 85 })
                .toBuffer(),
            (0, sharp_1.default)(Buffer.from(image2Buffer))
                .resize(1024, 1024, { fit: 'inside', withoutEnlargement: true })
                .jpeg({ quality: 85 })
                .toBuffer(),
        ]);
        // Convert to base64
        const image1Base64 = processed1.toString('base64');
        const image2Base64 = processed2.toString('base64');
        // 2. Generate couple portrait with Google AI Studio
        const ai = new genai_1.GoogleGenAI({ apiKey: googleKey });
        let synastryPrompt = '';
        try {
            synastryPrompt = await (0, imagePromptLayers_1.loadImagePromptLayerAsync)('synastry_portrait');
            console.log(`🧾 [Couple] Using image prompt layer "synastry_portrait": ${synastryPrompt.replace(/\s+/g, ' ').slice(0, 140)}...`);
        }
        catch (err) {
            console.warn('⚠️ [Couple] Failed to load synastry image prompt layer, using fallback:', err?.message || err);
            synastryPrompt = 'Compose these two stylized portraits into a romantic couple portrait. Keep the exact same artistic style from the input portraits. Show them arm in arm in love, intimate composition. Preserve the facial features from both portraits exactly as shown - do not change or reinterpret the faces. Extreme close-up zoomed in, subjects fill entire frame edge to edge, no empty margins or white space around subjects.';
        }
        const parts = [
            // First person's portrait
            {
                inlineData: {
                    data: image1Base64,
                    mimeType: 'image/jpeg'
                }
            },
            // Second person's portrait
            {
                inlineData: {
                    data: image2Base64,
                    mimeType: 'image/jpeg'
                }
            },
            // Romantic couple composition prompt
            {
                text: synastryPrompt
            }
        ];
        const defaultModel = env_1.env.GOOGLE_IMAGE_MODEL || 'gemini-3-pro-image-preview';
        const activeModel = await (0, layerLoader_1.getConfigAsync)('google_image_model', defaultModel);
        const response = await ai.models.generateContent({
            model: activeModel,
            contents: { parts },
            config: {
                imageConfig: {
                    aspectRatio: "1:1"
                }
            }
        });
        // Extract generated image
        let generatedImageB64;
        if (response.candidates?.[0]?.content?.parts) {
            for (const part of response.candidates[0].content.parts) {
                if (part.inlineData?.data) {
                    generatedImageB64 = part.inlineData.data;
                    break;
                }
            }
        }
        if (!generatedImageB64) {
            console.error('❌ [Couple] No image in AI response, generation failed.');
            return { success: false, error: 'No image data returned from AI' };
        }
        console.log('✅ [Couple] AI couple portrait generated successfully');
        // 3. Post-process the image: auto-crop white space, then enhance
        const rawImageBuffer = Buffer.from(generatedImageB64, 'base64');
        // First trim white/off-white background
        const trimmedBuffer = await (0, sharp_1.default)(rawImageBuffer)
            .trim({ threshold: 30 }) // Trim pixels similar to white/off-white
            .toBuffer();
        // Then apply other processing
        const imageBuffer = await (0, sharp_1.default)(trimmedBuffer)
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
    }
    catch (error) {
        console.error('❌ [Couple] AI generation failed:', error.message);
        return { success: false, error: error?.message || 'Unknown generation error' };
    }
}
/**
 * Get existing couple image URL, or generate if it doesn't exist
 */
async function getCoupleImage(userId, person1Id, person2Id, portrait1Url, portrait2Url, forceRegenerate = false) {
    const supabase = (0, supabaseClient_1.createSupabaseServiceClient)();
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
                }
                else {
                    console.log('🔄 [Couple] Solo images changed, regenerating...');
                }
            }
        }
        // Generate new couple image
        return await composeCoupleImage(userId, id1, id2, url1, url2);
    }
    catch (error) {
        console.error('❌ [Couple] Error getting couple image:', error);
        return {
            success: false,
            error: error?.message || 'Unknown error',
        };
    }
}
//# sourceMappingURL=coupleImageService.js.map