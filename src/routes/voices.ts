import { Hono } from 'hono';
import { VOICES, getEnabledVoices, getVoiceSampleUrl } from '../config/voices';

const router = new Hono();

/**
 * GET /api/voices/samples
 * 
 * Returns list of all available voices with their Henry Miller quote samples.
 * Frontend uses this to display voice selector with preview audio.
 */
router.get('/samples', async (c) => {
    const voices = getEnabledVoices().map((voice) => ({
        id: voice.id,
        displayName: voice.displayName,
        description: voice.description,
        category: voice.category,
        sampleUrl: voice.previewSampleUrl || getVoiceSampleUrl(voice.id),
    }));

    return c.json({
        success: true,
        voices,
        quote: 'I need to be alone. I need to ponder my shame and my despair in seclusion...',
        quoteAuthor: 'Henry Miller, Tropic of Cancer',
    });
});

/**
 * GET /api/voices/:id
 * 
 * Get details for a specific voice including its sample URL.
 */
router.get('/:id', async (c) => {
    const voiceId = c.req.param('id');
    const voice = VOICES.find((v) => v.id === voiceId);

    if (!voice || voice.enabled === false) {
        return c.json({
            success: false,
            message: `Voice '${voiceId}' not found`,
        }, 404);
    }

    return c.json({
        success: true,
        voice: {
            id: voice.id,
            displayName: voice.displayName,
            description: voice.description,
            category: voice.category,
            sampleUrl: voice.previewSampleUrl || getVoiceSampleUrl(voice.id),
            cloningSampleUrl: voice.sampleAudioUrl, // WAV for RunPod training
        },
    });
});

export const voicesRouter = router;
