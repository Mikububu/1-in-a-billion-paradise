"use strict";
/**
 * AI PORTRAIT SERVICE
 *
 * Transforms user photos into AI-styled portraits
 * using Google AI Studio (image-to-image transformation).
 *
 * Purpose: Privacy-preserving profile images for the matching system.
 * When users match, they see each other's AI-generated portraits, not real photos.
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateAIPortrait = generateAIPortrait;
exports.getAIPortrait = getAIPortrait;
const genai_1 = require("@google/genai");
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const sharp_1 = __importDefault(require("sharp"));
const apiKeys_1 = require("./apiKeys");
const env_1 = require("../config/env");
const supabaseClient_1 = require("./supabaseClient");
const imagePromptLayers_1 = require("../promptEngine/imagePromptLayers");
const layerLoader_1 = require("../promptEngine/layerLoader");
const costTracking_1 = require("./costTracking");
// ═══════════════════════════════════════════════════════════════════════════
// EXAMPLE IMAGES (loaded at startup for style reference)
// ═══════════════════════════════════════════════════════════════════════════
let exampleImagesBase64 = [];
function loadExampleImages() {
    if (exampleImagesBase64.length > 0)
        return; // Already loaded
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
    }
    catch (err) {
        console.warn('⚠️ [AI Portrait] Could not load example images:', err);
    }
}
// Load on module init
loadExampleImages();
function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}
function isRetryableError(error) {
    const message = String(error?.message || '');
    const status = Number(error?.status || error?.statusCode || 0);
    return (/fetch failed|terminated|timeout|ETIMEDOUT|ECONNRESET|socket|Bad Gateway|gateway/i.test(message) ||
        status >= 500);
}
async function generateGoogleImageWithRetry(ai, parts, maxAttempts = 4) {
    let lastError;
    for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
        try {
            return await ai.models.generateContent({
                model: env_1.env.GOOGLE_IMAGE_MODEL || 'gemini-3-pro-image-preview',
                contents: { parts },
                config: {
                    imageConfig: {
                        aspectRatio: '1:1',
                    },
                },
            });
        }
        catch (error) {
            lastError = error;
            const retryable = isRetryableError(error);
            if (!retryable || attempt === maxAttempts) {
                throw error;
            }
            const delayMs = attempt * 2500;
            console.warn(`⚠️ [AI Portrait] Google image call failed (attempt ${attempt}/${maxAttempts}): ${error?.message || error}. Retrying in ${delayMs}ms...`);
            await sleep(delayMs);
        }
    }
    throw lastError;
}
async function uploadPortraitWithRetry(supabase, storagePath, imageBuffer, maxAttempts = 4) {
    let lastError = null;
    for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
        const { error } = await supabase.storage
            .from('profile-images')
            .upload(storagePath, imageBuffer, {
            contentType: 'image/png',
            upsert: true,
        });
        if (!error) {
            return { error: null };
        }
        lastError = error;
        if (!isRetryableError(error) || attempt === maxAttempts) {
            return { error };
        }
        const delayMs = attempt * 2000;
        console.warn(`⚠️ [AI Portrait] Upload failed (attempt ${attempt}/${maxAttempts}): ${error.message || error}. Retrying in ${delayMs}ms...`);
        await sleep(delayMs);
    }
    return { error: lastError };
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
async function generateAIPortrait(photoBase64, userId, personId) {
    const supabase = (0, supabaseClient_1.createSupabaseServiceClient)();
    if (!supabase) {
        return { success: false, error: 'Supabase not configured' };
    }
    try {
        const googleKey = await (0, apiKeys_1.getApiKey)('google_ai_studio', env_1.env.GOOGLE_AI_STUDIO_API_KEY || '');
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
        let originalUrl;
        if (!originalUploadError) {
            const { data: originalUrlData } = supabase.storage
                .from('profile-images')
                .getPublicUrl(originalPath);
            originalUrl = originalUrlData.publicUrl;
            console.log('✅ [AI Portrait] Original stored at:', originalUrl);
        }
        else {
            console.warn('⚠️ [AI Portrait] Could not store original:', originalUploadError.message);
        }
        // ─────────────────────────────────────────────────────────────────────
        // STEP 1: Compress input image to 1024x1024 JPEG (Google AI Studio payload limit)
        // ─────────────────────────────────────────────────────────────────────
        console.log('📐 [AI Portrait] Compressing input image to 1024px JPEG for Google AI Studio payload...');
        const originalImageBuffer = Buffer.from(photoBase64.includes(',') ? photoBase64.split(',')[1] : photoBase64, 'base64');
        const resizedForAPI = await (0, sharp_1.default)(originalImageBuffer)
            .resize(1024, 1024, { fit: 'inside', withoutEnlargement: true })
            .jpeg({ quality: 85 })
            .toBuffer();
        // ─────────────────────────────────────────────────────────────────────
        // STEP 2: Generate AI portrait directly with Google AI Studio (image-to-image)
        // ─────────────────────────────────────────────────────────────────────
        console.log('🎨 [AI Portrait] Generating AI portrait with Google AI Studio...');
        const ai = new genai_1.GoogleGenAI({ apiKey: googleKey });
        // Build parts array: image first, then text (matching working code)
        const parts = [];
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
            stylePrompt = await (0, imagePromptLayers_1.loadImagePromptLayerAsync)('single_portrait');
            console.log(`🧾 [AI Portrait] Using image prompt layer "single_portrait": ${stylePrompt.replace(/\s+/g, ' ').slice(0, 140)}...`);
        }
        catch (err) {
            console.warn('⚠️ [AI Portrait] Failed to load image prompt layer, using fallback:', err?.message || err);
            stylePrompt = `High-contrast Linoleum analog handcrafted style. Bold black strokes on textured off-white paper. Smooth, hand-carved edges and negative space. Minimalist palette (mostly black/white with a single accent color like red). 2D graphic illustration. Isolated on white. Extreme close-up zoomed in, subject fills entire frame edge to edge, no empty margins or white space around subject.`;
        }
        parts.push({ text: stylePrompt });
        // Fetch preferred model from Supabase ai_configurations
        const defaultModel = env_1.env.GOOGLE_IMAGE_MODEL || 'gemini-3-pro-image-preview';
        const activeModel = await (0, layerLoader_1.getConfigAsync)('google_image_model', defaultModel);
        // Generate using the SDK with retry/backoff for transient network failures.
        let lastError;
        let response;
        for (let attempt = 1; attempt <= 4; attempt += 1) {
            try {
                response = await ai.models.generateContent({
                    model: activeModel,
                    contents: { parts },
                    config: {
                        imageConfig: {
                            aspectRatio: '1:1',
                        },
                    },
                });
                break; // Success
            }
            catch (error) {
                lastError = error;
                const retryable = isRetryableError(error);
                if (!retryable || attempt === 4) {
                    throw error;
                }
                const delayMs = attempt * 2500;
                console.warn(`⚠️ [AI Portrait] Google image call failed (attempt ${attempt}/4): ${error?.message || error}. Retrying in ${delayMs}ms...`);
                await new Promise(resolve => setTimeout(resolve, delayMs));
            }
        }
        // Extract image from response (loop through parts to find inlineData)
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
        const trimmedBuffer = await (0, sharp_1.default)(rawImageBuffer)
            .trim({ threshold: 30 }) // Trim pixels similar to white/off-white
            .toBuffer();
        // Then apply other processing
        const imageBuffer = await (0, sharp_1.default)(trimmedBuffer)
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
        const { error: uploadError } = await uploadPortraitWithRetry(supabase, storagePath, imageBuffer);
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
        }
        else {
            console.log('✅ [AI Portrait] Updated library_people with both URLs');
        }
        // Log the cost of generation
        await (0, costTracking_1.logGoogleAiStudioCost)(`portrait_${userId}_${personId || 'self'}`, undefined, 1, 'AI Portrait Generation Step');
        return {
            success: true,
            imageUrl,
            originalUrl,
            storagePath,
            cost: 0.05, // Google AI Studio image generation (estimated fallback, actual logged to DB)
        };
    }
    catch (error) {
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
async function getAIPortrait(userId, personId) {
    const supabase = (0, supabaseClient_1.createSupabaseServiceClient)();
    if (!supabase)
        return null;
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
    }
    else {
        const { data } = await supabase
            .from('library_people')
            .select('portrait_url')
            .eq('user_id', userId)
            .eq('is_user', true)
            .maybeSingle();
        if (data?.portrait_url)
            return data.portrait_url;
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
    }
    catch {
        // File doesn't exist
    }
    return null;
}
//# sourceMappingURL=aiPortraitService.js.map