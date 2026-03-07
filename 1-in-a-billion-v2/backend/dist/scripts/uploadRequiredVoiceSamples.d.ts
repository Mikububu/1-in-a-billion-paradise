/**
 * UPLOAD REQUIRED VOICE SAMPLES
 *
 * Uploads the essential voice files needed for the app to run.
 *
 * Required files:
 * 1. Original WAV files in 'voices' bucket (for voice cloning):
 *    - Anabella.wav
 *    - Dorothy.wav
 *    - Ludwig.wav
 *    - grandpa_15sec.wav
 *
 * 2. Generated preview samples in 'voice-samples' bucket (can be regenerated):
 *    - voice-samples/{voiceId}/preview.mp3
 *
 * Usage:
 *   # Upload from local files (if you have them):
 *   npx ts-node src/scripts/uploadRequiredVoiceSamples.ts --local-dir=/path/to/voice/files
 *
 *   # Or just generate preview samples (if WAV files already exist in Supabase):
 *   npx ts-node src/scripts/generate_voice_samples.ts
 */
export {};
//# sourceMappingURL=uploadRequiredVoiceSamples.d.ts.map