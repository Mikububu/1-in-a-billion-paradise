import { Hono } from 'hono';
import { z } from 'zod';
import * as fs from 'fs';
import axios from 'axios';
import { execSync } from 'child_process';
import { audioService } from '../services/audioService';
import { clearApiKeyCache } from '../services/apiKeys';
import { apiKeys } from '../services/apiKeysHelper';
import { cleanupTextForTTS } from '../utils/textCleanup';
import { phoneticizeTextForTTS } from '../services/text/phoneticizer';
import {
  splitIntoChunks,
  concatenateWavBuffers,
  getWavFormat,
  AUDIO_CONFIG,
  dedupeAdjacentSentences,
  dedupeChunkBoundaryOverlap,
} from '../services/audioProcessing';
import {
  isReplicateRateLimitError,
  runReplicateWithRateLimit,
} from '../services/replicateRateLimiter';

import type { AppEnv } from '../types/hono';
import { requireAuth } from '../middleware/requireAuth';
import { logger } from '../utils/logger';

const router = new Hono<AppEnv>();

async function withTimeout<T>(promise: Promise<T>, timeoutMs: number, label: string): Promise<T> {
  let timeoutHandle: NodeJS.Timeout | null = null;
  try {
    return await Promise.race([
      promise,
      new Promise<never>((_, reject) => {
        timeoutHandle = setTimeout(() => {
          reject(new Error(`${label} timed out after ${timeoutMs}ms`));
        }, timeoutMs);
      }),
    ]);
  } finally {
    if (timeoutHandle) clearTimeout(timeoutHandle);
  }
}

const payloadSchema = z.object({
  readingId: z.string(),
});

router.post('/generate', async (c) => {
  const parsed = payloadSchema.parse(await c.req.json());
  const result = await audioService.requestGeneration(parsed.readingId);
  return c.json(result);
});



// Validate voice sample URLs: must be HTTPS and from trusted domains only.
// Prevents SSRF (e.g. someone passing http://169.254.169.254/... as audioUrl).
const ALLOWED_AUDIO_HOSTS = [
  'qdfikbgwuauertfmkmzk.supabase.co',  // Our Supabase storage
  'replicate.delivery',                  // Replicate CDN
];
function validateAudioUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== 'https:') return false;
    return ALLOWED_AUDIO_HOSTS.some(h => parsed.hostname === h || parsed.hostname.endsWith(`.${h}`));
  } catch {
    return false;
  }
}

// TTS generation endpoint - Chatterbox Turbo via Replicate (voice cloning)
const ttsPayloadSchema = z.object({
  text: z.string().min(1).max(50000),
  voice: z.string().optional().default('default'), // For Chatterbox: use voice cloning or default
  provider: z.literal('chatterbox').optional().default('chatterbox'),
  title: z.string().optional(),
  // Chatterbox-specific options
  exaggeration: z.number().min(0).max(1).optional().default(0.3), // Emotion intensity (0.3 = natural voice)
  audioUrl: z.string().optional()  // URL to voice sample for cloning (validated below)
    .refine(val => !val || validateAudioUrl(val), {
      message: 'audioUrl must be HTTPS from a trusted domain',
    }),
  spokenIntro: z.string().optional(),
  includeIntro: z.boolean().optional().default(true),
});

// NOTE: Text chunking and WAV concatenation logic now imported from shared audioProcessing module
// To adjust chunking or crossfade behavior, edit: src/services/audioProcessing.ts

// Helper: Convert WAV buffer to MP3 (required for iOS data URI playback)
function wavToCompressed(wavBuffer: Buffer): { buffer: Buffer; format: 'mp3'; mime: 'audio/mpeg' } {
  const nonce = `${Date.now()}_${Math.random().toString(16).slice(2)}`;
  const tmpWav = `/tmp/tts_${nonce}.wav`;
  const tmpMp3 = `/tmp/tts_${nonce}.mp3`;

  const cleanup = () => {
    try { fs.unlinkSync(tmpWav); } catch { }
    try { fs.unlinkSync(tmpMp3); } catch { }
  };

  try {
    fs.writeFileSync(tmpWav, wavBuffer);
    execSync(`ffmpeg -y -i "${tmpWav}" -codec:a libmp3lame -b:a 128k "${tmpMp3}" 2>/dev/null`);
    const mp3Buffer = fs.readFileSync(tmpMp3);
    logger.info(`WAV->MP3: ${Math.round(wavBuffer.length / 1024)}KB -> ${Math.round(mp3Buffer.length / 1024)}KB`);
    return { buffer: mp3Buffer, format: 'mp3', mime: 'audio/mpeg' };
  } finally {
    cleanup();
  }
}

router.post('/generate-tts', requireAuth, async (c) => {
  const parsed = ttsPayloadSchema.parse(await c.req.json());
  const { env } = await import('../config/env');
  const Replicate = (await import('replicate')).default;

  logger.info(`TTS request (${parsed.provider}): ${parsed.text.substring(0, 100)}... (${parsed.text.length} chars)`);

  // CHATTERBOX via Replicate (resemble-ai/chatterbox-turbo)
  if (parsed.provider === 'chatterbox') {
    // Get Replicate API token from Supabase api_keys table (with env fallback)
    let replicateToken = await apiKeys.replicate().catch(() => null) || env.REPLICATE_API_TOKEN;
    if (!replicateToken) {
      // Forced refresh: avoid stale negative cache after transient Supabase/API hiccups.
      clearApiKeyCache('replicate');
      replicateToken = await apiKeys.replicate().catch(() => null) || env.REPLICATE_API_TOKEN;
    }

    if (!replicateToken) {
      return c.json({
        success: false,
        message: 'Replicate API token not found (check Supabase api_keys table or REPLICATE_API_TOKEN env var)',
      }, 500);
    }

    try {
      logger.info('Generating audio with Chatterbox Turbo via Replicate...');
      const replicate = new Replicate({ auth: replicateToken });

      const generatedOn = new Date().toLocaleDateString('en-GB', {
        day: '2-digit',
        month: 'long',
        year: 'numeric',
      });
      const defaultIntro = parsed.title
        ? `This is an audio reading titled ${parsed.title}. Generated on ${generatedOn} by 1 in a billion app, powered by forbidden-yoga dot com.`
        : `This is an audio reading generated on ${generatedOn} by 1 in a billion app, powered by forbidden-yoga dot com.`;

      let cleaned = cleanupTextForTTS(parsed.text);
      cleaned = await phoneticizeTextForTTS(cleaned, 'en');
      const dedup = dedupeAdjacentSentences(cleaned);
      let narrationText = dedup.text;
      if (dedup.removed > 0) {
        logger.warn(`[AudioRoute] Removed ${dedup.removed} adjacent duplicate sentence(s) before TTS.`);
      }

      if (parsed.includeIntro !== false) {
        const spokenIntro = String(parsed.spokenIntro || defaultIntro).trim();
        narrationText = `${spokenIntro}\n\n${narrationText}`.trim();
      }

      const textLength = narrationText.length;
      const configuredChunkSize = parseInt(process.env.CHATTERBOX_CHUNK_SIZE || String(AUDIO_CONFIG.CHUNK_MAX_LENGTH), 10);
      const chunkSize = Math.max(120, Math.min(300, Number.isFinite(configuredChunkSize) ? configuredChunkSize : AUDIO_CONFIG.CHUNK_MAX_LENGTH));
      if (chunkSize !== configuredChunkSize) {
        logger.warn(`[AudioRoute] Clamped CHATTERBOX_CHUNK_SIZE ${configuredChunkSize} -> ${chunkSize}.`);
      }
      let chunks = splitIntoChunks(narrationText, chunkSize);
      const boundaryDedup = dedupeChunkBoundaryOverlap(chunks);
      chunks = boundaryDedup.chunks;
      if (boundaryDedup.removed > 0) {
        logger.warn(`[AudioRoute] Removed ${boundaryDedup.removed} duplicated boundary sentence(s) across chunks.`);
      }
      logger.info(`Chunking ${textLength} chars into ${chunks.length} pieces (max ${chunkSize} chars/chunk)`);

      // Voice sample for cloning (default narrator)
      const voiceSampleUrl = parsed.audioUrl || 'https://qdfikbgwuauertfmkmzk.supabase.co/storage/v1/object/public/voices/david.wav';
      const repetitionPenaltyRaw = Number(process.env.CHATTERBOX_REPETITION_PENALTY || '1.7');
      const repetitionPenalty = Number.isFinite(repetitionPenaltyRaw)
        ? Math.max(1, Math.min(2, repetitionPenaltyRaw))
        : 1.7;

      // Replicate chunk generator
      const routeChunkMaxRetries = Math.max(1, parseInt(process.env.REPLICATE_CHUNK_MAX_RETRIES || '6', 10));
      const generateChunk = async (chunk: string, index: number, maxRetries = routeChunkMaxRetries): Promise<Buffer> => {
        for (let attempt = 1; attempt <= maxRetries; attempt++) {
          try {
            logger.info(`[Replicate] Chunk ${index + 1}/${chunks.length} (${chunk.length} chars) attempt ${attempt}`);

            // Build input for Replicate
            const input: any = {
              text: chunk,
              reference_audio: voiceSampleUrl,
              temperature: 0.7,
              top_p: 0.95,
              repetition_penalty: repetitionPenalty, // Reduces duplicate sentences
            };

            logger.info('[Replicate] Calling API with model: resemble-ai/chatterbox-turbo');
            const startTime = Date.now();

            // Call Replicate API with hard timeout to avoid hung chunks.
            const chunkTimeoutMs = parseInt(process.env.REPLICATE_CHUNK_TIMEOUT_MS || '120000', 10);
            const output = await runReplicateWithRateLimit(
              `audioRoute:chunk:${index + 1}`,
              () =>
                withTimeout(
                  replicate.run('resemble-ai/chatterbox-turbo', { input }),
                  chunkTimeoutMs,
                  `Replicate chunk ${index + 1}`
                )
            );

            const elapsed = ((Date.now() - startTime) / 1000).toFixed(2);
            logger.info(`[Replicate] API call completed in ${elapsed}s`);

            // Handle different output types (stream, URL, buffer)
            let audioBuffer: Buffer;
            if (output instanceof ReadableStream || (output as any).getReader) {
              logger.info('[Replicate] Processing as ReadableStream...');
              const reader = (output as ReadableStream).getReader();
              const streamChunks: Uint8Array[] = [];
              while (true) {
                const { done, value } = await reader.read();
                if (done) break;
                streamChunks.push(value);
              }
              audioBuffer = Buffer.concat(streamChunks);
              logger.info(`[Replicate] Stream processed: ${streamChunks.length} chunks, ${audioBuffer.length} bytes`);
            } else if (typeof output === 'string') {
              logger.info(`[Replicate] Processing as URL: ${(output as string).substring(0, 60)}...`);
              const response = await axios.get(output, { responseType: 'arraybuffer' });
              audioBuffer = Buffer.from(response.data);
              logger.info(`[Replicate] URL fetched: ${audioBuffer.length} bytes`);
            } else if (Buffer.isBuffer(output)) {
              logger.info(`[Replicate] Direct buffer received: ${output.length} bytes`);
              audioBuffer = output;
            } else {
              logger.warn('[Replicate] Unknown output type, attempting conversion...');
              const data = await (output as any).arrayBuffer?.() || output;
              audioBuffer = Buffer.from(data);
              logger.info(`[Replicate] Converted to buffer: ${audioBuffer.length} bytes`);
            }

            logger.info(`[Replicate] Chunk ${index + 1} completed: ${audioBuffer.length} bytes`);
            return audioBuffer;

          } catch (error: any) {
            const is429 = isReplicateRateLimitError(error);
            const isAuthError = error.message?.includes('401') || error.message?.includes('authentication') || error.message?.includes('Unauthorized');
            const isBadRequest = error.message?.includes('400') || error.message?.includes('422') || error.message?.includes('invalid');

            logger.error(`[Replicate] Chunk ${index + 1} attempt ${attempt} failed: ${error.message}`);

            // ABORT IMMEDIATELY on auth or bad request errors (no retry)
            if (isAuthError || isBadRequest) {
              throw new Error(`Replicate error: ${error.message}`);
            }

            if (attempt < maxRetries) {
              const retryAfter = is429 ? 12 : attempt * 3;
              logger.info(`Retrying in ${retryAfter}s...${is429 ? ' (rate limited)' : ''}`);
              await new Promise(r => setTimeout(r, retryAfter * 1000));
            } else {
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
      let audioBuffers: Buffer[] = [];
      const parallelMode = String(process.env.AUDIO_ROUTE_PARALLEL || 'true').toLowerCase() === 'true';
      const parallelLimit = Math.max(1, parseInt(process.env.AUDIO_ROUTE_CONCURRENCY || '2', 10));

      if (parallelMode) {
        const pLimit = (await import('p-limit')).default;
        const limiter = pLimit(parallelLimit);
        logger.info(`Starting PARALLEL chunk scheduling for ${chunks.length} chunks (limit ${parallelLimit}); shared limiter enforces Replicate pacing...`);
        const results = await Promise.all(
          chunks.map((chunk, i) =>
            limiter(async () => {
              const buffer = await generateChunk(chunk, i);
              return { i, buffer };
            })
          )
        );
        results.sort((a, b) => a.i - b.i);
        audioBuffers = results.map((r) => r.buffer);
      } else {
        // SEQUENTIAL MODE - safer for strict rate limits
        logger.info(`Starting SEQUENTIAL Replicate generation of ${chunks.length} chunks (${chunkDelayMs}ms delay)...`);
        for (let i = 0; i < chunks.length; i++) {
          try {
            const buffer = await generateChunk(chunks[i]!, i);
            audioBuffers.push(buffer);

            // Add delay between chunks to respect rate limits (except for last chunk)
            if (i < chunks.length - 1 && chunkDelayMs > 0) {
              logger.info(`Waiting ${chunkDelayMs}ms before next chunk...`);
              await new Promise(r => setTimeout(r, chunkDelayMs));
            }
          } catch (err: any) {
            logger.error(`Chunk ${i + 1} failed permanently: ${err.message}`);
            throw err;
          }
        }
      }

      const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
      logger.info(`All ${chunks.length} chunks completed in ${elapsed}s`);

      // Concatenate all chunks into WAV
      const wavAudio = concatenateWavBuffers(audioBuffers);

      // Convert to M4A (primary format only)
      const { buffer: compressedAudio, format, mime } = wavToCompressed(wavAudio);
      const base64Audio = compressedAudio.toString('base64');

      logger.info(`Final audio: ${Math.round(compressedAudio.length / 1024)}KB ${format.toUpperCase()} from ${audioBuffers.length} chunks`);

      // Calculate duration from actual WAV header (sample rate may vary)
      let estimatedDuration: number;
      try {
        const fmt = getWavFormat(wavAudio);
        const bytesPerSec = fmt.sampleRate * fmt.numChannels * (fmt.bitsPerSample / 8);
        estimatedDuration = Math.ceil((wavAudio.length - 44) / bytesPerSec);
      } catch {
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

    } catch (error: any) {
      logger.error('Replicate Chatterbox error', { detail: error.response?.data || error.message });
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
router.post('/generate-tts-stream', requireAuth, async (c) => {
  const parsed = ttsPayloadSchema.parse(await c.req.json());

  // SINGLE SOURCE OF TRUTH: Supabase api_keys table
  let runpodApiKey: string;
  let runpodEndpointId: string;
  try {
    runpodApiKey = await apiKeys.runpod();
    runpodEndpointId = await apiKeys.runpodEndpoint();
  } catch (err) {
    return c.json({ success: false, message: 'RunPod not configured' }, 500);
  }

  const textLength = parsed.text.length;
  const chunkSize = parseInt(process.env.CHATTERBOX_CHUNK_SIZE || String(AUDIO_CONFIG.CHUNK_MAX_LENGTH), 10);
  const chunks = splitIntoChunks(parsed.text, chunkSize);
  const voiceSampleUrl = parsed.audioUrl || 'https://qdfikbgwuauertfmkmzk.supabase.co/storage/v1/object/public/voices/david.wav';

  logger.info(`STREAMING TTS: ${textLength} chars -> ${chunks.length} chunks (max ${chunkSize} chars/chunk)`);

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
      const generateChunk = async (chunk: string, index: number): Promise<{ index: number; audio: string } | null> => {
        for (let attempt = 1; attempt <= 3; attempt++) {
          try {
            const response = await axios.post(
              `https://api.runpod.ai/v2/${runpodEndpointId}/runsync`,
              {
                input: {
                  text: chunk,
                  audio_url: voiceSampleUrl,
                  exaggeration: parsed.exaggeration || 0.3,
                  cfg_weight: 0.5,
                }
              },
              {
                headers: {
                  'Authorization': `Bearer ${runpodApiKey}`,
                  'Content-Type': 'application/json',
                },
                timeout: 180000,
              }
            );

            const audio = response.data?.output?.audio_base64;
            if (audio) {
              logger.info(`Chunk ${index + 1}/${chunks.length} ready`);
              return { index, audio };
            }
          } catch (e: any) {
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
      const completed = new Map<number, string>();
      const failed = new Set<number>();
      let nextToSend = 0;

      // Process as they complete
      for (const promise of promises) {
        const result = await promise;
        if (result) {
          completed.set(result.index, result.audio);
        } else {
          // Find the index of the failed chunk (first pending one not in completed or failed)
          for (let i = 0; i < chunks.length; i++) {
            if (!completed.has(i) && !failed.has(i)) {
              failed.add(i);
              logger.error(`Streaming TTS: Chunk ${i + 1}/${chunks.length} failed after all retries`);
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
            const audio = completed.get(nextToSend)!;
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
const hookAudioSchema = z.object({
  userId: z.string().uuid(),
  type: z.enum(['sun', 'moon', 'rising']),
  text: z.string().min(1),
  language: z.string().default('en'),
  personId: z.string().optional(), // Optional: for partner/3rd-person audio (separate storage path)
  exaggeration: z.number().min(0).max(1).optional().default(0.3),
  audioUrl: z.string().optional()  // Voice sample URL (validated for SSRF)
    .refine(val => !val || validateAudioUrl(val), {
      message: 'audioUrl must be HTTPS from a trusted domain',
    }),
});

router.post('/hook-audio/generate', requireAuth, async (c) => {
  try {
    const parsed = hookAudioSchema.parse(await c.req.json());
    const { supabase } = await import('../services/supabaseClient');
    const { generateMinimaxAsync, getMinimaxSequenceForUrl } = await import('../services/minimaxTts');

    if (!supabase) {
      return c.json({ success: false, error: 'Supabase not configured' }, 500);
    }

    // Use authenticated userId from JWT token instead of request body
    const userId = c.get('userId');
    const language = parsed.language || 'en';
    logger.info(`Hook audio generation (MiniMax): ${parsed.type} for user ${userId} (${parsed.text.length} chars, lang=${language})`);

    // Clean text for TTS pronunciation
    let cleanedText = cleanupTextForTTS(parsed.text, language);
    cleanedText = await phoneticizeTextForTTS(cleanedText, language);
    logger.info(`Cleaned text: ${cleanedText.length} chars`);

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
        logger.info(`Using registered David clone: ${minimaxVoiceId}`);
      }
    } catch (e: any) {
      logger.warn('[HookAudio] Could not look up David clone ID', { error: e.message });
    }

    // If no registered clone, upload reference audio for inline cloning
    let clonePromptFileId: string | undefined;
    if (!hasRegisteredClone) {
      try {
        const DAVID_CLONE_URL = 'https://qdfikbgwuauertfmkmzk.supabase.co/storage/v1/object/public/voices/david_clone.wav';
        clonePromptFileId = await getMinimaxSequenceForUrl(DAVID_CLONE_URL, 'david_clone.wav');
        logger.info(`Using inline clone_prompt for David: ${clonePromptFileId}`);
      } catch (e: any) {
        logger.warn('[HookAudio] Could not upload David clone reference', { error: e.message });
      }
    }

    // Generate audio via MiniMax (hook readings are ~600 chars, well within limit)
    // MiniMax returns MP3 directly — no WAV concatenation or conversion needed
    const mp3Buffer = await generateMinimaxAsync(
      cleanedText,
      minimaxVoiceId,
      clonePromptFileId,
      1.0,   // speed
      1.0,   // volume
      language
    );

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
      logger.error('Failed to upload hook audio', { error: uploadError.message });
      return c.json({
        success: false,
        error: `Storage upload failed: ${uploadError.message}`,
      }, 500);
    }

    // Get signed URL (library is a private bucket — public URLs return 400)
    let audioUrl: string;
    const { data: signedData, error: signedError } = await supabase.storage
      .from('library')
      .createSignedUrl(storagePath, 60 * 60 * 24); // 24 hours

    if (signedData?.signedUrl) {
      audioUrl = signedData.signedUrl;
    } else {
      logger.warn('Signed URL failed, falling back to public URL', { error: signedError?.message });
      const { data: urlData } = supabase.storage
        .from('library')
        .getPublicUrl(storagePath);
      audioUrl = urlData.publicUrl;
    }

    logger.info(`Hook audio stored: ${storagePath} (${Math.round(mp3Buffer.length / 1024)}KB, ~${estimatedDuration}s)`);

    return c.json({
      success: true,
      audioUrl,
      storagePath,
      durationSeconds: estimatedDuration,
      format: 'mp3',
      sizeBytes: mp3Buffer.length,
    });

  } catch (error: any) {
    logger.error('Hook audio generation error', { error: error?.message || String(error) });
    return c.json({
      success: false,
      error: error.message || 'Hook audio generation failed',
    }, 500);
  }
});

export const audioRouter = router;
