export const AUDIO_CONFIG = {
    // ElevenLabs Voice IDs
    voices: {
        david: 'CyPUt5r578x3aQ7qJq01', // Onyx (Deep, masculine)
        elisabeth: 'EXAVITQu4vr4xnSDxMaL', // Bella (Soft, feminine)
        michael: 'flq6f7yk4E4fJM5XTYuZ', // Michael (Custom)
        peter: 'VR6AewGX3Rex9jK2Qy7l', // Peter (Custom)
        victor: 'JBFqnCBsd6RMkjVDRZzb', // Victor (Custom)
    },
    defaultVoice: 'david',
    stability: 0.5,
    similarity_boost: 0.75,
    model_id: 'eleven_multilingual_v2',
    exaggeration: 0.3, // PROSODY: Increase this for more dramatic readings
};

export const READING_LIMITS = {
    hook: {
        minWords: 300,
        maxWords: 450, // ~2-3 minutes of audio
    },
    daily: {
        minWords: 150,
        maxWords: 300,
    },
};

export const LLM_CONFIG = {
    model: 'gpt-4o', // Use the best model for creative writing
    temperature: 0.8, // Slightly creative but grounded
    max_tokens: 2000,
};

// Map internal signs to display labels/emojis if needed
export const SIGN_LABELS: Record<string, string> = {
    Aries: 'Aries ♈',
    Taurus: 'Taurus ♉',
    Gemini: 'Gemini ♊',
    Cancer: 'Cancer ♋',
    Leo: 'Leo ♌',
    Virgo: 'Virgo ♍',
    Libra: 'Libra ♎',
    Scorpio: 'Scorpio ♏',
    Sagittarius: 'Sagittarius ♐',
    Capricorn: 'Capricorn ♑',
    Aquarius: 'Aquarius ♒',
    Pisces: 'Pisces ♓',
};
