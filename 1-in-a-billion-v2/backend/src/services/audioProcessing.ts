/**
 * AUDIO PROCESSING UTILITIES - Shared audio chunking and concatenation logic
 * 
 * This module provides reusable functions for:
 * - Text chunking (sentence-aware, never cuts mid-sentence)
 * - WAV buffer concatenation with crossfade transitions
 * - WAV format detection and conversion (IEEE Float to PCM)
 * 
 * CONFIGURATION: All tunable parameters are at the top for easy adjustment
 */

// ═══════════════════════════════════════════════════════════════════════════
// ⚠️  CRITICAL: DO NOT CHANGE THESE VALUES WITHOUT READING docs/AUDIO_OUTPUT_SPEC.md
// ⚠️  These settings were tuned on Feb 4, 2026 to fix audio gibberish/hallucination.
// ⚠️  Tested with 20 min audio - zero gibberish. Changing them WILL break audio quality.
// ═══════════════════════════════════════════════════════════════════════════

export const AUDIO_CONFIG = {
  // Text chunking
  // ⚠️ DO NOT INCREASE CHUNK_MAX_LENGTH - 450 caused gibberish, 300 is stable
  // Chatterbox Turbo claims 500 char limit but produces gibberish on longer chunks
  // Original Chatterbox uses 300 - more stable
  CHUNK_MAX_LENGTH: 300,           // ⚠️ CRITICAL: Do not increase (causes gibberish)
  CHUNK_OVERFLOW_TOLERANCE: 1.5,   // Allow chunks to exceed by this factor to complete sentences (1.5 = 50% over)
  CHUNK_WORD_SPLIT_THRESHOLD: 2.0, // Only split at word boundaries if sentence exceeds this factor (2.0 = 2x max)
  
  // Audio crossfade
  // ⚠️ DO NOT INCREASE CROSSFADE_DURATION_MS - 80ms caused stitching issues
  CROSSFADE_DURATION_MS: 0,        // ⚠️ CRITICAL: Keep at 0 (crossfade causes amplitude dips)
  
  // WAV format
  DEFAULT_SAMPLE_RATE: 24000,      // 24kHz sample rate
  DEFAULT_NUM_CHANNELS: 1,         // Mono audio
  DEFAULT_BITS_PER_SAMPLE: 16,     // 16-bit PCM
};

// ═══════════════════════════════════════════════════════════════════════════
// TEXT CHUNKING - Sentence-aware splitting
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Split text into chunks for TTS generation
 * 
 * IMPROVED LOGIC:
 * - Always completes sentences (never cuts mid-sentence)
 * - Allows chunks to slightly exceed maxChunkLength to finish current sentence
 * - Only splits at word boundaries if a single sentence is extremely long (>2x limit)
 * 
 * @param text - Text to split
 * @param maxChunkLength - Target max length per chunk (can be exceeded to complete sentences)
 * @returns Array of text chunks
 */
export function splitIntoChunks(text: string, maxChunkLength: number = AUDIO_CONFIG.CHUNK_MAX_LENGTH): string[] {
  // Match sentences: one or more non-punctuation chars + punctuation, OR remaining text at end
  // This ensures we capture actual sentence content, not just punctuation/spaces
  const sentenceRegex = /[^.!?]+[.!?]+(?:\s+|$)|[^.!?]+$/g;
  const sentences = text.match(sentenceRegex) || [text];
  const chunks: string[] = [];
  let currentChunk = '';

  for (const sentence of sentences) {
    const trimmed = sentence.trim();
    if (!trimmed) continue; // Skip empty strings

    // If adding this sentence keeps us under limit, add it
    if (currentChunk.length + trimmed.length + 1 <= maxChunkLength) {
      currentChunk += (currentChunk ? ' ' : '') + trimmed;
    } else {
      // Would exceed limit - but ALWAYS complete the current sentence first
      // Only start a new chunk if we already have content
      if (currentChunk) {
        // If adding this sentence would only slightly exceed tolerance, include it anyway
        // This prevents cutting right before a short sentence
        if (currentChunk.length + trimmed.length + 1 <= maxChunkLength * AUDIO_CONFIG.CHUNK_OVERFLOW_TOLERANCE) {
          currentChunk += ' ' + trimmed;
          chunks.push(currentChunk);
          currentChunk = '';
          continue;
        }
        // Otherwise save current chunk and start fresh
        chunks.push(currentChunk);
        currentChunk = '';
      }

      // Handle the new sentence
      // If single sentence exceeds threshold, split at word boundaries (rare case)
      if (trimmed.length > maxChunkLength * AUDIO_CONFIG.CHUNK_WORD_SPLIT_THRESHOLD) {
        const words = trimmed.split(/\s+/);
        let wordChunk = '';
        for (const word of words) {
          if (wordChunk.length + word.length + 1 <= maxChunkLength) {
            wordChunk += (wordChunk ? ' ' : '') + word;
          } else {
            if (wordChunk) chunks.push(wordChunk);
            wordChunk = word;
          }
        }
        currentChunk = wordChunk;
      } else {
        // Normal case: start new chunk with this sentence (even if it exceeds limit)
        currentChunk = trimmed;
      }
    }
  }
  if (currentChunk) chunks.push(currentChunk);

  // Safety: if somehow no chunks, return the original text
  if (chunks.length === 0) {
    return [text];
  }

  console.log(`📝 Split into ${chunks.length} chunks: ${chunks.map(c => c.length).join(', ')} chars`);
  return chunks;
}

// ═══════════════════════════════════════════════════════════════════════════
// WAV FORMAT DETECTION & CONVERSION
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Find the "data" chunk in a WAV file and return its offset and size
 */
export function findWavDataChunk(buffer: Buffer): { dataOffset: number; dataSize: number } {
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

/**
 * Detect WAV format (16-bit PCM vs IEEE Float)
 */
export function getWavFormat(buffer: Buffer): { 
  audioFormat: number; 
  numChannels: number; 
  sampleRate: number; 
  bitsPerSample: number;
} {
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

/**
 * Convert IEEE Float WAV to 16-bit PCM WAV
 */
export function convertFloatWavToPcm(buffer: Buffer): Buffer {
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

// ═══════════════════════════════════════════════════════════════════════════
// WAV CONCATENATION WITH CROSSFADE
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Concatenate WAV buffers with crossfade transitions
 * 
 * IMPROVED LOGIC:
 * - Uses configurable crossfade duration (default 80ms)
 * - Proper overlap blending (not just fade-out/fade-in)
 * - Equal-power crossfade for perceptually smooth transitions
 * - Converts IEEE Float to 16-bit PCM if needed
 * 
 * @param buffers - Array of WAV buffers to concatenate
 * @returns Single concatenated WAV buffer with crossfades
 */
export function concatenateWavBuffers(buffers: Buffer[]): Buffer {
  if (buffers.length === 0) return Buffer.alloc(0);
  if (buffers.length === 1) return convertFloatWavToPcm(buffers[0]!);

  // Convert and extract audio data from each buffer
  const audioDataChunks: Buffer[] = [];
  let totalDataSize = 0;

  // Determine format from the FIRST buffer (keeps original sample rate/channels)
  let sampleRate = AUDIO_CONFIG.DEFAULT_SAMPLE_RATE;
  let numChannels = AUDIO_CONFIG.DEFAULT_NUM_CHANNELS;
  let bitsPerSample = AUDIO_CONFIG.DEFAULT_BITS_PER_SAMPLE;

  for (let i = 0; i < buffers.length; i++) {
    const buf = buffers[i]!;
    // Convert IEEE Float to 16-bit PCM if needed
    const pcmBuf = convertFloatWavToPcm(buf);

    // Capture format from the first (converted) buffer
    if (i === 0) {
      try {
        const fmt = getWavFormat(pcmBuf);
        sampleRate = fmt.sampleRate || sampleRate;
        numChannels = fmt.numChannels || numChannels;
        bitsPerSample = fmt.bitsPerSample || bitsPerSample;
        if (fmt.sampleRate !== AUDIO_CONFIG.DEFAULT_SAMPLE_RATE || fmt.numChannels !== AUDIO_CONFIG.DEFAULT_NUM_CHANNELS) {
          console.log(`⚠️  Using source format for stitching: ${fmt.sampleRate}Hz, ${fmt.numChannels}ch, ${fmt.bitsPerSample}-bit`);
        }
      } catch (err) {
        console.warn('Could not read WAV fmt chunk, falling back to defaults:', err);
      }
    } else {
      // Sanity check for format drift between chunks
      try {
        const fmt = getWavFormat(pcmBuf);
        if (fmt.sampleRate !== sampleRate || fmt.numChannels !== numChannels) {
          console.warn(`⚠️  Chunk ${i + 1} format mismatch (${fmt.sampleRate}Hz/${fmt.numChannels}ch) vs base (${sampleRate}Hz/${numChannels}ch). Proceeding without resample.`);
        }
      } catch { /* ignore */ }
    }

    const { dataOffset, dataSize } = findWavDataChunk(pcmBuf);
    const audioData = pcmBuf.slice(dataOffset, dataOffset + dataSize);
    console.log(`Chunk ${i + 1} audio data: ${dataSize} bytes (offset: ${dataOffset}, total buffer: ${pcmBuf.length})`);
    audioDataChunks.push(audioData);
    totalDataSize += audioData.length;
  }

  // IMPROVED CROSSFADE: Blend overlapping regions for seamless transitions
  const fadeMs = AUDIO_CONFIG.CROSSFADE_DURATION_MS;
  const bytesPerSample = bitsPerSample / 8;
  const fadeSamples = Math.floor((sampleRate * fadeMs) / 1000);
  const fadeBytes = fadeSamples * bytesPerSample * numChannels;

  // First pass: calculate total size accounting for crossfade overlap
  let crossfadeTotalSize = audioDataChunks[0]?.length || 0;
  for (let i = 1; i < audioDataChunks.length; i++) {
    const chunk = audioDataChunks[i]!;
    const prevChunk = audioDataChunks[i - 1]!;
    // Overlap region is subtracted (we blend instead of concatenate)
    const overlapBytes = Math.min(fadeBytes, chunk.length, prevChunk.length);
    crossfadeTotalSize += chunk.length - overlapBytes;
  }

  // Allocate result buffer with correct size
  const crossfadeResult = Buffer.alloc(44 + crossfadeTotalSize);

  // Write WAV header with source format
  crossfadeResult.write('RIFF', 0);
  crossfadeResult.writeUInt32LE(36 + crossfadeTotalSize, 4); // ChunkSize
  crossfadeResult.write('WAVE', 8);
  crossfadeResult.write('fmt ', 12);
  crossfadeResult.writeUInt32LE(16, 16); // Subchunk1Size (PCM)
  crossfadeResult.writeUInt16LE(1, 20); // AudioFormat (PCM)
  crossfadeResult.writeUInt16LE(numChannels, 22); // NumChannels
  crossfadeResult.writeUInt32LE(sampleRate, 24); // SampleRate
  crossfadeResult.writeUInt32LE(sampleRate * numChannels * bytesPerSample, 28); // ByteRate
  crossfadeResult.writeUInt16LE(numChannels * bytesPerSample, 32); // BlockAlign
  crossfadeResult.writeUInt16LE(bitsPerSample, 34); // BitsPerSample
  crossfadeResult.write('data', 36);
  crossfadeResult.writeUInt32LE(crossfadeTotalSize, 40); // Subchunk2Size

  let writeOffset = 44;
  for (let i = 0; i < audioDataChunks.length; i++) {
    const chunk = audioDataChunks[i]!;

    if (i === 0) {
      // First chunk: copy entirely
      chunk.copy(crossfadeResult, writeOffset);
      writeOffset += chunk.length;
    } else {
      const prevChunk = audioDataChunks[i - 1]!;
      const overlapBytes = Math.min(fadeBytes, chunk.length, prevChunk.length);

      if (overlapBytes >= bytesPerSample * numChannels) {
        // CROSSFADE: Blend the overlap region
        // The overlap region is at the END of what we've written and START of current chunk
        const blendStart = writeOffset - overlapBytes;

        for (let j = 0; j < overlapBytes; j += bytesPerSample * numChannels) {
          // Read sample(s) from previous chunk (already in result buffer)
          const prevSample = bitsPerSample === 16
            ? crossfadeResult.readInt16LE(blendStart + j)
            : crossfadeResult.readInt8(blendStart + j);
          const currSample = bitsPerSample === 16
            ? chunk.readInt16LE(j)
            : chunk.readInt8(j);

          // Crossfade ratio: prev fades out (1->0), curr fades in (0->1)
          const t = j / overlapBytes; // 0.0 to 1.0
          // Use equal-power crossfade for smoother transition
          const prevGain = Math.cos(t * Math.PI / 2);
          const currGain = Math.sin(t * Math.PI / 2);

          // Blend samples
          const blended = Math.round(prevSample * prevGain + currSample * currGain);
          // Clamp to int range
          const maxVal = bitsPerSample === 16 ? 32767 : 127;
          const minVal = bitsPerSample === 16 ? -32768 : -128;
          const clamped = Math.max(minVal, Math.min(maxVal, blended));
          if (bitsPerSample === 16) {
            crossfadeResult.writeInt16LE(clamped, blendStart + j);
          } else {
            crossfadeResult.writeInt8(clamped, blendStart + j);
          }
        }

        // Copy rest of current chunk (after overlap region)
        if (chunk.length > overlapBytes) {
          chunk.copy(crossfadeResult, writeOffset, overlapBytes);
          writeOffset += chunk.length - overlapBytes;
        }
      } else {
        // Chunk too small for crossfade, just append
        chunk.copy(crossfadeResult, writeOffset);
        writeOffset += chunk.length;
      }
    }
  }

  console.log(`WAV concatenation: ${buffers.length} chunks -> ${crossfadeTotalSize} bytes audio data (with ${fadeMs}ms crossfade, ${sampleRate}Hz, ${numChannels}ch)`);

  return crossfadeResult;
}
