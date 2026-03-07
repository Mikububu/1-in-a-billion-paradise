"use strict";
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
exports.audioRouter = void 0;
const hono_1 = require("hono");
const zod_1 = require("zod");
const fs = __importStar(require("fs"));
const axios_1 = __importDefault(require("axios"));
const child_process_1 = require("child_process");
const audioService_1 = require("../services/audioService");
const apiKeys_1 = require("../services/apiKeys");
const apiKeysHelper_1 = require("../services/apiKeysHelper");
const textCleanup_1 = require("../utils/textCleanup");
const phoneticizer_1 = require("../services/text/phoneticizer");
const audioProcessing_1 = require("../services/audioProcessing");
const replicateRateLimiter_1 = require("../services/replicateRateLimiter");
const requireAuth_1 = require("../middleware/requireAuth");
const logger_1 = require("../utils/logger");
const router = new hono_1.Hono();
async function withTimeout(promise, timeoutMs, label) {
    let timeoutHandle = null;
    try {
        return await Promise.race([
            promise,
            new Promise((_, reject) => {
                timeoutHandle = setTimeout(() => {
                    reject(new Error(`${label} timed out after ${timeoutMs}ms`));
                }, timeoutMs);
            }),
        ]);
    }
    finally {
        if (timeoutHandle)
            clearTimeout(timeoutHandle);
    }
}
const payloadSchema = zod_1.z.object({
    readingId: zod_1.z.string(),
});
router.post('/generate', async (c) => {
    const parsed = payloadSchema.parse(await c.req.json());
    const result = await audioService_1.audioService.requestGeneration(parsed.readingId);
    return c.json(result);
});
// Validate voice sample URLs: must be HTTPS and from trusted domains only.
// Prevents SSRF (e.g. someone passing http://169.254.169.254/... as audioUrl).
const ALLOWED_AUDIO_HOSTS = [
    'qdfikbgwuauertfmkmzk.supabase.co', // Our Supabase storage
    'replicate.delivery', // Replicate CDN
];
function validateAudioUrl(url) {
    try {
        const parsed = new URL(url);
        if (parsed.protocol !== 'https:')
            return false;
        return ALLOWED_AUDIO_HOSTS.some(h => parsed.hostname === h || parsed.hostname.endsWith(`.${h}`));
    }
    catch {
        return false;
    }
}
// TTS generation endpoint - Chatterbox Turbo via Replicate (voice cloning)
const ttsPayloadSchema = zod_1.z.object({
    text: zod_1.z.string().min(1).max(50000),
    voice: zod_1.z.string().optional().default('default'), // For Chatterbox: use voice cloning or default
    provider: zod_1.z.literal('chatterbox').optional().default('chatterbox'),
    title: zod_1.z.string().optional(),
    // Chatterbox-specific options
    exaggeration: zod_1.z.number().min(0).max(1).optional().default(0.3), // Emotion intensity (0.3 = natural voice)
    audioUrl: zod_1.z.string().optional() // URL to voice sample for cloning (validated below)
        .refine(val => !val || validateAudioUrl(val), {
        message: 'audioUrl must be HTTPS from a trusted domain',
    }),
    spokenIntro: zod_1.z.string().optional(),
    includeIntro: zod_1.z.boolean().optional().default(true),
});
// NOTE: Text chunking and WAV concatenation logic now imported from shared audioProcessing module
// To adjust chunking or crossfade behavior, edit: src/services/audioProcessing.ts
// Helper: Convert WAV buffer to MP3 (required for iOS data URI playback)
function wavToCompressed(wavBuffer) {
    const nonce = `${Date.now()}_${Math.random().toString(16).slice(2)}`;
    const tmpWav = `/tmp/tts_${nonce}.wav`;
    const tmpMp3 = `/tmp/tts_${nonce}.mp3`;
    const cleanup = () => {
        try {
            fs.unlinkSync(tmpWav);
        }
        catch { }
        try {
            fs.unlinkSync(tmpMp3);
        }
        catch { }
    };
    try {
        fs.writeFileSync(tmpWav, wavBuffer);
        (0, child_process_1.execSync)(`ffmpeg -y -i "${tmpWav}" -codec:a libmp3lame -b:a 128k "${tmpMp3}" 2>/dev/null`);
        const mp3Buffer = fs.readFileSync(tmpMp3);
        logger_1.logger.info(`WAV->MP3: ${Math.round(wavBuffer.length / 1024)}KB -> ${Math.round(mp3Buffer.length / 1024)}KB`);
        return { buffer: mp3Buffer, format: 'mp3', mime: 'audio/mpeg' };
    }
    finally {
        cleanup();
    }
}
router.post('/generate-tts', requireAuth_1.requireAuth, async (c) => {
    const parsed = ttsPayloadSchema.parse(await c.req.json());
    const { env } = await Promise.resolve().then(() => __importStar(require('../config/env')));
    const Replicate = (await Promise.resolve().then(() => __importStar(require('replicate')))).default;
    logger_1.logger.info(`TTS request (${parsed.provider}): ${parsed.text.substring(0, 100)}... (${parsed.text.length} chars)`);
    // CHATTERBOX via Replicate (resemble-ai/chatterbox-turbo)
    if (parsed.provider === 'chatterbox') {
        // Get Replicate API token from Supabase api_keys table (with env fallback)
        let replicateToken = await apiKeysHelper_1.apiKeys.replicate().catch(() => null) || env.REPLICATE_API_TOKEN;
        if (!replicateToken) {
            // Forced refresh: avoid stale negative cache after transient Supabase/API hiccups.
            (0, apiKeys_1.clearApiKeyCache)('replicate');
            replicateToken = await apiKeysHelper_1.apiKeys.replicate().catch(() => null) || env.REPLICATE_API_TOKEN;
        }
        if (!replicateToken) {
            return c.json({
                success: false,
                message: 'Replicate API token not found (check Supabase api_keys table or REPLICATE_API_TOKEN env var)',
            }, 500);
        }
        try {
            logger_1.logger.info('Generating audio with Chatterbox Turbo via Replicate...');
            const replicate = new Replicate({ auth: replicateToken });
            const generatedOn = new Date().toLocaleDateString('en-GB', {
                day: '2-digit',
                month: 'long',
                year: 'numeric',
            });
            const defaultIntro = parsed.title
                ? `This is an audio reading titled ${parsed.title}. Generated on ${generatedOn} by 1 in a billion app, powered by forbidden-yoga dot com.`
                : `This is an audio reading generated on ${generatedOn} by 1 in a billion app, powered by forbidden-yoga dot com.`;
            let cleaned = (0, textCleanup_1.cleanupTextForTTS)(parsed.text);
            cleaned = await (0, phoneticizer_1.phoneticizeTextForTTS)(cleaned, 'en');
            const dedup = (0, audioProcessing_1.dedupeAdjacentSentences)(cleaned);
            let narrationText = dedup.text;
            if (dedup.removed > 0) {
                logger_1.logger.warn(`[AudioRoute] Removed ${dedup.removed} adjacent duplicate sentence(s) before TTS.`);
            }
            if (parsed.includeIntro !== false) {
                const spokenIntro = String(parsed.spokenIntro || defaultIntro).trim();
                narrationText = `${spokenIntro}\n\n${narrationText}`.trim();
            }
            const textLength = narrationText.length;
            const configuredChunkSize = parseInt(process.env.CHATTERBOX_CHUNK_SIZE || String(audioProcessing_1.AUDIO_CONFIG.CHUNK_MAX_LENGTH), 10);
            const chunkSize = Math.max(120, Math.min(300, Number.isFinite(configuredChunkSize) ? configuredChunkSize : audioProcessing_1.AUDIO_CONFIG.CHUNK_MAX_LENGTH));
            if (chunkSize !== configuredChunkSize) {
                logger_1.logger.warn(`[AudioRoute] Clamped CHATTERBOX_CHUNK_SIZE ${configuredChunkSize} -> ${chunkSize}.`);
            }
            let chunks = (0, audioProcessing_1.splitIntoChunks)(narrationText, chunkSize);
            const boundaryDedup = (0, audioProcessing_1.dedupeChunkBoundaryOverlap)(chunks);
            chunks = boundaryDedup.chunks;
            if (boundaryDedup.removed > 0) {
                logger_1.logger.warn(`[AudioRoute] Removed ${boundaryDedup.removed} duplicated boundary sentence(s) across chunks.`);
            }
            logger_1.logger.info(`Chunking ${textLength} chars into ${chunks.length} pieces (max ${chunkSize} chars/chunk)`);
            // Voice sample for cloning (default narrator)
            const voiceSampleUrl = parsed.audioUrl || 'https://qdfikbgwuauertfmkmzk.supabase.co/storage/v1/object/public/voices/david.wav';
            const repetitionPenaltyRaw = Number(process.env.CHATTERBOX_REPETITION_PENALTY || '1.7');
            const repetitionPenalty = Number.isFinite(repetitionPenaltyRaw)
                ? Math.max(1, Math.min(2, repetitionPenaltyRaw))
                : 1.7;
            // Replicate chunk generator
            const routeChunkMaxRetries = Math.max(1, parseInt(process.env.REPLICATE_CHUNK_MAX_RETRIES || '6', 10));
            const generateChunk = async (chunk, index, maxRetries = routeChunkMaxRetries) => {
                for (let attempt = 1; attempt <= maxRetries; attempt++) {
                    try {
                        logger_1.logger.info(`[Replicate] Chunk ${index + 1}/${chunks.length} (${chunk.length} chars) attempt ${attempt}`);
                        // Build input for Replicate
                        const input = {
                            text: chunk,
                            reference_audio: voiceSampleUrl,
                            temperature: 0.7,
                            top_p: 0.95,
                            repetition_penalty: repetitionPenalty, // Reduces duplicate sentences
                        };
                        logger_1.logger.info('[Replicate] Calling API with model: resemble-ai/chatterbox-turbo');
                        const startTime = Date.now();
                        // Call Replicate API with hard timeout to avoid hung chunks.
                        const chunkTimeoutMs = parseInt(process.env.REPLICATE_CHUNK_TIMEOUT_MS || '120000', 10);
                        const output = await (0, replicateRateLimiter_1.runReplicateWithRateLimit)(`audioRoute:chunk:${index + 1}`, () => withTimeout(replicate.run('resemble-ai/chatterbox-turbo', { input }), chunkTimeoutMs, `Replicate chunk ${index + 1}`));
                        const elapsed = ((Date.now() - startTime) / 1000).toFixed(2);
                        logger_1.logger.info(`[Replicate] API call completed in ${elapsed}s`);
                        // Handle different output types (stream, URL, buffer)
                        let audioBuffer;
                        if (output instanceof ReadableStream || output.getReader) {
                            logger_1.logger.info('[Replicate] Processing as ReadableStream...');
                            const reader = output.getReader();
                            const streamChunks = [];
                            while (true) {
                                const { done, value } = await reader.read();
                                if (done)
                                    break;
                                streamChunks.push(value);
                            }
                            audioBuffer = Buffer.concat(streamChunks);
                            logger_1.logger.info(`[Replicate] Stream processed: ${streamChunks.length} chunks, ${audioBuffer.length} bytes`);
                        }
                        else if (typeof output === 'string') {
                            logger_1.logger.info(`[Replicate] Processing as URL: ${output.substring(0, 60)}...`);
                            const response = await axios_1.default.get(output, { responseType: 'arraybuffer' });
                            audioBuffer = Buffer.from(response.data);
                            logger_1.logger.info(`[Replicate] URL fetched: ${audioBuffer.length} bytes`);
                        }
                        else if (Buffer.isBuffer(output)) {
                            logger_1.logger.info(`[Replicate] Direct buffer received: ${output.length} bytes`);
                            audioBuffer = output;
                        }
                        else {
                            logger_1.logger.warn('[Replicate] Unknown output type, attempting conversion...');
                            const data = await output.arrayBuffer?.() || output;
                            audioBuffer = Buffer.from(data);
                            logger_1.logger.info(`[Replicate] Converted to buffer: ${audioBuffer.length} bytes`);
                        }
                        logger_1.logger.info(`[Replicate] Chunk ${index + 1} completed: ${audioBuffer.length} bytes`);
                        return audioBuffer;
                    }
                    catch (error) {
                        const is429 = (0, replicateRateLimiter_1.isReplicateRateLimitError)(error);
                        const isAuthError = error.message?.includes('401') || error.message?.includes('authentication') || error.message?.includes('Unauthorized');
                        const isBadRequest = error.message?.includes('400') || error.message?.includes('422') || error.message?.includes('invalid');
                        logger_1.logger.error(`[Replicate] Chunk ${index + 1} attempt ${attempt} failed: ${error.message}`);
                        // ABORT IMMEDIATELY on auth or bad request errors (no retry)
                        if (isAuthError || isBadRequest) {
                            throw new Error(`Replicate error: ${error.message}`);
                        }
                        if (attempt < maxRetries) {
                            const retryAfter = is429 ? 12 : attempt * 3;
                            logger_1.logger.info(`Retrying in ${retryAfter}s...${is429 ? ' (rate limited)' : ''}`);
                            await new Promise(r => setTimeout(r, retryAfter * 1000));
                        }
                        else {
                            throw error;
                        }
                    }
                }
                throw new Error(`Chunk ${index + 1} failed after ${maxRetries} retries`);
            };
            // Inter-chunk delay to respect Replicate rate limits.
            // Keep default low; retries already honor API-provided retry_after.
            const chunkDelayMs = parseInt(process.env.REPLICATE_CHUNK_DELAY_MS || '0', 10);
            const startTime = Date.now();
            let audioBuffers = [];
            const parallelMode = String(process.env.AUDIO_ROUTE_PARALLEL || 'true').toLowerCase() === 'true';
            const parallelLimit = Math.max(1, parseInt(process.env.AUDIO_ROUTE_CONCURRENCY || '2', 10));
            if (parallelMode) {
                const pLimit = (await Promise.resolve().then(() => __importStar(require('p-limit')))).default;
                const limiter = pLimit(parallelLimit);
                logger_1.logger.info(`Starting PARALLEL chunk scheduling for ${chunks.length} chunks (limit ${parallelLimit}); shared limiter enforces Replicate pacing...`);
                const results = await Promise.all(chunks.map((chunk, i) => limiter(async () => {
                    const buffer = await generateChunk(chunk, i);
                    return { i, buffer };
                })));
                results.sort((a, b) => a.i - b.i);
                audioBuffers = results.map((r) => r.buffer);
            }
            else {
                // SEQUENTIAL MODE - safer for strict rate limits
                logger_1.logger.info(`Starting SEQUENTIAL Replicate generation of ${chunks.length} chunks (${chunkDelayMs}ms delay)...`);
                for (let i = 0; i < chunks.length; i++) {
                    try {
                        const buffer = await generateChunk(chunks[i], i);
                        audioBuffers.push(buffer);
                        // Add delay between chunks to respect rate limits (except for last chunk)
                        if (i < chunks.length - 1 && chunkDelayMs > 0) {
                            logger_1.logger.info(`Waiting ${chunkDelayMs}ms before next chunk...`);
                            await new Promise(r => setTimeout(r, chunkDelayMs));
                        }
                    }
                    catch (err) {
                        logger_1.logger.error(`Chunk ${i + 1} failed permanently: ${err.message}`);
                        throw err;
                    }
                }
            }
            const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
            logger_1.logger.info(`All ${chunks.length} chunks completed in ${elapsed}s`);
            // Concatenate all chunks into WAV
            const wavAudio = (0, audioProcessing_1.concatenateWavBuffers)(audioBuffers);
            // Convert to M4A (primary format only)
            const { buffer: compressedAudio, format, mime } = wavToCompressed(wavAudio);
            const base64Audio = compressedAudio.toString('base64');
            logger_1.logger.info(`Final audio: ${Math.round(compressedAudio.length / 1024)}KB ${format.toUpperCase()} from ${audioBuffers.length} chunks`);
            // Calculate duration from actual WAV header (sample rate may vary)
            let estimatedDuration;
            try {
                const fmt = (0, audioProcessing_1.getWavFormat)(wavAudio);
                const bytesPerSec = fmt.sampleRate * fmt.numChannels * (fmt.bitsPerSample / 8);
                estimatedDuration = Math.ceil((wavAudio.length - 44) / bytesPerSec);
            }
            catch {
                estimatedDuration = Math.ceil((wavAudio.length - 44) / 48000); // fallback: 24kHz mono 16-bit
            }
            return c.json({
                success: true,
                message: 'Audio generated successfully (Chatterbox via Replicate)',
                audioBase64: base64Audio,
                audioUrl: `data:${mime};base64,${base64Audio}`,
                durationSeconds: estimatedDuration,
                format,
                provider: 'chatterbox-replicate',
                chunks: chunks.length,
            });
        }
        catch (error) {
            logger_1.logger.error('Replicate Chatterbox error', { detail: error.response?.data || error.message });
            return c.json({
                success: false,
                message: `Chatterbox (Replicate) failed: ${error.message}`,
                error: error.response?.data || error.message,
            }, 500);
        }
    }
    // No valid provider
    return c.json({
        success: false,
        message: 'No TTS provider available. Use provider: "chatterbox"',
        audioUrl: null,
        durationSeconds: 0,
    });
});
router.get('/stream/:id', async (c) => {
    const id = c.req.param('id');
    return c.json({
        id,
        url: `https://cdn.oneinabillion.app/audio/${id}.mp3`,
        message: 'Replace with signed URL once storage is connected.',
    });
});
// 🚀 STREAMING TTS - Send audio chunks as they complete via SSE
// Client can start playing immediately while remaining chunks generate
router.post('/generate-tts-stream', requireAuth_1.requireAuth, async (c) => {
    const parsed = ttsPayloadSchema.parse(await c.req.json());
    // SINGLE SOURCE OF TRUTH: Supabase api_keys table
    let runpodApiKey;
    let runpodEndpointId;
    try {
        runpodApiKey = await apiKeysHelper_1.apiKeys.runpod();
        runpodEndpointId = await apiKeysHelper_1.apiKeys.runpodEndpoint();
    }
    catch (err) {
        return c.json({ success: false, message: 'RunPod not configured' }, 500);
    }
    const textLength = parsed.text.length;
    const chunkSize = parseInt(process.env.CHATTERBOX_CHUNK_SIZE || String(audioProcessing_1.AUDIO_CONFIG.CHUNK_MAX_LENGTH), 10);
    const chunks = (0, audioProcessing_1.splitIntoChunks)(parsed.text, chunkSize);
    const voiceSampleUrl = parsed.audioUrl || 'https://qdfikbgwuauertfmkmzk.supabase.co/storage/v1/object/public/voices/david.wav';
    logger_1.logger.info(`STREAMING TTS: ${textLength} chars -> ${chunks.length} chunks (max ${chunkSize} chars/chunk)`);
    // Set up SSE response
    c.header('Content-Type', 'text/event-stream');
    c.header('Cache-Control', 'no-cache');
    c.header('Connection', 'keep-alive');
    const stream = new ReadableStream({
        async start(controller) {
            const encoder = new TextEncoder();
            // Send initial info
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({
                type: 'start',
                totalChunks: chunks.length,
                estimatedDuration: Math.ceil(textLength / 15) // ~15 chars/sec speaking
            })}\n\n`));
            // Generate chunk function
            const generateChunk = async (chunk, index) => {
                for (let attempt = 1; attempt <= 3; attempt++) {
                    try {
                        const response = await axios_1.default.post(`https://api.runpod.ai/v2/${runpodEndpointId}/runsync`, {
                            input: {
                                text: chunk,
                                audio_url: voiceSampleUrl,
                                exaggeration: parsed.exaggeration || 0.3,
                                cfg_weight: 0.5,
                            }
                        }, {
                            headers: {
                                'Authorization': `Bearer ${runpodApiKey}`,
                                'Content-Type': 'application/json',
                            },
                            timeout: 180000,
                        });
                        const audio = response.data?.output?.audio_base64;
                        if (audio) {
                            logger_1.logger.info(`Chunk ${index + 1}/${chunks.length} ready`);
                            return { index, audio };
                        }
                    }
                    catch (e) {
                        if (attempt < 3) {
                            await new Promise(r => setTimeout(r, attempt * 3000));
                        }
                    }
                }
                return null;
            };
            // Start all chunks in parallel
            const promises = chunks.map((chunk, i) => generateChunk(chunk, i));
            // Track completed chunks and send in order
            const completed = new Map();
            const failed = new Set();
            let nextToSend = 0;
            // Process as they complete
            for (const promise of promises) {
                const result = await promise;
                if (result) {
                    completed.set(result.index, result.audio);
                }
                else {
                    // Find the index of the failed chunk (first pending one not in completed or failed)
                    for (let i = 0; i < chunks.length; i++) {
                        if (!completed.has(i) && !failed.has(i)) {
                            failed.add(i);
                            logger_1.logger.error(`Streaming TTS: Chunk ${i + 1}/${chunks.length} failed after all retries`);
                            controller.enqueue(encoder.encode(`data: ${JSON.stringify({
                                type: 'error',
                                index: i,
                                message: `Chunk ${i + 1} failed after 3 retries`,
                            })}\n\n`));
                            break;
                        }
                    }
                }
                // Send any consecutive completed chunks (skip failed ones)
                while (completed.has(nextToSend) || failed.has(nextToSend)) {
                    if (completed.has(nextToSend)) {
                        const audio = completed.get(nextToSend);
                        controller.enqueue(encoder.encode(`data: ${JSON.stringify({
                            type: 'chunk',
                            index: nextToSend,
                            audio: audio,
                            progress: Math.round(((nextToSend + 1) / chunks.length) * 100)
                        })}\n\n`));
                        completed.delete(nextToSend);
                    }
                    nextToSend++;
                }
            }
            // Send completion with failure summary
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({
                type: 'complete',
                totalChunks: chunks.length,
                failedChunks: failed.size,
                success: failed.size === 0,
            })}\n\n`));
            controller.close();
        }
    });
    return new Response(stream, {
        headers: {
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache',
            'Connection': 'keep-alive',
        },
    });
});
// Hook audio generation endpoint - stores in Supabase Storage and returns URL
const hookAudioSchema = zod_1.z.object({
    userId: zod_1.z.string().uuid(),
    type: zod_1.z.enum(['sun', 'moon', 'rising']),
    text: zod_1.z.string().min(1),
    language: zod_1.z.string().default('en'),
    personId: zod_1.z.string().optional(), // Optional: for partner/3rd-person audio (separate storage path)
    exaggeration: zod_1.z.number().min(0).max(1).optional().default(0.3),
    audioUrl: zod_1.z.string().optional() // Voice sample URL (validated for SSRF)
        .refine(val => !val || validateAudioUrl(val), {
        message: 'audioUrl must be HTTPS from a trusted domain',
    }),
});
router.post('/hook-audio/generate', requireAuth_1.requireAuth, async (c) => {
    try {
        const parsed = hookAudioSchema.parse(await c.req.json());
        const { supabase } = await Promise.resolve().then(() => __importStar(require('../services/supabaseClient')));
        const { generateMinimaxAsync, getMinimaxSequenceForUrl } = await Promise.resolve().then(() => __importStar(require('../services/minimaxTts')));
        if (!supabase) {
            return c.json({ success: false, error: 'Supabase not configured' }, 500);
        }
        // Use authenticated userId from JWT token instead of request body
        const userId = c.get('userId');
        const language = parsed.language || 'en';
        logger_1.logger.info(`Hook audio generation (MiniMax): ${parsed.type} for user ${userId} (${parsed.text.length} chars, lang=${language})`);
        // Clean text for TTS pronunciation
        let cleanedText = (0, textCleanup_1.cleanupTextForTTS)(parsed.text, language);
        cleanedText = await (0, phoneticizer_1.phoneticizeTextForTTS)(cleanedText, language);
        logger_1.logger.info(`Cleaned text: ${cleanedText.length} chars`);
        // Look up David's registered MiniMax clone voice ID from api_keys table
        // (same pattern as audioWorker.ts lines 424-436)
        let minimaxVoiceId = 'English_expressive_narrator'; // fallback base voice
        let hasRegisteredClone = false;
        try {
            const { data: cloneKey } = await supabase
                .from('api_keys')
                .select('token')
                .eq('service', 'minimax_clone_david')
                .maybeSingle();
            if (cloneKey?.token) {
                minimaxVoiceId = cloneKey.token;
                hasRegisteredClone = true;
                logger_1.logger.info(`Using registered David clone: ${minimaxVoiceId}`);
            }
        }
        catch (e) {
            logger_1.logger.warn('[HookAudio] Could not look up David clone ID', { error: e.message });
        }
        // If no registered clone, upload reference audio for inline cloning
        let clonePromptFileId;
        if (!hasRegisteredClone) {
            try {
                const DAVID_CLONE_URL = 'https://qdfikbgwuauertfmkmzk.supabase.co/storage/v1/object/public/voices/david_clone.wav';
                clonePromptFileId = await getMinimaxSequenceForUrl(DAVID_CLONE_URL, 'david_clone.wav');
                logger_1.logger.info(`Using inline clone_prompt for David: ${clonePromptFileId}`);
            }
            catch (e) {
                logger_1.logger.warn('[HookAudio] Could not upload David clone reference', { error: e.message });
            }
        }
        // Generate audio via MiniMax (hook readings are ~600 chars, well within limit)
        // MiniMax returns MP3 directly — no WAV concatenation or conversion needed
        const mp3Buffer = await generateMinimaxAsync(cleanedText, minimaxVoiceId, clonePromptFileId, 1.0, // speed
        1.0, // volume
        language);
        // Estimate duration (MP3 at 128kbps = ~16000 bytes/sec)
        const estimatedDuration = Math.ceil(mp3Buffer.length / 16000);
        // Store in Supabase Storage (library bucket)
        // If personId is provided, store under person-specific path (for partner audio)
        const storagePath = parsed.personId
            ? `hook-audio/${userId}/${language}/${parsed.personId}/${parsed.type}.mp3`
            : `hook-audio/${userId}/${language}/${parsed.type}.mp3`;
        const { error: uploadError } = await supabase.storage
            .from('library')
            .upload(storagePath, mp3Buffer, {
            contentType: 'audio/mpeg',
            upsert: true,
            cacheControl: '3600',
        });
        if (uploadError) {
            logger_1.logger.error('Failed to upload hook audio', { error: uploadError.message });
            return c.json({
                success: false,
                error: `Storage upload failed: ${uploadError.message}`,
            }, 500);
        }
        // Get signed URL (library is a private bucket — public URLs return 400)
        let audioUrl;
        const { data: signedData, error: signedError } = await supabase.storage
            .from('library')
            .createSignedUrl(storagePath, 60 * 60 * 24); // 24 hours
        if (signedData?.signedUrl) {
            audioUrl = signedData.signedUrl;
        }
        else {
            logger_1.logger.warn('Signed URL failed, falling back to public URL', { error: signedError?.message });
            const { data: urlData } = supabase.storage
                .from('library')
                .getPublicUrl(storagePath);
            audioUrl = urlData.publicUrl;
        }
        logger_1.logger.info(`Hook audio stored: ${storagePath} (${Math.round(mp3Buffer.length / 1024)}KB, ~${estimatedDuration}s)`);
        return c.json({
            success: true,
            audioUrl,
            storagePath,
            durationSeconds: estimatedDuration,
            format: 'mp3',
            sizeBytes: mp3Buffer.length,
        });
    }
    catch (error) {
        logger_1.logger.error('Hook audio generation error', { error: error?.message || String(error) });
        return c.json({
            success: false,
            error: error.message || 'Hook audio generation failed',
        }, 500);
    }
});
exports.audioRouter = router;
//# sourceMappingURL=audio.js.map