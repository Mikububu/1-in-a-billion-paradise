/**
 * AUDIO WORKER - TTS Generation
 *
 * Processes audio_generation tasks:
 * - Reads text from Storage artifact (full reading ~8000 chars)
 * - Routes to active TTS provider (MiniMax by default, Replicate as fallback)
 * - MiniMax: Sends full text in one call, outputs single MP3
 *   - Supports cross-lingual voice cloning via language_boost + native base voices
 * - Replicate/Chatterbox: Chunks text, processes sequentially, concatenates WAV→MP3
 *   - Dormant fallback (activate via active_tts_provider='replicate' in api_keys)
 * - Uploads artifact to Supabase Storage
 */
import { BaseWorker, TaskResult } from './baseWorker';
import { JobTask } from '../services/supabaseClient';
export declare class AudioWorker extends BaseWorker {
    private runpodApiKey;
    private runpodEndpointId;
    private voiceSampleUrl;
    constructor();
    protected processTask(task: JobTask): Promise<TaskResult>;
}
//# sourceMappingURL=audioWorker.d.ts.map