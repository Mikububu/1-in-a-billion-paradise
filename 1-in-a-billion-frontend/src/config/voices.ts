/**
 * VOICE CONFIGURATION
 * 
 * Hardcoded voice list with preview URLs.
 * Voice previews are STATIC ASSETS - they don't change dynamically.
 * 
 * Update this file when adding/removing voices (rare operation).
 * No need to fetch from API - these are fixed assets.
 */

export interface Voice {
  id: string;
  displayName: string;
  description: string;
  category: 'male' | 'female' | 'neutral';
  sampleUrl: string;
  isTurboPreset: boolean;
  turboVoiceId?: string;
}

/**
 * All available voices with their Supabase Storage preview URLs.
 * These are STATIC - only update when voice lineup changes.
 */
export const VOICES: Voice[] = [
  // ═══════════════════════════════════════════════════════════════════════
  // CUSTOM VOICES (RunPod Voice Cloning)
  // ═══════════════════════════════════════════════════════════════════════
  {
    id: 'david',
    displayName: 'David',
    description: 'Warm and engaging male narrator with a natural, conversational tone',
    category: 'male',
    sampleUrl: 'https://qdfikbgwuauertfmkmzk.supabase.co/storage/v1/object/public/voice-samples/david/preview.mp3',
    isTurboPreset: false,
  },
  {
    id: 'elisabeth',
    displayName: 'Elisabeth',
    description: 'Elegant female narrator with a clear, sophisticated voice',
    category: 'female',
    sampleUrl: 'https://qdfikbgwuauertfmkmzk.supabase.co/storage/v1/object/public/voice-samples/elisabeth/preview.mp3',
    isTurboPreset: false,
  },
  {
    id: 'michael',
    displayName: 'Michael',
    description: 'Confident male narrator with a strong, authoritative presence',
    category: 'male',
    sampleUrl: 'https://qdfikbgwuauertfmkmzk.supabase.co/storage/v1/object/public/voice-samples/michael/preview.mp3',
    isTurboPreset: false,
  },
  {
    id: 'peter',
    displayName: 'Peter',
    description: 'Friendly male narrator with a warm, approachable tone',
    category: 'male',
    sampleUrl: 'https://qdfikbgwuauertfmkmzk.supabase.co/storage/v1/object/public/voice-samples/peter/preview.mp3',
    isTurboPreset: false,
  },
  {
    id: 'victor',
    displayName: 'Victor',
    description: 'Deep male narrator with a rich, resonant voice',
    category: 'male',
    sampleUrl: 'https://qdfikbgwuauertfmkmzk.supabase.co/storage/v1/object/public/voice-samples/victor/preview.mp3',
    isTurboPreset: false,
  },

  // ═══════════════════════════════════════════════════════════════════════
  // TURBO PRESET VOICES (Chatterbox Turbo Built-in - No Cloning)
  // ═══════════════════════════════════════════════════════════════════════
  {
    id: 'turbo-aaron',
    displayName: 'Aaron',
    description: 'Steady, reliable male narrator',
    category: 'male',
    sampleUrl: 'https://qdfikbgwuauertfmkmzk.supabase.co/storage/v1/object/public/voice-samples/turbo-aaron/preview.mp3',
    isTurboPreset: true,
    turboVoiceId: 'Aaron',
  },
  {
    id: 'turbo-abigail',
    displayName: 'Abigail',
    description: 'Professional, confident female voice',
    category: 'female',
    sampleUrl: 'https://qdfikbgwuauertfmkmzk.supabase.co/storage/v1/object/public/voice-samples/turbo-abigail/preview.mp3',
    isTurboPreset: true,
    turboVoiceId: 'Abigail',
  },
  {
    id: 'turbo-andy',
    displayName: 'Andy',
    description: 'Casual, approachable male voice',
    category: 'male',
    sampleUrl: 'https://qdfikbgwuauertfmkmzk.supabase.co/storage/v1/object/public/voice-samples/turbo-andy/preview.mp3',
    isTurboPreset: true,
    turboVoiceId: 'Andy',
  },
  {
    id: 'turbo-brian',
    displayName: 'Brian',
    description: 'Analytical, clear male voice',
    category: 'male',
    sampleUrl: 'https://qdfikbgwuauertfmkmzk.supabase.co/storage/v1/object/public/voice-samples/turbo-brian/preview.mp3',
    isTurboPreset: true,
    turboVoiceId: 'Brian',
  },
  {
    id: 'turbo-emmanuel',
    displayName: 'Emmanuel',
    description: 'Resonant, commanding male voice',
    category: 'male',
    sampleUrl: 'https://qdfikbgwuauertfmkmzk.supabase.co/storage/v1/object/public/voice-samples/turbo-emmanuel/preview.mp3',
    isTurboPreset: true,
    turboVoiceId: 'Emmanuel',
  },
  {
    id: 'turbo-evelyn',
    displayName: 'Evelyn',
    description: 'Elegant, sophisticated female voice',
    category: 'female',
    sampleUrl: 'https://qdfikbgwuauertfmkmzk.supabase.co/storage/v1/object/public/voice-samples/turbo-evelyn/preview.mp3',
    isTurboPreset: true,
    turboVoiceId: 'Evelyn',
  },
  {
    id: 'turbo-gavin',
    displayName: 'Gavin',
    description: 'Smooth, conversational male voice',
    category: 'male',
    sampleUrl: 'https://qdfikbgwuauertfmkmzk.supabase.co/storage/v1/object/public/voice-samples/turbo-gavin/preview.mp3',
    isTurboPreset: true,
    turboVoiceId: 'Gavin',
  },
  {
    id: 'turbo-gordon',
    displayName: 'Gordon',
    description: 'Authoritative, mature male voice',
    category: 'male',
    sampleUrl: 'https://qdfikbgwuauertfmkmzk.supabase.co/storage/v1/object/public/voice-samples/turbo-gordon/preview.mp3',
    isTurboPreset: true,
    turboVoiceId: 'Gordon',
  },
  {
    id: 'turbo-ivan',
    displayName: 'Ivan',
    description: 'Deep, dramatic male voice',
    category: 'male',
    sampleUrl: 'https://qdfikbgwuauertfmkmzk.supabase.co/storage/v1/object/public/voice-samples/turbo-ivan/preview.mp3',
    isTurboPreset: true,
    turboVoiceId: 'Ivan',
  },
  {
    id: 'turbo-laura',
    displayName: 'Laura',
    description: 'Professional, clear female voice',
    category: 'female',
    sampleUrl: 'https://qdfikbgwuauertfmkmzk.supabase.co/storage/v1/object/public/voice-samples/turbo-laura/preview.mp3',
    isTurboPreset: true,
    turboVoiceId: 'Laura',
  },
  {
    id: 'turbo-lucy',
    displayName: 'Lucy',
    description: 'Bright, cheerful female voice',
    category: 'female',
    sampleUrl: 'https://qdfikbgwuauertfmkmzk.supabase.co/storage/v1/object/public/voice-samples/turbo-lucy/preview.mp3',
    isTurboPreset: true,
    turboVoiceId: 'Lucy',
  },
  {
    id: 'turbo-walter',
    displayName: 'Walter',
    description: 'Distinguished, wise male voice',
    category: 'male',
    sampleUrl: 'https://qdfikbgwuauertfmkmzk.supabase.co/storage/v1/object/public/voice-samples/turbo-walter/preview.mp3',
    isTurboPreset: true,
    turboVoiceId: 'Walter',
  },
];

/**
 * Anaïs Nin quote used in all voice samples
 */
export const VOICE_SAMPLE_QUOTE = `My first vision of earth was water veiled. I am of the race of men and women who see things through this curtain of sea, and my eyes are the color of water. I looked with chameleon eyes upon the changing face of the world, looked with anonymous vision upon my uncompleted self. I remember my first birth in water. All round me a sulphurous transparency and my bones move as if made of rubber. I sway and float, stand on boneless toes listening for distant sounds, sounds beyond the reach of human ears, see things beyond the reach of human eyes. Born full of memories of the bells of Atlantide. Always listening for lost sounds and searching for lost colors, standing forever on the threshold like one troubled with memories, and walking with a swimming stride. I cut the air with wideslicing fins, and swim through wall-less rooms. The night surrounded me, a photograph unglued from its frame. The lining of a coat ripped open like the two shells of an oyster. The day and night unglued, and I falling in between not knowing on which layer I was resting, whether it was the cold upper leaf of dawn, or the dark layer of night.`;

export const VOICE_SAMPLE_AUTHOR = 'Anaïs Nin, House of Incest';

/**
 * Get voice by ID
 */
export function getVoiceById(id: string): Voice | undefined {
  return VOICES.find((v) => v.id === id);
}

/**
 * Get custom voices only (exclude Turbo presets)
 */
export function getCustomVoices(): Voice[] {
  return VOICES.filter((v) => !v.isTurboPreset);
}

/**
 * Get Turbo preset voices only
 */
export function getTurboVoices(): Voice[] {
  return VOICES.filter((v) => v.isTurboPreset);
}
