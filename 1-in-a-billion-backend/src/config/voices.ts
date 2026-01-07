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
    sampleAudioUrl: string;  // URL to voice sample WAV for Chatterbox cloning
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
 * 1. Upload voice sample to voices/{voice_id}_sample.wav in Supabase Storage
 * 2. Add voice to this array
 * 3. Run: npx ts-node src/scripts/generate_voice_samples.ts --voice={voice_id}
 */
export const VOICES: Voice[] = [
    {
        id: 'anabella',
        displayName: 'Anabella',
        description: 'Warm female narrator with gentle tone',
        sampleAudioUrl: 'https://qdfikbgwuauertfmkmzk.supabase.co/storage/v1/object/public/voices/Anabella.wav',
        category: 'female',
        enabled: true,
    },
    {
        id: 'dorothy',
        displayName: 'Dorothy',
        description: 'Clear female voice with sophisticated tone',
        sampleAudioUrl: 'https://qdfikbgwuauertfmkmzk.supabase.co/storage/v1/object/public/voices/Dorothy.wav',
        category: 'female',
        enabled: true,
    },
    {
        id: 'ludwig',
        displayName: 'Ludwig',
        description: 'Deep male narrator with authoritative presence',
        sampleAudioUrl: 'https://qdfikbgwuauertfmkmzk.supabase.co/storage/v1/object/public/voices/Ludwig.wav',
        category: 'male',
        enabled: true,
    },
    {
        id: 'grandpa',
        displayName: 'Grandpa',
        description: 'Legendary documentary narrator voice',
        sampleAudioUrl: 'https://qdfikbgwuauertfmkmzk.supabase.co/storage/v1/object/public/voices/grandpa_15sec.wav',
        category: 'male',
        enabled: true,
    },
    {
        id: 'default',
        displayName: 'Default',
        description: 'Deprecated - Same as Grandpa (David A voice)',
        sampleAudioUrl: 'https://qdfikbgwuauertfmkmzk.supabase.co/storage/v1/object/public/voices/voice_10sec.wav',
        category: 'male',
        enabled: false, // Disabled - duplicate of Grandpa
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
 * Get voice sample URL (generated with Henry Miller quote)
 */
export function getVoiceSampleUrl(voiceId: string): string {
    return `https://qdfikbgwuauertfmkmzk.supabase.co/storage/v1/object/public/voice-samples/${voiceId}/henry_miller_sample.mp3`;
}
