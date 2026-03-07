/**
 * REGENERATE MICHAEL AUDIO TEST
 *
 * Standalone testing script (not part of the app). Output is saved to your Desktop only;
 * nothing is stored in the app or shown in the app.
 *
 * Regenerates Michael Gene Keys (last rendered reading) in its totality, using Elisabeth's
 * voice - same reading, same voice as original - so you can verify if bad stitching is fixed
 * by comparing the new MP3 to the original.
 *
 * 1. Finds Michael's last rendered reading (Michael Gene Keys)
 * 2. Fetches the full text for that reading from storage
 * 3. Regenerates audio via /api/audio/generate-tts (RunPod Chatterbox, 30ms fade) with Elisabeth
 * 4. Saves M4A to ~/Desktop/michael_genekeys_elisabeth_test_<timestamp>.m4a
 *
 * Run:
 *   1. Start backend: npm run dev
 *   2. In another terminal: npm run regenerate:michael-audio
 *
 * Requires: Supabase + RunPod configured in .env (generate-tts uses RunPod Chatterbox).
 *
 * Why test audio might not arrive:
 *   - Backend not running → preflight fails immediately (start npm run dev first).
 *   - RunPod not configured → TTS returns 500; check RUNPOD_API_KEY, RUNPOD_ENDPOINT_ID.
 *   - No Michael artifact in DB → script exits; "Recent artifacts" shows what we saw.
 *   - TTS timeout → Gene Keys text is long; RunPod can be slow (25 min limit).
 *   - Desktop path wrong → we log DESKTOP and check it exists; fix HOME if needed.
 */
export {};
//# sourceMappingURL=regenerateMichaelAudioTest.d.ts.map