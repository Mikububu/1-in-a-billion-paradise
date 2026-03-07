/**
 * VEDIC ARTIFACT WORKER (Audio)
 *
 * Responsibilities:
 * 1. Poll vedic_job_artifacts for pending 'audio' tasks.
 * 2. Fetch Match Data (Score) & Profile Data (Names).
 * 3. Generate Audio via VedicAudioGenerator (OpenAI -> LameJS).
 * 4. Upload to Supabase Storage.
 * 5. Update Artifact Record.
 */
declare function runWorker(): Promise<void>;
export { runWorker };
//# sourceMappingURL=vedicArtifactWorker.d.ts.map