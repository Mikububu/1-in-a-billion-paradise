/**
 * UPLOAD VOICE SAMPLES (MP3 ONLY)
 *
 * Uploads MP3 voice samples needed for the app to run.
 *
 * Required MP3 files:
 * - voice-samples/{voiceId}/preview.mp3
 *
 * These MP3 files are used for:
 * 1. Frontend previews (voice selection UI)
 * 2. Voice cloning (RunPod accepts MP3 URLs)
 *
 * Usage:
 *   # Upload from local directory:
 *   npx ts-node src/scripts/uploadVoiceSamplesMP3.ts --local-dir=/path/to/mp3/files
 *
 *   # Or generate them (if you have the original WAV files):
 *   npx ts-node src/scripts/generate_voice_samples.ts
 */
export {};
//# sourceMappingURL=uploadVoiceSamplesMP3.d.ts.map