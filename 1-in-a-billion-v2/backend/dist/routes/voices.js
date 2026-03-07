"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.voicesRouter = void 0;
const hono_1 = require("hono");
const voices_1 = require("../config/voices");
const router = new hono_1.Hono();
/**
 * GET /api/voices/samples
 *
 * Returns list of all available voices with their Anaïs Nin quote samples.
 * Frontend uses this to display voice selector with preview audio.
 */
router.get('/samples', async (c) => {
    const voices = (0, voices_1.getEnabledVoices)().map((voice) => ({
        id: voice.id,
        displayName: voice.displayName,
        description: voice.description,
        category: voice.category,
        sampleUrl: voice.previewSampleUrl || (0, voices_1.getVoiceSampleUrl)(voice.id),
        isTurboPreset: voice.isTurboPreset || false,
        turboVoiceId: voice.turboVoiceId,
    }));
    // Sort: Custom voices first, then Turbo presets (alphabetically within each group)
    voices.sort((a, b) => {
        if (a.isTurboPreset !== b.isTurboPreset) {
            return a.isTurboPreset ? 1 : -1; // Custom first
        }
        return a.displayName.localeCompare(b.displayName);
    });
    return c.json({
        success: true,
        voices,
        quote: 'My first vision of earth was water veiled...',
        quoteAuthor: 'Anaïs Nin, House of Incest',
    });
});
/**
 * GET /api/voices/:id
 *
 * Get details for a specific voice including its sample URL.
 */
router.get('/:id', async (c) => {
    const voiceId = c.req.param('id');
    const voice = voices_1.VOICES.find((v) => v.id === voiceId);
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
            sampleUrl: voice.previewSampleUrl || (0, voices_1.getVoiceSampleUrl)(voice.id),
            cloningSampleUrl: voice.sampleAudioUrl, // WAV for RunPod training
        },
    });
});
exports.voicesRouter = router;
//# sourceMappingURL=voices.js.map