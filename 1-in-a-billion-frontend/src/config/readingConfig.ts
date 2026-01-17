/**
 * SHARED READING CONFIG
 * 
 * Single source of truth for 1st person AND 3rd person readings.
 * Change here → applies to both screens automatically.
 * 
 * DIFFERENCES (handled in prompts.ts):
 * - 1st person: "Dear child of the sun...", uses "you/your"
 * - 3rd person: Uses NAME, never "you", never generic greetings
 */

// ═══════════════════════════════════════════════════════════════════════════
// AUDIO SETTINGS
// ═══════════════════════════════════════════════════════════════════════════

export const AUDIO_CONFIG = {
  /** Emotion intensity (0-1). Lower = more natural voice */
  exaggeration: 0.3,

  /** Temperature for voice variation */
  temperature: 0.8,

  /** CFG weight for voice cloning */
  cfgWeight: 0.5,

  /** Voice sample URL for cloning */
  // voiceSampleUrl: 'https://yvlxhcvwxvwfakgudldp.supabase.co/storage/v1/object/public/voices/voice_10sec.wav',
  voiceSampleUrl: '',

  /** Characters processed per minute (for time estimation) */
  charsPerMinute: { slow: 300, fast: 500 },
};

/**
 * @deprecated VOICES object is deprecated. 
 * Voices are now fetched from the backend API (/api/voices/samples).
 * This object is kept for backwards compatibility but should not be used for new code.
 * Use the API endpoint instead - it's the single source of truth and easily updatable.
 */
export const VOICES = {
  // Legacy voice mappings - kept for backwards compatibility only
  // New voices are managed in backend/src/config/voices.ts
  david: 'https://qdfikbgwuauertfmkmzk.supabase.co/storage/v1/object/public/voice-samples/david/henry_miller_sample.mp3',
  elisabeth: 'https://qdfikbgwuauertfmkmzk.supabase.co/storage/v1/object/public/voice-samples/elisabeth/henry_miller_sample.mp3',
  michael: 'https://qdfikbgwuauertfmkmzk.supabase.co/storage/v1/object/public/voice-samples/michael/henry_miller_sample.mp3',
  peter: 'https://qdfikbgwuauertfmkmzk.supabase.co/storage/v1/object/public/voice-samples/peter/henry_miller_sample.mp3',
  victor: 'https://qdfikbgwuauertfmkmzk.supabase.co/storage/v1/object/public/voice-samples/victor/henry_miller_sample.mp3',
};

/**
 * Estimate audio generation time based on text length
 * @deprecated Use estimateAudioGenerationTime from audioTimeEstimator.ts instead
 * This function is kept for backwards compatibility but uses the old simple calculation.
 * New code should use the smart estimator which accounts for provider, chunking, and parallel processing.
 * @param text - The reading text to be converted to audio
 * @returns { min, max } minutes estimate
 */
export const estimateAudioTime = (text: string): { min: number; max: number; display: string } => {
  const charCount = text?.length || 0;
  const minMinutes = Math.max(1, Math.ceil(charCount / AUDIO_CONFIG.charsPerMinute.fast));
  const maxMinutes = Math.max(2, Math.ceil(charCount / AUDIO_CONFIG.charsPerMinute.slow));
  return {
    min: minMinutes,
    max: maxMinutes,
    display: minMinutes === maxMinutes ? `~${minMinutes} min` : `${minMinutes}-${maxMinutes} min`,
  };
};

/**
 * Smart audio estimation - imports from new utility
 * Use this for all new code requiring audio time estimates
 */
export { estimateAudioGenerationTime, formatCountdown } from '../utils/audioTimeEstimator';

/** Background audio generation message */
export const AUDIO_GENERATION_MESSAGE = {
  title: 'GENERATING AUDIO',
  hint: "You can leave this screen or close the app.\nAudio will be ready when you return.",
  cyclingMessages: ['GENERATING AUDIO', 'THIS TAKES A MOMENT', 'ALMOST THERE', 'CREATING YOUR NARRATION'],
};

/** Cycling messages for reading/PDF generation - keeps user engaged */
export const GENERATION_MESSAGES = {
  reading: [
    'GENERATING READING',
    'ANALYZING YOUR CHART',
    'DIVING DEEP INTO YOUR SOUL',
    'THIS TAKES A WHILE',
    'YOU CAN LEAVE THE APP',
    'CALCULATION IN BACKGROUND',
    'CONNECTING TO THE STARS',
    'READING YOUR COSMIC DNA',
  ],
  pdf: [
    'PREPARING PDF',
    'FORMATTING YOUR READING',
    'ALMOST READY',
    'YOU CAN LEAVE THE APP',
    'BACKGROUND PROCESSING',
    'CREATING YOUR DOCUMENT',
  ],
};

/** Estimate text generation time based on system */
export const estimateReadingTime = (system: string): { min: number; max: number; display: string } => {
  // Deep dive readings (2000 words) via Claude Sonnet 4.5
  // Claude takes longer than DeepSeek but produces higher quality
  const times: Record<string, { min: number; max: number }> = {
    western: { min: 3, max: 5 },
    vedic: { min: 3, max: 5 },
    human_design: { min: 3, max: 5 },
    kabbalah: { min: 3, max: 5 },
    gene_keys: { min: 3, max: 5 },
  };
  const t = times[system] || { min: 3, max: 5 };
  return { ...t, display: `~${t.min}-${t.max} min` };
};

// ═══════════════════════════════════════════════════════════════════════════
// TEXT LENGTH LIMITS
// ═══════════════════════════════════════════════════════════════════════════

export const TEXT_LIMITS = {
  /** Preamble word count */
  preamble: { min: 30, max: 40 },

  /** Analysis word count */
  analysis: { min: 70, max: 80 },

  /** Total word count (must fit one screen, no scrolling) */
  total: { min: 100, max: 120 },
};

// ═══════════════════════════════════════════════════════════════════════════
// LLM SETTINGS
// ═══════════════════════════════════════════════════════════════════════════

export const LLM_CONFIG = {
  /** Default provider for hook readings */
  defaultProvider: 'deepseek' as const,

  /** Available providers */
  providers: ['deepseek', 'claude'] as const,
};

// ═══════════════════════════════════════════════════════════════════════════
// READING TYPES
// ═══════════════════════════════════════════════════════════════════════════

export const READING_TYPES = ['sun', 'moon', 'rising'] as const;
export type ReadingType = typeof READING_TYPES[number];

// ═══════════════════════════════════════════════════════════════════════════
// UI LABELS
// ═══════════════════════════════════════════════════════════════════════════

export const SIGN_LABELS: Record<string, string> = {
  sun: 'YOUR SUN SIGN',
  moon: 'YOUR MOON SIGN',
  rising: 'YOUR RISING SIGN',
  gateway: 'YOUR SECRET LIFE',
};

/** Get label for 3rd person (uses their name) */
export const getPartnerSignLabel = (name: string, type: ReadingType) => {
  const upperName = name.toUpperCase();
  switch (type) {
    case 'sun': return { name: upperName, suffix: "'S SUN SIGN" };
    case 'moon': return { name: upperName, suffix: "'S MOON SIGN" };
    case 'rising': return { name: upperName, suffix: "'S RISING SIGN" };
  }
};

// ═══════════════════════════════════════════════════════════════════════════
// GREETINGS (1st person only - 3rd person uses name directly)
// ═══════════════════════════════════════════════════════════════════════════

export const GREETINGS: Record<ReadingType, string[]> = {
  sun: ['Dear child of the sun', 'Beloved soul of light', 'Sweet one born under golden rays', 'Radiant heart'],
  moon: ['Keeper of hidden waters', 'Tender soul of the inner tides', 'Dear one of the emotional depths', 'Gentle heart'],
  rising: ['Face of the rising dawn', 'Soul who greets the world', 'Dear one of first impressions', 'Bright presence'],
};

