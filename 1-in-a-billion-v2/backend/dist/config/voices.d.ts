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
    repetition_penalty?: number;
}
export interface Voice {
    id: string;
    displayName: string;
    description: string;
    sampleAudioUrl: string;
    cloneAudioUrl?: string;
    previewSampleUrl?: string;
    category?: 'male' | 'female' | 'neutral';
    enabled?: boolean;
    isTurboPreset?: boolean;
    turboVoiceId?: string;
    turboSettings?: TurboVoiceSettings;
    minimaxClonedVoiceId?: string;
}
/**
 * Standard quote used for all voice samples.
 * From Anaïs Nin's "House of Incest"
 * See: docs/PREVIEW_Speaker_text.md for full text
 */
export declare const VOICE_SAMPLE_QUOTE = "My first vision of earth was water veiled. I am of the race of men and women who see things through this curtain of sea, and my eyes are the color of water. I looked with chameleon eyes upon the changing face of the world, looked with anonymous vision upon my uncompleted self. I remember my first birth in water. All round me a sulphurous transparency and my bones move as if made of rubber. I sway and float, stand on boneless toes listening for distant sounds, sounds beyond the reach of human ears, see things beyond the reach of human eyes. Born full of memories of the bells of Atlantide. Always listening for lost sounds and searching for lost colors, standing forever on the threshold like one troubled with memories, and walking with a swimming stride. I cut the air with wideslicing fins, and swim through wall-less rooms. The night surrounded me, a photograph unglued from its frame. The lining of a coat ripped open like the two shells of an oyster. The day and night unglued, and I falling in between not knowing on which layer I was resting, whether it was the cold upper leaf of dawn, or the dark layer of night.";
/**
 * Short transcript matching the first 8 seconds of each voice clone clip.
 * MiniMax clone_prompt requires prompt_text to align with prompt_audio.
 */
export declare const VOICE_CLONE_TRANSCRIPT = "My first vision of earth was water veiled. I am of the race of men and women who see things through this curtain of sea, and my eyes are the color of water.";
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
export declare const VOICES: Voice[];
/**
 * Get voice by ID
 */
export declare function getVoiceById(id: string): Voice | undefined;
/**
 * Get all enabled voices
 */
export declare function getEnabledVoices(): Voice[];
/**
 * Get voice sample URL (for frontend previews - returns MP3)
 */
export declare function getVoiceSampleUrl(voiceId: string): string;
/**
 * Check if voice is a Turbo preset (no cloning needed)
 */
export declare function isTurboPresetVoice(voiceId: string): boolean;
/**
 * Get custom voices only (exclude Turbo presets)
 */
export declare function getCustomVoices(): Voice[];
/**
 * Get Turbo preset voices only
 */
export declare function getTurboPresetVoices(): Voice[];
//# sourceMappingURL=voices.d.ts.map