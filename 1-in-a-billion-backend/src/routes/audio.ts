import { Hono } from 'hono';
import { z } from 'zod';
import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import axios from 'axios';
import { execSync } from 'child_process';
import { audioService } from '../services/audioService';
import { getApiKey } from '../services/apiKeys';

const router = new Hono();

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

// TTS generation endpoint - Chatterbox via RunPod (voice cloning)
const ttsPayloadSchema = z.object({
  text: z.string().min(1).max(50000),
  voice: z.string().optional().default('default'), // For Chatterbox: use voice cloning or default
  provider: z.enum(['chatterbox']).optional().default('chatterbox'),
  title: z.string().optional(),
  // Chatterbox-specific options
  exaggeration: z.number().min(0).max(1).optional().default(0.3), // Emotion intensity (0.3 = natural voice)
  audioUrl: z.string().optional(), // URL to voice sample for cloning
});

// Helper: Split text into sentences for chunking
// TESTED: 350 chars still had truncation issues, reverting to 300 chars (original safe limit)
// This ensures no truncation but may have more chunk boundaries
// If a single sentence exceeds maxChunkLength, split it at word boundaries
function splitIntoChunks(text: string, maxChunkLength: number = 300): string[] {
  // Match sentences ending with punctuation, OR any remaining text at the end
  const sentenceRegex = /[^.!?]*[.!?]+|[^.!?]+$/g;
  const sentences = text.match(sentenceRegex) || [text];
  const chunks: string[] = [];
  let currentChunk = '';

  for (const sentence of sentences) {
    const trimmed = sentence.trim();
    if (!trimmed) continue; // Skip empty strings

    // If sentence fits, add it to current chunk
    if (currentChunk.length + trimmed.length + 1 < maxChunkLength) {
      currentChunk += (currentChunk ? ' ' : '') + trimmed;
    } else {
      // Current chunk is full, save it
      if (currentChunk) chunks.push(currentChunk);

      // If single sentence exceeds limit, split it at word boundaries
      if (trimmed.length > maxChunkLength) {
        const words = trimmed.split(/\s+/);
        let wordChunk = '';
        for (const word of words) {
          if (wordChunk.length + word.length + 1 < maxChunkLength) {
            wordChunk += (wordChunk ? ' ' : '') + word;
          } else {
            if (wordChunk) chunks.push(wordChunk);
            wordChunk = word;
          }
        }
        currentChunk = wordChunk;
      } else {
        currentChunk = trimmed;
      }
    }
  }
  if (currentChunk) chunks.push(currentChunk);

  // Safety: if somehow no chunks, return the original text
  if (chunks.length === 0) {
    return [text];
  }

  return chunks;
}

// Helper: Find the "data" chunk in a WAV file and return its offset and size
function findWavDataChunk(buffer: Buffer): { dataOffset: number; dataSize: number } {
  // WAV structure: RIFF header (12 bytes) + chunks
  // Each chunk: 4-byte ID + 4-byte size + data
  let offset = 12; // Skip RIFF header

  while (offset < buffer.length - 8) {
    const chunkId = buffer.toString('ascii', offset, offset + 4);
    const chunkSize = buffer.readUInt32LE(offset + 4);

    if (chunkId === 'data') {
      return { dataOffset: offset + 8, dataSize: chunkSize };
    }

    // Move to next chunk (8 bytes header + chunk data, aligned to 2 bytes)
    offset += 8 + chunkSize;
    if (chunkSize % 2 !== 0) offset++; // Padding byte
  }

  throw new Error('No data chunk found in WAV file');
}

// Helper: Detect WAV format (16-bit PCM vs IEEE Float)
function getWavFormat(buffer: Buffer): { audioFormat: number; numChannels: number; sampleRate: number; bitsPerSample: number } {
  // Find fmt chunk
  let offset = 12;
  while (offset < buffer.length - 8) {
    const chunkId = buffer.toString('ascii', offset, offset + 4);
    const chunkSize = buffer.readUInt32LE(offset + 4);

    if (chunkId === 'fmt ') {
      return {
        audioFormat: buffer.readUInt16LE(offset + 8),     // 1 = PCM, 3 = IEEE Float
        numChannels: buffer.readUInt16LE(offset + 10),
        sampleRate: buffer.readUInt32LE(offset + 12),
        bitsPerSample: buffer.readUInt16LE(offset + 22),
      };
    }

    offset += 8 + chunkSize;
    if (chunkSize % 2 !== 0) offset++;
  }

  throw new Error('No fmt chunk found in WAV');
}

// Helper: Convert IEEE Float WAV to 16-bit PCM WAV
function convertFloatWavToPcm(buffer: Buffer): Buffer {
  const format = getWavFormat(buffer);

  // If already 16-bit PCM, return as-is
  if (format.audioFormat === 1 && format.bitsPerSample === 16) {
    return buffer;
  }

  // If IEEE Float (format 3), convert to 16-bit PCM
  if (format.audioFormat === 3 && format.bitsPerSample === 32) {
    console.log('Converting IEEE Float WAV to 16-bit PCM...');

    const { dataOffset, dataSize } = findWavDataChunk(buffer);
    const numSamples = dataSize / 4; // 4 bytes per float32 sample

    // Read float samples and convert to int16
    const int16Data = Buffer.alloc(numSamples * 2);
    for (let i = 0; i < numSamples; i++) {
      const floatVal = buffer.readFloatLE(dataOffset + i * 4);
      // Clamp to [-1, 1] and convert to int16 range
      const clamped = Math.max(-1, Math.min(1, floatVal));
      const int16Val = Math.round(clamped * 32767);
      int16Data.writeInt16LE(int16Val, i * 2);
    }

    // Create new 16-bit PCM WAV
    const pcmWav = Buffer.alloc(44 + int16Data.length);
    pcmWav.write('RIFF', 0);
    pcmWav.writeUInt32LE(36 + int16Data.length, 4);
    pcmWav.write('WAVE', 8);
    pcmWav.write('fmt ', 12);
    pcmWav.writeUInt32LE(16, 16);                          // fmt chunk size
    pcmWav.writeUInt16LE(1, 20);                           // AudioFormat: 1 = PCM
    pcmWav.writeUInt16LE(format.numChannels, 22);          // NumChannels
    pcmWav.writeUInt32LE(format.sampleRate, 24);           // SampleRate
    pcmWav.writeUInt32LE(format.sampleRate * format.numChannels * 2, 28); // ByteRate
    pcmWav.writeUInt16LE(format.numChannels * 2, 32);      // BlockAlign
    pcmWav.writeUInt16LE(16, 34);                          // BitsPerSample
    pcmWav.write('data', 36);
    pcmWav.writeUInt32LE(int16Data.length, 40);
    int16Data.copy(pcmWav, 44);

    console.log(`Converted: ${buffer.length} bytes float -> ${pcmWav.length} bytes PCM`);
    return pcmWav;
  }

  console.log(`Unknown WAV format: ${format.audioFormat}, ${format.bitsPerSample}-bit`);
  return buffer; // Return as-is for unknown formats
}

// Helper: Concatenate WAV buffers (converts IEEE Float to 16-bit PCM if needed)
function concatenateWavBuffers(buffers: Buffer[]): Buffer {
  if (buffers.length === 0) return Buffer.alloc(0);
  if (buffers.length === 1) return convertFloatWavToPcm(buffers[0]!);

  // Convert and extract audio data from each buffer
  const audioDataChunks: Buffer[] = [];
  let totalDataSize = 0;

  for (let i = 0; i < buffers.length; i++) {
    const buf = buffers[i]!;
    // Convert IEEE Float to 16-bit PCM if needed
    const pcmBuf = convertFloatWavToPcm(buf);
    const { dataOffset, dataSize } = findWavDataChunk(pcmBuf);
    const audioData = pcmBuf.slice(dataOffset, dataOffset + dataSize);
    console.log(`Chunk ${i + 1} audio data: ${dataSize} bytes (offset: ${dataOffset}, total buffer: ${pcmBuf.length})`);
    audioDataChunks.push(audioData);
    totalDataSize += audioData.length;
  }

  // Create a simple WAV file with standard 44-byte header
  const result = Buffer.alloc(44 + totalDataSize);

  // Write WAV header
  result.write('RIFF', 0);
  result.writeUInt32LE(36 + totalDataSize, 4); // ChunkSize
  result.write('WAVE', 8);
  result.write('fmt ', 12);
  result.writeUInt32LE(16, 16); // Subchunk1Size (PCM)
  result.writeUInt16LE(1, 20); // AudioFormat (PCM)
  result.writeUInt16LE(1, 22); // NumChannels (mono)
  result.writeUInt32LE(24000, 24); // SampleRate
  result.writeUInt32LE(48000, 28); // ByteRate (24000 * 1 * 2)
  result.writeUInt16LE(2, 32); // BlockAlign (1 * 2)
  result.writeUInt16LE(16, 34); // BitsPerSample
  result.write('data', 36);
  result.writeUInt32LE(totalDataSize, 40); // Subchunk2Size

  // Copy all audio data with simple fade at boundaries to prevent clicks/pops
  // Simple approach: fade out last 30ms of previous chunk, fade in first 30ms of next chunk
  const sampleRate = 24000; // 24kHz
  const fadeMs = 30; // 30ms fade (shorter = less noticeable)
  const fadeSamples = Math.floor((sampleRate * fadeMs) / 1000); // ~720 samples
  const fadeBytes = fadeSamples * 2; // 16-bit = 2 bytes per sample

  let offset = 44;
  for (let i = 0; i < audioDataChunks.length; i++) {
    const chunk = audioDataChunks[i]!;

    if (i === 0) {
      // First chunk: copy as-is
      chunk.copy(result, offset);
      offset += chunk.length;
    } else {
      // Subsequent chunks: apply fade transitions
      const prevChunk = audioDataChunks[i - 1]!;

      if (chunk.length >= fadeBytes && prevChunk.length >= fadeBytes) {
        // Fade out last fadeBytes of previous chunk in result buffer
        const prevFadeStart = offset - fadeBytes;
        for (let j = 0; j < fadeBytes; j += 2) {
          const sampleIdx = prevFadeStart + j;
          if (sampleIdx >= 44 && sampleIdx + 1 < result.length) {
            const sample = result.readInt16LE(sampleIdx);
            const fadeOut = 1 - (j / fadeBytes); // 1.0 to 0.0
            result.writeInt16LE(Math.round(sample * fadeOut), sampleIdx);
          }
        }

        // Fade in first fadeBytes of current chunk
        const fadeInBuffer = Buffer.from(chunk); // Copy chunk
        for (let j = 0; j < fadeBytes && j + 1 < fadeInBuffer.length; j += 2) {
          const sample = fadeInBuffer.readInt16LE(j);
          const fadeIn = j / fadeBytes; // 0.0 to 1.0
          fadeInBuffer.writeInt16LE(Math.round(sample * fadeIn), j);
        }

        // Copy faded chunk
        fadeInBuffer.copy(result, offset);
        offset += chunk.length;
      } else {
        // Chunk too small for fade, copy as-is
        chunk.copy(result, offset);
        offset += chunk.length;
      }
    }
  }

  console.log(`WAV concatenation: ${buffers.length} chunks -> ${totalDataSize} bytes audio data (with ${fadeMs}ms fade transitions)`);

  return result;
}

// Helper: Convert WAV buffer to a compressed format.
// Prefer MP3 (best compatibility). If libmp3lame isn't available, fall back to AAC in M4A.
function wavToCompressed(wavBuffer: Buffer): { buffer: Buffer; format: 'mp3' | 'm4a'; mime: 'audio/mpeg' | 'audio/mp4' } {
  const nonce = `${Date.now()}_${Math.random().toString(16).slice(2)}`;
  const tmpWav = `/tmp/tts_${nonce}.wav`;
  const tmpMp3 = `/tmp/tts_${nonce}.mp3`;
  const tmpM4a = `/tmp/tts_${nonce}.m4a`;

  const cleanup = () => {
    try { fs.unlinkSync(tmpWav); } catch { }
    try { fs.unlinkSync(tmpMp3); } catch { }
    try { fs.unlinkSync(tmpM4a); } catch { }
  };

  try {
    fs.writeFileSync(tmpWav, wavBuffer);

    // MP3 first
    try {
      execSync(`ffmpeg -y -i "${tmpWav}" -codec:a libmp3lame -b:a 128k "${tmpMp3}" 2>/dev/null`);
      const mp3Buffer = fs.readFileSync(tmpMp3);
      console.log(`WAV->MP3: ${Math.round(wavBuffer.length / 1024)}KB -> ${Math.round(mp3Buffer.length / 1024)}KB`);
      return { buffer: mp3Buffer, format: 'mp3', mime: 'audio/mpeg' };
    } catch {
      // Common on minimal images: ffmpeg built without libmp3lame
    }

    // Fallback: M4A (AAC)
    execSync(`ffmpeg -y -i "${tmpWav}" -vn -ac 1 -ar 24000 -c:a aac -b:a 96k "${tmpM4a}" 2>/dev/null`);
    const m4aBuffer = fs.readFileSync(tmpM4a);
    console.log(`WAV->M4A: ${Math.round(wavBuffer.length / 1024)}KB -> ${Math.round(m4aBuffer.length / 1024)}KB`);
    return { buffer: m4aBuffer, format: 'm4a', mime: 'audio/mp4' };
  } finally {
    cleanup();
  }
}

router.post('/generate-tts', async (c) => {
  const parsed = ttsPayloadSchema.parse(await c.req.json());
  const { env } = await import('../config/env');

  console.log(`TTS request (${parsed.provider}): ${parsed.text.substring(0, 100)}... (${parsed.text.length} chars)`);

  // CHATTERBOX via RunPod (self-hosted, voice cloning)
  if (parsed.provider === 'chatterbox') {
    // Keys are stored in Supabase assistant_config/api_keys and cached via getApiKey().
    // Local dev often doesn't have RUNPOD_* in .env, so fall back to Supabase key store.
    const runpodApiKey = env.RUNPOD_API_KEY || (await getApiKey('runpod')) || '';
    const runpodEndpointId = env.RUNPOD_ENDPOINT_ID || (await getApiKey('runpod_endpoint')) || '';

    if (!runpodApiKey || !runpodEndpointId) {
      return c.json({
        success: false,
        message: 'RunPod not configured (RUNPOD_API_KEY and RUNPOD_ENDPOINT_ID required)',
      }, 500);
    }

    try {
      console.log('Generating audio with Chatterbox via RunPod...');

      // TESTED: 350 chars still had truncation, reverting to 300 chars (original safe limit)
      // This ensures no truncation - can be increased if API limits change
      const textLength = parsed.text.length;
      const chunkSize = parseInt(process.env.CHATTERBOX_CHUNK_SIZE || '300', 10);
      const chunks = splitIntoChunks(parsed.text, chunkSize);
      console.log(`📦 Chunking ${textLength} chars into ${chunks.length} pieces (max ${chunkSize} chars/chunk)`);

      // Voice sample for cloning (Michael's voice)
      const voiceSampleUrl = parsed.audioUrl || 'https://qdfikbgwuauertfmkmzk.supabase.co/storage/v1/object/public/voices/voice_10sec.wav';

      // Sequential processing (RunPod serverless handles one at a time best)
      const generateChunk = async (chunk: string, index: number, maxRetries = 3): Promise<Buffer> => {
        for (let attempt = 1; attempt <= maxRetries; attempt++) {
          try {
            console.log(`Starting chunk ${index + 1}/${chunks.length} (attempt ${attempt})`);
            console.log(`  Chunk ${index + 1} text length: ${chunk.length} chars`);
            console.log(`  Chunk ${index + 1} preview: "${chunk.substring(0, 80)}..."`);
            console.log(`  Chunk ${index + 1} ends with: "...${chunk.substring(chunk.length - 60)}"`);

            // Safety check: if chunk exceeds 350 chars, log warning (shouldn't happen with proper chunking)
            if (chunk.length > 350) {
              console.log(`  ⚠️ WARNING: Chunk ${index + 1} is ${chunk.length} chars (exceeds 350 limit)`);
            }

            const response = await axios.post(
              `https://api.runpod.ai/v2/${runpodEndpointId}/runsync`,
              {
                input: {
                  text: chunk,
                  audio_url: voiceSampleUrl,
                  exaggeration: parsed.exaggeration || 0.3,
                  cfg_weight: 0.5,  // Default CFG for voice cloning
                }
              },
              {
                headers: {
                  'Authorization': `Bearer ${runpodApiKey}`,
                  'Content-Type': 'application/json',
                },
                timeout: 180000, // 3 min timeout (cold start can take ~30s)
              }
            );

            const output = response.data?.output;
            if (!output?.audio_base64) {
              throw new Error(`No audio_base64 in response for chunk ${index + 1}`);
            }

            console.log(`✅ Chunk ${index + 1} done`);
            return Buffer.from(output.audio_base64, 'base64');

          } catch (error: any) {
            if (attempt < maxRetries) {
              const waitTime = attempt * 5000;
              console.log(`⚠️ Chunk ${index + 1} failed, retrying in ${waitTime / 1000}s...`);
              await new Promise(r => setTimeout(r, waitTime));
            } else {
              throw error;
            }
          }
        }
        throw new Error(`Chunk ${index + 1} failed after ${maxRetries} retries`);
      };

      // SEQUENTIAL chunk processing for stability!
      console.log(`🚀 Starting SEQUENTIAL generation of ${chunks.length} chunks...`);
      const startTime = Date.now();

      const audioBuffers: Buffer[] = [];
      for (let i = 0; i < chunks.length; i++) {
        // Process sequentially to avoid overwhelming RunPod concurrency limits
        try {
          const buffer = await generateChunk(chunks[i]!, i);
          audioBuffers.push(buffer);
        } catch (err: any) {
          console.error(`❌ Chunk ${i + 1} failed permanently: ${err.message}`);
          throw err;
        }
      }

      const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
      console.log(`✅ All ${chunks.length} chunks completed in ${elapsed}s (sequential)!`);

      // Concatenate all chunks into WAV
      const wavAudio = concatenateWavBuffers(audioBuffers);

      // Convert to compressed audio (MP3 primary, M4A fallback)
      const { buffer: compressedAudio, format, mime } = wavToCompressed(wavAudio);
      const base64Audio = compressedAudio.toString('base64');

      console.log(`Final audio: ${Math.round(compressedAudio.length / 1024)}KB ${format.toUpperCase()} from ${audioBuffers.length} chunks`);

      // Estimate duration from original WAV (24000Hz, 16-bit mono = 48000 bytes/sec)
      const estimatedDuration = Math.ceil((wavAudio.length - 44) / 48000);

      return c.json({
        success: true,
        message: 'Audio generated successfully (Chatterbox via RunPod)',
        audioBase64: base64Audio,
        audioUrl: `data:${mime};base64,${base64Audio}`,
        durationSeconds: estimatedDuration,
        format,
        provider: 'chatterbox-runpod',
        chunks: chunks.length,
      });

    } catch (error: any) {
      console.error('RunPod Chatterbox error:', error.response?.data || error.message);
      return c.json({
        success: false,
        message: `Chatterbox (RunPod) failed: ${error.message}`,
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
  const { env } = await import('../config/env');

  if (!env.RUNPOD_API_KEY || !env.RUNPOD_ENDPOINT_ID) {
    return c.json({ success: false, message: 'RunPod not configured' }, 500);
  }

  const textLength = parsed.text.length;
  const chunkSize = parseInt(process.env.CHATTERBOX_CHUNK_SIZE || '300', 10);
  const chunks = splitIntoChunks(parsed.text, chunkSize);
  const voiceSampleUrl = parsed.audioUrl || 'https://qdfikbgwuauertfmkmzk.supabase.co/storage/v1/object/public/voices/voice_10sec.wav';

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
              `https://api.runpod.ai/v2/${env.RUNPOD_ENDPOINT_ID}/runsync`,
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
                  'Authorization': `Bearer ${env.RUNPOD_API_KEY}`,
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
    const { env } = await import('../config/env');
    const { supabase } = await import('../services/supabaseClient');

    if (!supabase) {
      return c.json({ success: false, error: 'Supabase not configured' }, 500);
    }

    // Use userId if provided, otherwise use temp storage (for pre-signup hook audio)
    const userId = parsed.userId || 'temp';
    console.log(`🎤 Hook audio generation: ${parsed.type} for user ${userId} (${parsed.text.length} chars)`);

    // Get RunPod keys
    const runpodApiKey = env.RUNPOD_API_KEY || (await getApiKey('runpod')) || '';
    const runpodEndpointId = env.RUNPOD_ENDPOINT_ID || (await getApiKey('runpod_endpoint')) || '';

    if (!runpodApiKey || !runpodEndpointId) {
      return c.json({
        success: false,
        error: 'RunPod not configured (RUNPOD_API_KEY and RUNPOD_ENDPOINT_ID required)',
      }, 500);
    }

    // Generate audio using same logic as /generate-tts
    const textLength = parsed.text.length;
    const chunkSize = parseInt(process.env.CHATTERBOX_CHUNK_SIZE || '300', 10);
    const chunks = splitIntoChunks(parsed.text, chunkSize);
    console.log(`📦 Chunking ${textLength} chars into ${chunks.length} pieces`);

    const voiceSampleUrl = parsed.audioUrl || 'https://qdfikbgwuauertfmkmzk.supabase.co/storage/v1/object/public/voices/voice_10sec.wav';

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
    const contentType = format === 'mp3' ? 'audio/mpeg' : 'audio/mp4';

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

