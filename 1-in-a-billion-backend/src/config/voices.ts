/**
 * VOICE REGISTRY
 * 
 * Centralized configuration for all available voices.
 * Each voice has a unique ID, display name, and sample audio for cloning.
 */

export interface Voice {
    id: string;              // Unique identifier (kebab-case, used in URLs and storage)
    displayName: string;     // User-facing name (e.g., "Grandpa", "Default")
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
 * To add a new voice:
 * 1. Upload MP3 voice sample to voice-samples/{voice_id}/henry_miller_sample.mp3 in Supabase Storage
 * 2. Add voice to this array with the MP3 URL
 * 3. The MP3 file is used for both cloning (RunPod) and frontend previews
 */
export const VOICES: Voice[] = [
    {
        id: 'anabella',
        displayName: 'Anabella',
        description: 'Warm female narrator with gentle tone',
        sampleAudioUrl: 'https://qdfikbgwuauertfmkmzk.supabase.co/storage/v1/object/public/voice-samples/anabella/henry_miller_sample.mp3',
        category: 'female',
        enabled: true,
    },
    {
        id: 'dorothy',
        displayName: 'Dorothy',
        description: 'Clear female voice with sophisticated tone',
        sampleAudioUrl: 'https://qdfikbgwuauertfmkmzk.supabase.co/storage/v1/object/public/voice-samples/dorothy/henry_miller_sample.mp3',
        category: 'female',
        enabled: true,
    },
    {
        id: 'ludwig',
        displayName: 'Ludwig',
        description: 'Deep male narrator with authoritative presence',
        sampleAudioUrl: 'https://qdfikbgwuauertfmkmzk.supabase.co/storage/v1/object/public/voice-samples/ludwig/henry_miller_sample.mp3',
        category: 'male',
        enabled: true,
    },
    {
        id: 'grandpa',
        displayName: 'Grandpa',
        description: 'Legendary documentary narrator voice',
        sampleAudioUrl: 'https://qdfikbgwuauertfmkmzk.supabase.co/storage/v1/object/public/voice-samples/grandpa/henry_miller_sample.mp3',
        category: 'male',
        enabled: true,
    },
    {
        id: 'default',
        displayName: 'Default',
        description: 'Deprecated - Same as Grandpa (David A voice)',
        sampleAudioUrl: 'https://qdfikbgwuauertfmkmzk.supabase.co/storage/v1/object/public/voice-samples/grandpa/henry_miller_sample.mp3',
        category: 'male',
        enabled: false, // Disabled - duplicate of Grandpa
    },
    // New voices from "new voices" folder
    {
        id: 'david',
        displayName: 'David',
        description: 'Male narrator voice',
        sampleAudioUrl: 'https://qdfikbgwuauertfmkmzk.supabase.co/storage/v1/object/public/voices/david.wav',
        previewSampleUrl: 'https://qdfikbgwuauertfmkmzk.supabase.co/storage/v1/object/public/voice-samples/david/henry_miller_sample.mp3',
        category: 'male',
        enabled: true,
    },
    {
        id: 'elisabeth',
        displayName: 'Elisabeth',
        description: 'Female narrator voice',
        sampleAudioUrl: 'https://qdfikbgwuauertfmkmzk.supabase.co/storage/v1/object/public/voices/elisabeth.wav',
        previewSampleUrl: 'https://qdfikbgwuauertfmkmzk.supabase.co/storage/v1/object/public/voice-samples/elisabeth/henry_miller_sample.mp3',
        category: 'female',
        enabled: true,
    },
    {
        id: 'michael',
        displayName: 'Michael',
        description: 'Male narrator voice',
        sampleAudioUrl: 'https://qdfikbgwuauertfmkmzk.supabase.co/storage/v1/object/public/voices/michael.wav',
        previewSampleUrl: 'https://qdfikbgwuauertfmkmzk.supabase.co/storage/v1/object/public/voice-samples/michael/henry_miller_sample.mp3',
        category: 'male',
        enabled: true,
    },
    {
        id: 'peter',
        displayName: 'Peter',
        description: 'Male narrator voice',
        sampleAudioUrl: 'https://qdfikbgwuauertfmkmzk.supabase.co/storage/v1/object/public/voices/peter.wav',
        previewSampleUrl: 'https://qdfikbgwuauertfmkmzk.supabase.co/storage/v1/object/public/voice-samples/peter/henry_miller_sample.mp3',
        category: 'male',
        enabled: true,
    },
    {
        id: 'victor',
        displayName: 'Victor',
        description: 'Male narrator voice',
        sampleAudioUrl: 'https://qdfikbgwuauertfmkmzk.supabase.co/storage/v1/object/public/voices/victor.wav',
        previewSampleUrl: 'https://qdfikbgwuauertfmkmzk.supabase.co/storage/v1/object/public/voice-samples/victor/henry_miller_sample.mp3',
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
    return `https://qdfikbgwuauertfmkmzk.supabase.co/storage/v1/object/public/voice-samples/${voiceId}/henry_miller_sample.mp3`;
}
