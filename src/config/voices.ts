/**
 * VOICE REGISTRY
 * 
 * Centralized configuration for all available voices.
 * Each voice has a unique ID, display name, and sample audio for cloning.
 */

export interface TurboVoiceSettings {
    temperature?: number;
    top_p?: number;
    cfg_weight?: number;
    exaggeration?: number;
}

export interface Voice {
    id: string;              // Unique identifier (kebab-case, used in URLs and storage)
    displayName: string;     // User-facing name (e.g., "David", "Elisabeth")
    description: string;     // Brief description shown to users
    sampleAudioUrl: string;  // URL to voice sample (WAV preferred for RunPod/Chatterbox training, MP3 also works)
    previewSampleUrl?: string; // Optional: MP3 URL for frontend previews (if different from sampleAudioUrl)
    category?: 'male' | 'female' | 'neutral';
    enabled?: boolean;       // Allow disabling voices without removing them
    isTurboPreset?: boolean; // True if this is a Chatterbox Turbo built-in voice (no cloning needed)
    turboVoiceId?: string;   // Turbo voice ID for API calls (e.g., "alloy", "echo")
    turboSettings?: TurboVoiceSettings; // Custom settings for Turbo voices
}

/**
 * Standard quote used for all voice samples.
 * From Anaïs Nin's "House of Incest"
 * See: docs/PREVIEW_Speaker_text.md for full text
 */
export const VOICE_SAMPLE_QUOTE = `My first vision of earth was water veiled. I am of the race of men and women who see things through this curtain of sea, and my eyes are the color of water. I looked with chameleon eyes upon the changing face of the world, looked with anonymous vision upon my uncompleted self. I remember my first birth in water. All round me a sulphurous transparency and my bones move as if made of rubber. I sway and float, stand on boneless toes listening for distant sounds, sounds beyond the reach of human ears, see things beyond the reach of human eyes. Born full of memories of the bells of Atlantide. Always listening for lost sounds and searching for lost colors, standing forever on the threshold like one troubled with memories, and walking with a swimming stride. I cut the air with wideslicing fins, and swim through wall-less rooms. The night surrounded me, a photograph unglued from its frame. The lining of a coat ripped open like the two shells of an oyster. The day and night unglued, and I falling in between not knowing on which layer I was resting, whether it was the cold upper leaf of dawn, or the dark layer of night.`;

/**
 * All available voices for the application.
 * 
 * This is the single source of truth for all narrator voices.
 * To add, update, or remove voices, simply modify this array.
 * 
 * To add a new voice:
 * 1. Upload WAV voice sample to Supabase Storage (voices/{voice_id}.wav)
 * 2. Upload MP3 preview sample to voice-samples/{voice_id}/preview.mp3
 * 3. Add a new entry to this array with:
 *    - id: unique identifier (lowercase, kebab-case)
 *    - displayName: user-facing name (e.g., "David", "Elisabeth")
 *    - description: brief description shown in the UI
 *    - sampleAudioUrl: WAV file URL (for voice cloning/training)
 *    - previewSampleUrl: MP3 file URL (for frontend previews)
 *    - category: 'male' | 'female' | 'neutral'
 *    - enabled: true (set to false to temporarily disable without removing)
 * 
 * The frontend will automatically fetch and display all enabled voices.
 */
export const VOICES: Voice[] = [
    {
        id: 'david',
        displayName: 'David',
        description: 'Warm and engaging male narrator with a natural, conversational tone',
        sampleAudioUrl: 'https://qdfikbgwuauertfmkmzk.supabase.co/storage/v1/object/public/voices/david.wav',
        previewSampleUrl: 'https://qdfikbgwuauertfmkmzk.supabase.co/storage/v1/object/public/voice-samples/david/preview.mp3',
        category: 'male',
        enabled: true,
        // Custom voice cloning via reference_audio
        turboSettings: { temperature: 0.7 },
    },
    {
        id: 'elisabeth',
        displayName: 'Elisabeth',
        description: 'Elegant female narrator with a clear, sophisticated voice',
        sampleAudioUrl: 'https://qdfikbgwuauertfmkmzk.supabase.co/storage/v1/object/public/voices/elisabeth.wav',
        previewSampleUrl: 'https://qdfikbgwuauertfmkmzk.supabase.co/storage/v1/object/public/voice-samples/elisabeth/preview.mp3',
        category: 'female',
        enabled: true,
        turboSettings: { temperature: 0.7 },
    },
    {
        id: 'michael',
        displayName: 'Michael',
        description: 'Confident male narrator with a strong, authoritative presence',
        sampleAudioUrl: 'https://qdfikbgwuauertfmkmzk.supabase.co/storage/v1/object/public/voices/michael.wav',
        previewSampleUrl: 'https://qdfikbgwuauertfmkmzk.supabase.co/storage/v1/object/public/voice-samples/michael/preview.mp3',
        category: 'male',
        enabled: true,
        turboSettings: { temperature: 0.7 },
    },
    {
        id: 'peter',
        displayName: 'Peter',
        description: 'Friendly male narrator with a warm, approachable tone',
        sampleAudioUrl: 'https://qdfikbgwuauertfmkmzk.supabase.co/storage/v1/object/public/voices/peter.wav',
        previewSampleUrl: 'https://qdfikbgwuauertfmkmzk.supabase.co/storage/v1/object/public/voice-samples/peter/preview.mp3',
        category: 'male',
        enabled: true,
        turboSettings: { temperature: 0.7 },
    },
    {
        id: 'victor',
        displayName: 'Victor',
        description: 'Deep male narrator with a rich, resonant voice',
        sampleAudioUrl: 'https://qdfikbgwuauertfmkmzk.supabase.co/storage/v1/object/public/voices/victor.wav',
        previewSampleUrl: 'https://qdfikbgwuauertfmkmzk.supabase.co/storage/v1/object/public/voice-samples/victor/preview.mp3',
        category: 'male',
        enabled: true,
        turboSettings: { temperature: 0.7 },
    },
    // ═════════════════════════════════════════════════════════════════════════
    // CHATTERBOX TURBO BUILT-IN VOICES (No voice cloning needed)
    // Valid API voices: Aaron, Abigail, Anaya, Andy, Archer, Brian, Chloe, Dylan,
    // Emmanuel, Ethan, Evelyn, Gavin, Gordon, Ivan, Laura, Lucy, Madison, Marisol, Meera, Walter
    // ═════════════════════════════════════════════════════════════════════════
    {
        id: 'turbo-aaron',
        displayName: 'Aaron',
        description: 'Steady, reliable male narrator',
        sampleAudioUrl: '',
        category: 'male',
        enabled: true,
        isTurboPreset: true,
        turboVoiceId: 'Aaron',
    },
    {
        id: 'turbo-abigail',
        displayName: 'Abigail',
        description: 'Professional, confident female voice',
        sampleAudioUrl: '',
        category: 'female',
        enabled: true,
        isTurboPreset: true,
        turboVoiceId: 'Abigail',
        turboSettings: { temperature: 0.8, top_p: 0.95 },
    },
    {
        id: 'turbo-andy',
        displayName: 'Andy',
        description: 'Casual, approachable male voice',
        sampleAudioUrl: '',
        category: 'male',
        enabled: true,
        isTurboPreset: true,
        turboVoiceId: 'Andy',
        turboSettings: { temperature: 0.8, top_p: 0.95 },
    },
    {
        id: 'turbo-brian',
        displayName: 'Brian',
        description: 'Analytical, clear male voice',
        sampleAudioUrl: '',
        category: 'male',
        enabled: true,
        isTurboPreset: true,
        turboVoiceId: 'Brian',
    },
    {
        id: 'turbo-emmanuel',
        displayName: 'Emmanuel',
        description: 'Resonant, commanding male voice',
        sampleAudioUrl: '',
        category: 'male',
        enabled: true,
        isTurboPreset: true,
        turboVoiceId: 'Emmanuel',
    },
    {
        id: 'turbo-evelyn',
        displayName: 'Evelyn',
        description: 'Elegant, sophisticated female voice',
        sampleAudioUrl: '',
        category: 'female',
        enabled: true,
        isTurboPreset: true,
        turboVoiceId: 'Evelyn',
    },
    {
        id: 'turbo-gavin',
        displayName: 'Gavin',
        description: 'Smooth, conversational male voice',
        sampleAudioUrl: '',
        category: 'male',
        enabled: true,
        isTurboPreset: true,
        turboVoiceId: 'Gavin',
    },
    {
        id: 'turbo-gordon',
        displayName: 'Gordon',
        description: 'Authoritative, mature male voice',
        sampleAudioUrl: '',
        category: 'male',
        enabled: true,
        isTurboPreset: true,
        turboVoiceId: 'Gordon',
    },
    {
        id: 'turbo-ivan',
        displayName: 'Ivan',
        description: 'Deep, dramatic male voice',
        sampleAudioUrl: '',
        category: 'male',
        enabled: true,
        isTurboPreset: true,
        turboVoiceId: 'Ivan',
    },
    {
        id: 'turbo-laura',
        displayName: 'Laura',
        description: 'Professional, clear female voice',
        sampleAudioUrl: '',
        category: 'female',
        enabled: true,
        isTurboPreset: true,
        turboVoiceId: 'Laura',
        turboSettings: { temperature: 0.8, top_p: 0.95 },
    },
    {
        id: 'turbo-lucy',
        displayName: 'Lucy',
        description: 'Bright, cheerful female voice',
        sampleAudioUrl: '',
        category: 'female',
        enabled: true,
        isTurboPreset: true,
        turboVoiceId: 'Lucy',
    },
    {
        id: 'turbo-walter',
        displayName: 'Walter',
        description: 'Distinguished, wise male voice',
        sampleAudioUrl: '',
        category: 'male',
        enabled: true,
        isTurboPreset: true,
        turboVoiceId: 'Walter',
    },
];

/**
 * Get voice by ID
 */
export function getVoiceById(id: string): Voice | undefined {
    return VOICES.find((v) => v.id === id && v.enabled !== false);
}

/**
 * Get all enabled voices
 */
export function getEnabledVoices(): Voice[] {
    return VOICES.filter((v) => v.enabled !== false);
}

/**
 * Get voice sample URL (for frontend previews - returns MP3)
 */
export function getVoiceSampleUrl(voiceId: string): string {
    const voice = getVoiceById(voiceId);
    // Use previewSampleUrl if available
    if (voice?.previewSampleUrl) {
        return voice.previewSampleUrl;
    }
    // Fallback to MP3 in voice-samples bucket (works for both custom and Turbo voices)
    return `https://qdfikbgwuauertfmkmzk.supabase.co/storage/v1/object/public/voice-samples/${voiceId}/preview.mp3`;
}

/**
 * Check if voice is a Turbo preset (no cloning needed)
 */
export function isTurboPresetVoice(voiceId: string): boolean {
    const voice = getVoiceById(voiceId);
    return voice?.isTurboPreset === true;
}

/**
 * Get custom voices only (exclude Turbo presets)
 */
export function getCustomVoices(): Voice[] {
    return VOICES.filter((v) => v.enabled !== false && !v.isTurboPreset);
}

/**
 * Get Turbo preset voices only
 */
export function getTurboPresetVoices(): Voice[] {
    return VOICES.filter((v) => v.enabled !== false && v.isTurboPreset === true);
}
