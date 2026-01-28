/**
 * VOICE REGISTRY
 * 
 * Centralized configuration for all available voices.
 * Each voice has a unique ID, display name, and sample audio for cloning.
 */

export interface Voice {
    id: string;              // Unique identifier (kebab-case, used in URLs and storage)
    displayName: string;     // User-facing name (e.g., "David", "Elisabeth")
    description: string;     // Brief description shown to users
    sampleAudioUrl: string;  // URL to voice sample (WAV preferred for RunPod/Chatterbox training, MP3 also works)
    previewSampleUrl?: string; // Optional: MP3 URL for frontend previews (if different from sampleAudioUrl)
    category?: 'male' | 'female' | 'neutral';
    enabled?: boolean;       // Allow disabling voices without removing them
}

/**
 * Standard quote used for all voice samples.
 * From Henry Miller's "Tropic of Cancer"
 */
export const VOICE_SAMPLE_QUOTE = `I need to be alone. I need to ponder my shame and my despair in seclusion; I need the sunshine and the paving stones of the streets without companions, without conversation, face to face with myself, with only the music of my heart for company.`;

/**
 * All available voices for the application.
 * 
 * This is the single source of truth for all narrator voices.
 * To add, update, or remove voices, simply modify this array.
 * 
 * To add a new voice:
 * 1. Upload WAV voice sample to Supabase Storage (voices/{voice_id}.wav)
 * 2. Upload MP3 preview sample to voice-samples/{voice_id}/henry_miller_sample.mp3
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
    },
    {
        id: 'elisabeth',
        displayName: 'Elisabeth',
        description: 'Elegant female narrator with a clear, sophisticated voice',
        sampleAudioUrl: 'https://qdfikbgwuauertfmkmzk.supabase.co/storage/v1/object/public/voices/elisabeth.wav',
        previewSampleUrl: 'https://qdfikbgwuauertfmkmzk.supabase.co/storage/v1/object/public/voice-samples/elisabeth/preview.mp3',
        category: 'female',
        enabled: true,
    },
    {
        id: 'michael',
        displayName: 'Michael',
        description: 'Confident male narrator with a strong, authoritative presence',
        sampleAudioUrl: 'https://qdfikbgwuauertfmkmzk.supabase.co/storage/v1/object/public/voices/michael.wav',
        previewSampleUrl: 'https://qdfikbgwuauertfmkmzk.supabase.co/storage/v1/object/public/voice-samples/michael/preview.mp3',
        category: 'male',
        enabled: true,
    },
    {
        id: 'peter',
        displayName: 'Peter',
        description: 'Friendly male narrator with a warm, approachable tone',
        sampleAudioUrl: 'https://qdfikbgwuauertfmkmzk.supabase.co/storage/v1/object/public/voices/peter.wav',
        previewSampleUrl: 'https://qdfikbgwuauertfmkmzk.supabase.co/storage/v1/object/public/voice-samples/peter/preview.mp3',
        category: 'male',
        enabled: true,
    },
    {
        id: 'victor',
        displayName: 'Victor',
        description: 'Deep male narrator with a rich, resonant voice',
        sampleAudioUrl: 'https://qdfikbgwuauertfmkmzk.supabase.co/storage/v1/object/public/voices/victor.wav',
        previewSampleUrl: 'https://qdfikbgwuauertfmkmzk.supabase.co/storage/v1/object/public/voice-samples/victor/preview.mp3',
        category: 'male',
        enabled: true,
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
    // Use previewSampleUrl if available, otherwise fall back to sampleAudioUrl
    if (voice?.previewSampleUrl) {
        return voice.previewSampleUrl;
    }
    // Fallback to MP3 in voice-samples bucket
    return `https://qdfikbgwuauertfmkmzk.supabase.co/storage/v1/object/public/voice-samples/${voiceId}/preview.mp3`;
}
