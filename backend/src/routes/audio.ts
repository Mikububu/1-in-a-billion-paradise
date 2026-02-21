import { Hono } from 'hono';
import { z } from 'zod';
import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import axios from 'axios';
import { execSync } from 'child_process';
import { audioService } from '../services/audioService';
import { clearApiKeyCache } from '../services/apiKeys';
import { apiKeys } from '../services/apiKeysHelper';
import { cleanupTextForTTS } from '../utils/textCleanup';
import {
  splitIntoChunks,
  concatenateWavBuffers,
  AUDIO_CONFIG,
  dedupeAdjacentSentences,
  dedupeChunkBoundaryOverlap,
} from '../services/audioProcessing';

const router = new Hono();

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

// Google TTS JWT token generation
async function getGoogleAccessToken(): Promise<string> {
  const credentialsPath = path.join(process.cwd(), 'google-tts-credentials.json');

  if (!fs.existsSync(credentialsPath)) {
    throw new Error('Google TTS credentials file not found');
  }

  const credentials = JSON.parse(fs.readFileSync(credentialsPath, 'utf8'));

  // Create JWT header and claim
  const header = { alg: 'RS256', typ: 'JWT' };
  const now = Math.floor(Date.now() / 1000);
  const claim = {
    iss: credentials.client_email,
    scope: 'https://www.googleapis.com/auth/cloud-platform',
    aud: 'https://oauth2.googleapis.com/token',
    iat: now,
    exp: now + 3600,
  };

  // Base64URL encode
  const base64url = (obj: object) =>
    Buffer.from(JSON.stringify(obj)).toString('base64url');

  const unsignedToken = `${base64url(header)}.${base64url(claim)}`;

  // Sign with private key
  const sign = crypto.createSign('RSA-SHA256');
  sign.update(unsignedToken);
  const signature = sign.sign(credentials.private_key, 'base64url');

  const jwt = `${unsignedToken}.${signature}`;

  // Exchange JWT for access token
  const tokenResponse = await axios.post(
    'https://oauth2.googleapis.com/token',
    `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${jwt}`,
    {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      timeout: 30000,
    }
  );

  return tokenResponse.data.access_token;
}

// TTS generation endpoint - Chatterbox Turbo via Replicate (voice cloning)
const ttsPayloadSchema = z.object({
  text: z.string().min(1).max(50000),
  voice: z.string().optional().default('default'), // For Chatterbox: use voice cloning or default
  provider: z.enum(['chatterbox']).optional().default('chatterbox'),
  title: z.string().optional(),
  // Chatterbox-specific options
  exaggeration: z.number().min(0).max(1).optional().default(0.3), // Emotion intensity (0.3 = natural voice)
  audioUrl: z.string().optional(), // URL to voice sample for cloning
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
    console.log(`WAV->MP3: ${Math.round(wavBuffer.length / 1024)}KB -> ${Math.round(mp3Buffer.length / 1024)}KB`);
    return { buffer: mp3Buffer, format: 'mp3', mime: 'audio/mpeg' };
  } finally {
    cleanup();
  }
}

router.post('/generate-tts', async (c) => {
  const parsed = ttsPayloadSchema.parse(await c.req.json());
  const { env } = await import('../config/env');
  const Replicate = (await import('replicate')).default;

  console.log(`TTS request (${parsed.provider}): ${parsed.text.substring(0, 100)}... (${parsed.text.length} chars)`);

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
      console.log('🎵 Generating audio with Chatterbox Turbo via Replicate...');
      const replicate = new Replicate({ auth: replicateToken });

      const generatedOn = new Date().toLocaleDateString('en-GB', {
        day: '2-digit',
        month: 'long',
        year: 'numeric',
      });
      const defaultIntro = parsed.title
        ? `This is an audio reading titled ${parsed.title}. Generated on ${generatedOn} by 1 in a billion app, powered by forbidden-yoga dot com.`
        : `This is an audio reading generated on ${generatedOn} by 1 in a billion app, powered by forbidden-yoga dot com.`;

      const cleaned = cleanupTextForTTS(parsed.text);
      const dedup = dedupeAdjacentSentences(cleaned);
      let narrationText = dedup.text;
      if (dedup.removed > 0) {
        console.warn(`⚠️ [AudioRoute] Removed ${dedup.removed} adjacent duplicate sentence(s) before TTS.`);
      }

      if (parsed.includeIntro !== false) {
        const spokenIntro = String(parsed.spokenIntro || defaultIntro).trim();
        narrationText = `${spokenIntro}\n\n${narrationText}`.trim();
      }

      const textLength = narrationText.length;
      const configuredChunkSize = parseInt(process.env.CHATTERBOX_CHUNK_SIZE || String(AUDIO_CONFIG.CHUNK_MAX_LENGTH), 10);
      const chunkSize = Math.max(120, Math.min(300, Number.isFinite(configuredChunkSize) ? configuredChunkSize : AUDIO_CONFIG.CHUNK_MAX_LENGTH));
      if (chunkSize !== configuredChunkSize) {
        console.warn(`⚠️ [AudioRoute] Clamped CHATTERBOX_CHUNK_SIZE ${configuredChunkSize} -> ${chunkSize}.`);
      }
      let chunks = splitIntoChunks(narrationText, chunkSize);
      const boundaryDedup = dedupeChunkBoundaryOverlap(chunks);
      chunks = boundaryDedup.chunks;
      if (boundaryDedup.removed > 0) {
        console.warn(`⚠️ [AudioRoute] Removed ${boundaryDedup.removed} duplicated boundary sentence(s) across chunks.`);
      }
      console.log(`📦 Chunking ${textLength} chars into ${chunks.length} pieces (max ${chunkSize} chars/chunk)`);

      // Voice sample for cloning (default narrator)
      const voiceSampleUrl = parsed.audioUrl || 'https://qdfikbgwuauertfmkmzk.supabase.co/storage/v1/object/public/voices/david.wav';
      const repetitionPenaltyRaw = Number(process.env.CHATTERBOX_REPETITION_PENALTY || '1.7');
      const repetitionPenalty = Number.isFinite(repetitionPenaltyRaw)
        ? Math.max(1, Math.min(2, repetitionPenaltyRaw))
        : 1.7;

      // Replicate chunk generator
      const generateChunk = async (chunk: string, index: number, maxRetries = 5): Promise<Buffer> => {
        for (let attempt = 1; attempt <= maxRetries; attempt++) {
          try {
            console.log(`  [Replicate] Chunk ${index + 1}/${chunks.length} (${chunk.length} chars) attempt ${attempt}`);

            // Build input for Replicate
            const input: any = {
              text: chunk,
              reference_audio: voiceSampleUrl,
              temperature: 0.7,
              top_p: 0.95,
              repetition_penalty: repetitionPenalty, // Reduces duplicate sentences
            };

            console.log(`  🎯 [Replicate] Calling API with model: resemble-ai/chatterbox-turbo`);
            const startTime = Date.now();

            // Call Replicate API with hard timeout to avoid hung chunks.
            const chunkTimeoutMs = parseInt(process.env.REPLICATE_CHUNK_TIMEOUT_MS || '120000', 10);
            const output = await withTimeout(
              replicate.run('resemble-ai/chatterbox-turbo', { input }),
              chunkTimeoutMs,
              `Replicate chunk ${index + 1}`
            );

            const elapsed = ((Date.now() - startTime) / 1000).toFixed(2);
            console.log(`  ⏱️  [Replicate] API call completed in ${elapsed}s`);

            // Handle different output types (stream, URL, buffer)
            let audioBuffer: Buffer;
            if (output instanceof ReadableStream || (output as any).getReader) {
              console.log(`  🌊 [Replicate] Processing as ReadableStream...`);
              const reader = (output as ReadableStream).getReader();
              const streamChunks: Uint8Array[] = [];
              while (true) {
                const { done, value } = await reader.read();
                if (done) break;
                streamChunks.push(value);
              }
              audioBuffer = Buffer.concat(streamChunks);
              console.log(`  ✅ [Replicate] Stream processed: ${streamChunks.length} chunks, ${audioBuffer.length} bytes`);
            } else if (typeof output === 'string') {
              console.log(`  🔗 [Replicate] Processing as URL: ${(output as string).substring(0, 60)}...`);
              const response = await axios.get(output, { responseType: 'arraybuffer' });
              audioBuffer = Buffer.from(response.data);
              console.log(`  ✅ [Replicate] URL fetched: ${audioBuffer.length} bytes`);
            } else if (Buffer.isBuffer(output)) {
              console.log(`  📦 [Replicate] Direct buffer received: ${output.length} bytes`);
              audioBuffer = output;
            } else {
              console.log(`  ⚠️  [Replicate] Unknown output type, attempting conversion...`);
              const data = await (output as any).arrayBuffer?.() || output;
              audioBuffer = Buffer.from(data);
              console.log(`  ✅ [Replicate] Converted to buffer: ${audioBuffer.length} bytes`);
            }

            console.log(`  ✅ [Replicate] Chunk ${index + 1} completed: ${audioBuffer.length} bytes`);
            return audioBuffer;

          } catch (error: any) {
            const is429 = error.message?.includes('429') || error.message?.includes('throttled') || error.message?.includes('rate limit');
            const isAuthError = error.message?.includes('401') || error.message?.includes('authentication') || error.message?.includes('Unauthorized');
            const isBadRequest = error.message?.includes('400') || error.message?.includes('422') || error.message?.includes('invalid');

            console.error(`  ❌ [Replicate] Chunk ${index + 1} attempt ${attempt} failed: ${error.message}`);

            // ABORT IMMEDIATELY on auth or bad request errors (no retry)
            if (isAuthError || isBadRequest) {
              throw new Error(`Replicate error: ${error.message}`);
            }

            if (attempt < maxRetries) {
              const retryAfter = is429 ? 12 : attempt * 3;
              console.log(`  ⏳ Retrying in ${retryAfter}s...${is429 ? ' (rate limited)' : ''}`);
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
      const chunkDelayMs = parseInt(process.env.REPLICATE_CHUNK_DELAY_MS || '2000', 10);
      
      const startTime = Date.now();
      let audioBuffers: Buffer[] = [];
      const parallelMode = String(process.env.AUDIO_ROUTE_PARALLEL || '').toLowerCase() === 'true';
      const parallelLimit = Math.max(1, parseInt(process.env.AUDIO_ROUTE_CONCURRENCY || '2', 10));

      if (parallelMode) {
        const pLimit = (await import('p-limit')).default;
        const limiter = pLimit(parallelLimit);
        console.log(`🚀 Starting PARALLEL Replicate generation of ${chunks.length} chunks (limit ${parallelLimit})...`);
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
        console.log(`🚀 Starting SEQUENTIAL Replicate generation of ${chunks.length} chunks (${chunkDelayMs}ms delay)...`);
        for (let i = 0; i < chunks.length; i++) {
          try {
            const buffer = await generateChunk(chunks[i]!, i);
            audioBuffers.push(buffer);

            // Add delay between chunks to respect rate limits (except for last chunk)
            if (i < chunks.length - 1 && chunkDelayMs > 0) {
              console.log(`  ⏳ Waiting ${chunkDelayMs}ms before next chunk...`);
              await new Promise(r => setTimeout(r, chunkDelayMs));
            }
          } catch (err: any) {
            console.error(`❌ Chunk ${i + 1} failed permanently: ${err.message}`);
            throw err;
          }
        }
      }

      const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
      console.log(`✅ All ${chunks.length} chunks completed in ${elapsed}s (Replicate sequential)!`);

      // Concatenate all chunks into WAV
      const wavAudio = concatenateWavBuffers(audioBuffers);

      // Convert to M4A (primary format only)
      const { buffer: compressedAudio, format, mime } = wavToCompressed(wavAudio);
      const base64Audio = compressedAudio.toString('base64');

      console.log(`Final audio: ${Math.round(compressedAudio.length / 1024)}KB ${format.toUpperCase()} from ${audioBuffers.length} chunks`);

      // Estimate duration from original WAV (24000Hz, 16-bit mono = 48000 bytes/sec)
      const estimatedDuration = Math.ceil((wavAudio.length - 44) / 48000);

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
      console.error('Replicate Chatterbox error:', error.response?.data || error.message);
      return c.json({
        success: false,
        message: `Chatterbox (Replicate) failed: ${error.message}`,
        error: error.response?.data || error.message,
      }, 500);
    }
  }

  // GOOGLE TTS (only if explicitly requested - NOT as fallback)
  if (parsed.provider === 'google') {
    try {
      console.log('Attempting Google TTS...');
      const accessToken = await getGoogleAccessToken();

      // Google TTS voices - Chirp 3 HD voices (highest quality)
      const googleVoices: Record<string, { name: string; languageCode: string }> = {
        // Chirp 3 HD Voices (best quality)
        'Zubenelgenubi': { name: 'en-US-Chirp3-HD-Zubenelgenubi', languageCode: 'en-US' }, // Male - DEFAULT
        'Achernar': { name: 'en-US-Chirp3-HD-Achernar', languageCode: 'en-US' }, // Female
        'Gacrux': { name: 'en-US-Chirp3-HD-Gacrux', languageCode: 'en-US' }, // Male
        'Leda': { name: 'en-US-Chirp3-HD-Leda', languageCode: 'en-US' }, // Female
        'Orus': { name: 'en-US-Chirp3-HD-Orus', languageCode: 'en-US' }, // Male
        'Zephyr': { name: 'en-US-Chirp3-HD-Zephyr', languageCode: 'en-US' }, // Female
        // Neural2 fallbacks
        'en-US-Neural2-F': { name: 'en-US-Neural2-F', languageCode: 'en-US' },
        'en-US-Neural2-D': { name: 'en-US-Neural2-D', languageCode: 'en-US' },
      };

      const voiceConfig = googleVoices[parsed.voice] || googleVoices['Zubenelgenubi']!;

      const response = await axios.post(
        'https://texttospeech.googleapis.com/v1/text:synthesize',
        {
          input: { text: parsed.text },
          voice: {
            languageCode: voiceConfig!.languageCode,
            name: voiceConfig!.name,
          },
          audioConfig: {
            audioEncoding: 'MP3',
            speakingRate: 0.9, // Slightly slower for clarity
            pitch: 0,
            sampleRateHertz: 44100, // High quality
          },
        },
        {
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
          timeout: 60000, // 60 second timeout for long texts
        }
      );

      const base64Audio = response.data.audioContent;

      // Estimate duration (roughly 150 words per minute, 5 chars per word)
      const estimatedDuration = Math.ceil(parsed.text.length / 750 * 60);

      return c.json({
        success: true,
        message: 'Audio generated successfully (Google TTS)',
        audioBase64: base64Audio,
        audioUrl: `data:audio/mpeg;base64,${base64Audio}`,
        durationSeconds: estimatedDuration,
        format: 'mp3',
        provider: 'google',
      });
    } catch (error) {
      console.error('Google TTS error:', error);
      return c.json({
        success: false,
        message: `Google TTS error: ${String(error)}`,
        audioUrl: null,
        durationSeconds: 0,
      });
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
router.post('/generate-tts-stream', async (c) => {
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

  console.log(`🌊 STREAMING TTS: ${textLength} chars -> ${chunks.length} chunks (max ${chunkSize} chars/chunk)`);

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
              console.log(`✅ Chunk ${index + 1}/${chunks.length} ready`);
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
      let nextToSend = 0;

      // Process as they complete
      for (const promise of promises) {
        const result = await promise;
        if (result) {
          completed.set(result.index, result.audio);

          // Send any consecutive completed chunks
          while (completed.has(nextToSend)) {
            const audio = completed.get(nextToSend)!;
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({
              type: 'chunk',
              index: nextToSend,
              audio: audio,
              progress: Math.round(((nextToSend + 1) / chunks.length) * 100)
            })}\n\n`));
            completed.delete(nextToSend);
            nextToSend++;
          }
        }
      }

      // Send completion
      controller.enqueue(encoder.encode(`data: ${JSON.stringify({
        type: 'complete',
        totalChunks: chunks.length
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
  text: z.string().min(1).max(50000),
  userId: z.string().uuid().optional(), // Optional: if not provided, use temp storage
  type: z.enum(['sun', 'moon', 'rising']),
  exaggeration: z.number().min(0).max(1).optional().default(0.3),
  audioUrl: z.string().optional(), // Voice sample URL
});

router.post('/hook-audio/generate', async (c) => {
  try {
    const parsed = hookAudioSchema.parse(await c.req.json());
    const { supabase } = await import('../services/supabaseClient');

    if (!supabase) {
      return c.json({ success: false, error: 'Supabase not configured' }, 500);
    }

    // Use userId if provided, otherwise use temp storage (for pre-signup hook audio)
    const userId = parsed.userId || 'temp';
    console.log(`🎤 Hook audio generation: ${parsed.type} for user ${userId} (${parsed.text.length} chars)`);

    // SINGLE SOURCE OF TRUTH: Supabase api_keys table
    // This ensures endpoint ID changes (e.g., after RunPod restore) apply immediately
    let runpodApiKey: string;
    let runpodEndpointId: string;
    try {
      runpodApiKey = await apiKeys.runpod();
      runpodEndpointId = await apiKeys.runpodEndpoint();
    } catch (err) {
      return c.json({
        success: false,
        error: 'RunPod not configured (check Supabase api_keys table)',
      }, 500);
    }

    // Generate audio using same logic as /generate-tts
    const textLength = parsed.text.length;
    const chunkSize = parseInt(process.env.CHATTERBOX_CHUNK_SIZE || String(AUDIO_CONFIG.CHUNK_MAX_LENGTH), 10);
    const chunks = splitIntoChunks(parsed.text, chunkSize);
    console.log(`📦 Chunking ${textLength} chars into ${chunks.length} pieces`);

    const voiceSampleUrl = parsed.audioUrl || 'https://qdfikbgwuauertfmkmzk.supabase.co/storage/v1/object/public/voices/david.wav';

    // Generate chunks sequentially
    const audioBuffers: Buffer[] = [];
    for (let i = 0; i < chunks.length; i++) {
      const maxRetries = 3;
      for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
          const response = await axios.post(
            `https://api.runpod.ai/v2/${runpodEndpointId}/runsync`,
            {
              input: {
                text: chunks[i]!,
                audio_url: voiceSampleUrl,
                exaggeration: parsed.exaggeration,
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

          const output = response.data?.output;
          if (!output?.audio_base64) {
            throw new Error(`No audio_base64 in response for chunk ${i + 1}`);
          }

          audioBuffers.push(Buffer.from(output.audio_base64, 'base64'));
          break; // Success, move to next chunk
        } catch (error: any) {
          if (attempt < maxRetries) {
            const waitTime = attempt * 5000;
            console.log(`⚠️ Chunk ${i + 1} failed, retrying in ${waitTime / 1000}s...`);
            await new Promise(r => setTimeout(r, waitTime));
          } else {
            throw error;
          }
        }
      }
    }

    // Concatenate and compress
    const wavAudio = concatenateWavBuffers(audioBuffers);
    const { buffer: compressedAudio, format, mime } = wavToCompressed(wavAudio);
    const estimatedDuration = Math.ceil((wavAudio.length - 44) / 48000);

    // Store in Supabase Storage (library bucket, same as hookAudioCloud.ts)
    // Use temp/ prefix if no userId provided (will be moved to user folder after signup)
    const storagePath = parsed.userId 
      ? `hook-audio/${parsed.userId}/${parsed.type}.${format}`
      : `hook-audio/temp/${parsed.type}_${Date.now()}.${format}`;
    const contentType = 'audio/mp4';

    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('library')
      .upload(storagePath, compressedAudio, {
        contentType,
        upsert: true,
        cacheControl: '3600',
      });

    if (uploadError) {
      console.error('Failed to upload hook audio:', uploadError);
      return c.json({
        success: false,
        error: `Storage upload failed: ${uploadError.message}`,
      }, 500);
    }

    // Get public URL (or signed URL if bucket is private)
    const { data: urlData } = supabase.storage
      .from('library')
      .getPublicUrl(storagePath);

    const audioUrl = urlData.publicUrl;

    console.log(`✅ Hook audio stored: ${storagePath} (${Math.round(compressedAudio.length / 1024)}KB)`);

    return c.json({
      success: true,
      audioUrl,
      storagePath,
      durationSeconds: estimatedDuration,
      format,
      sizeBytes: compressedAudio.length,
    });

  } catch (error: any) {
    console.error('Hook audio generation error:', error);
    return c.json({
      success: false,
      error: error.message || 'Hook audio generation failed',
    }, 500);
  }
});

export const audioRouter = router;
