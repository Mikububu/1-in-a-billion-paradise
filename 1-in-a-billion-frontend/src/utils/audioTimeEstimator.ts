/**
 * SMART AUDIO TIME ESTIMATOR
 * 
 * Intelligently estimates audio generation time based on:
 * - Text length
 * - Audio provider (Chatterbox vs ElevenLabs vs others)
 * - Chunking overhead
 * - Parallel vs sequential processing
 * 
 * This replaces the simple chars/minute calculation with provider-specific estimates.
 */

export type AudioProvider = 'chatterbox' | 'elevenlabs' | 'openai' | 'google';

export interface AudioEstimate {
  /** Minimum time in seconds */
  minSeconds: number;
  /** Maximum time in seconds */
  maxSeconds: number;
  /** Best guess time in seconds */
  estimatedSeconds: number;
  /** Display string for UI */
  displayTime: string;
  /** Number of chunks that will be generated */
  chunks: number;
}

/**
 * Provider-specific performance characteristics
 * Based on real-world testing and API limits
 */
const PROVIDER_CONFIG: Record<AudioProvider, {
  /** Characters per chunk (API limit) */
  chunkSize: number;
  /** Seconds per chunk (average) */
  secondsPerChunk: number;
  /** Overhead per chunk (network, polling, etc.) */
  overheadPerChunk: number;
  /** Can process chunks in parallel */
  supportsParallel: boolean;
  /** Max concurrent chunks if parallel */
  maxConcurrent: number;
}> = {
  chatterbox: {
    chunkSize: 300, // Tested safe limit
    secondsPerChunk: 25, // ~25s per 300-char chunk
    overheadPerChunk: 5, // Polling, network latency
    supportsParallel: true, // NEW: Parallel processing enabled
    maxConcurrent: 3, // Process 3 chunks at once
  },
  elevenlabs: {
    chunkSize: 500, // Higher character limit
    secondsPerChunk: 15, // Faster than Chatterbox
    overheadPerChunk: 3,
    supportsParallel: false,
    maxConcurrent: 1,
  },
  openai: {
    chunkSize: 4000, // Very high limit
    secondsPerChunk: 10,
    overheadPerChunk: 2,
    supportsParallel: false,
    maxConcurrent: 1,
  },
  google: {
    chunkSize: 5000,
    secondsPerChunk: 8,
    overheadPerChunk: 2,
    supportsParallel: false,
    maxConcurrent: 1,
  },
};

/**
 * Estimate audio generation time
 * @param text - The text to convert to audio
 * @param provider - Audio generation provider
 * @param useParallelProcessing - Whether parallel mode is enabled (default: false for safety)
 * @returns Time estimate with min, max, and display string
 */
export function estimateAudioGenerationTime(
  text: string,
  provider: AudioProvider = 'chatterbox',
  useParallelProcessing: boolean = false
): AudioEstimate {
  const config = PROVIDER_CONFIG[provider];
  const textLength = text.length;
  
  // Calculate number of chunks needed
  const chunks = Math.max(1, Math.ceil(textLength / config.chunkSize));
  
  // Calculate base generation time
  const baseGenerationTime = chunks * config.secondsPerChunk;
  
  // Calculate overhead time
  let totalOverhead: number;
  if (useParallelProcessing && config.supportsParallel) {
    // Parallel processing: overhead scales with batches, not individual chunks
    const batches = Math.ceil(chunks / config.maxConcurrent);
    totalOverhead = batches * config.overheadPerChunk;
  } else {
    // Sequential processing: overhead per chunk
    totalOverhead = chunks * config.overheadPerChunk;
  }
  
  // Calculate actual processing time
  let processingTime: number;
  if (useParallelProcessing && config.supportsParallel) {
    // Parallel: chunks processed in batches
    const batchCount = Math.ceil(chunks / config.maxConcurrent);
    processingTime = batchCount * config.secondsPerChunk;
  } else {
    // Sequential: all chunks one by one
    processingTime = baseGenerationTime;
  }
  
  // Total time = processing + overhead
  const estimatedSeconds = Math.ceil(processingTime + totalOverhead);
  
  // Add variance (±20% for network conditions, API load, etc.)
  const variance = estimatedSeconds * 0.2;
  const minSeconds = Math.max(10, Math.ceil(estimatedSeconds - variance));
  const maxSeconds = Math.ceil(estimatedSeconds + variance);
  
  // Format display string
  const displayTime = formatTimeEstimate(estimatedSeconds, minSeconds, maxSeconds);
  
  return {
    minSeconds,
    maxSeconds,
    estimatedSeconds,
    displayTime,
    chunks,
  };
}

/**
 * Format time estimate for display
 * @param estimated - Best guess in seconds
 * @param min - Minimum time in seconds
 * @param max - Maximum time in seconds
 * @returns Human-readable string
 */
function formatTimeEstimate(estimated: number, min: number, max: number): string {
  const estMinutes = Math.ceil(estimated / 60);
  const minMinutes = Math.ceil(min / 60);
  const maxMinutes = Math.ceil(max / 60);
  
  // If range is tight (within 1 minute), show single estimate
  if (maxMinutes - minMinutes <= 1) {
    if (estMinutes < 1) {
      return '< 1 min';
    }
    return `~${estMinutes} min`;
  }
  
  // Show range
  return `${minMinutes}-${maxMinutes} min`;
}

/**
 * Convert seconds to MM:SS display format
 * @param seconds - Total seconds
 * @returns Formatted string (e.g., "2:30")
 */
export function formatCountdown(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

/**
 * Calculate countdown timer that updates as job progresses
 * @param totalEstimatedSeconds - Initial estimate
 * @param progressPercent - Current progress (0-100)
 * @returns Remaining seconds
 */
export function calculateRemainingTime(
  totalEstimatedSeconds: number,
  progressPercent: number
): number {
  const remaining = totalEstimatedSeconds * (1 - progressPercent / 100);
  return Math.max(0, Math.ceil(remaining));
}

/**
 * Get provider from environment or default
 * @returns Current audio provider
 */
export function getAudioProvider(): AudioProvider {
  // This would normally read from app config/env
  // For now, return chatterbox as default
  return 'chatterbox';
}

/**
 * Check if parallel audio processing is enabled
 * @returns True if parallel mode is active
 */
export function isParallelProcessingEnabled(): boolean {
  // This would read from backend env var or feature flag
  // For now, return false (safe default)
  return false;
}

/**
 * EXAMPLE USAGE:
 * 
 * ```typescript
 * const text = "Long reading text...";
 * const estimate = estimateAudioGenerationTime(text, 'chatterbox', false);
 * 
 * console.log(estimate.displayTime); // "2-3 min"
 * console.log(estimate.chunks); // 5
 * console.log(estimate.estimatedSeconds); // 150
 * 
 * // With parallel processing (3-5x faster)
 * const parallelEstimate = estimateAudioGenerationTime(text, 'chatterbox', true);
 * console.log(parallelEstimate.displayTime); // "1 min"
 * ```
 */
