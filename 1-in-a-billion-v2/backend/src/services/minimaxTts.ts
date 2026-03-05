import axios from 'axios';
import FormData from 'form-data';
import * as tar from 'tar-stream';
import { apiKeys } from './apiKeysHelper';
import { env } from '../config/env';
import { VOICE_CLONE_TRANSCRIPT } from '../config/voices';

/**
 * Uploads a reference audio file to MiniMax.
 *
 * @param purpose - MiniMax upload purpose:
 *   - 'prompt_audio': For inline clone_prompt in T2A calls (audio must be <8s)
 *   - 'voice_clone':  For dedicated Voice Clone API registration (audio must be 10s-5min)
 */
async function uploadReferenceAudio(wavBuffer: Buffer, filename: string = 'reference.wav', purpose: 'prompt_audio' | 'voice_clone' = 'prompt_audio'): Promise<string> {
    const key = await apiKeys.minimax().catch(() => null) || env.MINIMAX_API_KEY;
    if (!key) throw new Error("MiniMax API key not found");

    console.log(`[MiniMax TTS] Uploading reference audio (${filename}, purpose=${purpose})...`);

    const form = new FormData();
    form.append('file', wavBuffer, { filename, contentType: 'audio/wav' });
    form.append('purpose', purpose);

    const upRes = await axios.post('https://api.minimax.io/v1/files/upload', form, {
        headers: { ...form.getHeaders(), 'Authorization': `Bearer ${key}` }
    });

    if (upRes.data.base_resp?.status_code !== 0) {
        throw new Error(`MiniMax upload failed: ${upRes.data.base_resp?.status_msg}`);
    }

    const fileId = upRes.data.file?.file_id;
    if (!fileId) throw new Error("MiniMax did not return a file_id after upload");

    console.log(`[MiniMax TTS] Upload successful: fileId=${fileId}`);
    return fileId;
}

/**
 * Downloads a wav file from a URL and uploads it to MiniMax
 */
export async function getMinimaxSequenceForUrl(url: string, filename: string): Promise<string> {
    const res = await axios.get(url, { responseType: 'arraybuffer' });
    return uploadReferenceAudio(Buffer.from(res.data), filename);
}

/**
 * Generates an MP3 using the MiniMax T2A Async API.
 *
 * @param language - ISO 639-1 language code (e.g. 'en', 'de', 'ja') for language_boost.
 *                   Enables cross-lingual voice cloning so cloned voices speak the target language natively.
 */
export async function generateMinimaxAsync(
    text: string,
    voiceId: string,
    clonePromptFileId?: string,
    speed: number = 1.0,
    volume: number = 1.0,
    language?: string,
): Promise<Buffer> {
    try {
        const apiKey = await apiKeys.minimax().catch(() => null) || env.MINIMAX_API_KEY;
        if (!apiKey) throw new Error("MiniMax API key not found");

        // Model selection: speech-01-turbo produces better voice cloning for English.
        // speech-02-turbo has superior cross-lingual support (Japanese, German, etc.).
        // Auto-select based on language, with env override available.
        const isEnglish = !language || language === 'en';
        const model = process.env.MINIMAX_TTS_MODEL || (isEnglish ? 'speech-01-turbo' : 'speech-02-turbo');

        console.log(`[MiniMax TTS] Submitting Async task for ${text.length} chars (model=${model}, lang=${language || 'auto'})...`);

        const payload: any = {
            model,
            text: text,
            voice_setting: {
                voice_id: voiceId,
                speed: speed,
                vol: volume
            },
            audio_setting: { sample_rate: 44100, format: 'mp3', bit_rate: 128000 },
            // language_boost tells MiniMax what language to synthesize.
            // Critical for cross-lingual voice cloning (e.g. English voice speaking Japanese).
            language_boost: language || 'auto',
        };

        if (clonePromptFileId) {
            // Voice cloning via clone_prompt in T2A v2:
            // - prompt_audio: the uploaded reference audio file_id
            // - prompt_text: transcript of that audio (helps MiniMax align the clone)
            // The base voice_id (e.g. English_expressive_narrator) stays as scaffolding —
            // clone_prompt modulates it to sound like the reference speaker.
            // NOTE: timber_weights only accepts MiniMax system voice IDs, NOT file IDs.
            payload.clone_prompt = {
                prompt_audio: clonePromptFileId,
                prompt_text: VOICE_CLONE_TRANSCRIPT,
            };
            console.log(`[MiniMax TTS] Clone prompt set: audio=${clonePromptFileId}, transcript=${VOICE_CLONE_TRANSCRIPT.substring(0, 60)}...`);
        }

        const submitRes = await axios.post('https://api.minimax.io/v1/t2a_async_v2', payload, {
            headers: { 'Authorization': `Bearer ${apiKey}` } // Use the actual dynamically fetched key
        });

        if (submitRes.data.base_resp?.status_code !== 0) {
            throw new Error(`MiniMax T2A Async failed: ${submitRes.data.base_resp?.status_msg}`);
        }

        const taskId = submitRes.data.task_id;
        console.log(`[MiniMax TTS] Task ID: ${taskId}. Waiting for completion...`);

        // Poll for completion with timeout (20 minutes max for very long readings)
        const MAX_POLL_MS = parseInt(process.env.MINIMAX_POLL_TIMEOUT_MS || '1200000', 10); // 20 min default
        const POLL_INTERVAL_MS = 3000;
        const pollStart = Date.now();
        let pollCount = 0;

        while (true) {
            const elapsed = Date.now() - pollStart;
            if (elapsed > MAX_POLL_MS) {
                throw new Error(`MiniMax T2A Async timed out after ${Math.round(elapsed / 1000)}s (task_id: ${taskId}). The task may still be processing on MiniMax's side.`);
            }

            const fetchRes = await axios.get(`https://api.minimax.io/v1/query/t2a_async_query_v2?task_id=${taskId}`, {
                headers: { 'Authorization': `Bearer ${apiKey}` }
            });

            const status = fetchRes.data.status;
            pollCount++;

            // Log progress every 10 polls (~30s)
            if (pollCount % 10 === 0) {
                console.log(`[MiniMax TTS] Still polling... status=${status}, elapsed=${Math.round(elapsed / 1000)}s, polls=${pollCount}`);
            }

            if (status === 'Success') {
                const outputFileId = fetchRes.data.file_id;
                console.log(`[MiniMax TTS] Completed in ${Math.round(elapsed / 1000)}s (${pollCount} polls). Audio File ID: ${outputFileId}`);

                const retrieveRes = await axios.get(`https://api.minimax.io/v1/files/retrieve?file_id=${outputFileId}`, {
                    headers: { 'Authorization': `Bearer ${apiKey}` }
                });

                const downloadUrl = retrieveRes.data.file?.download_url;
                if (!downloadUrl) throw new Error('MiniMax did not return a download_url for the generated audio');

                console.log(`[MiniMax TTS] Downloading output tar stream...`);
                return await downloadAndExtractMp3FromTar(downloadUrl);
            }

            if (status === 'Fail') {
                throw new Error(`MiniMax T2A Async Task failed on server: ${JSON.stringify(fetchRes.data)}`);
            }

            await new Promise(res => setTimeout(res, POLL_INTERVAL_MS));
        }
    } catch (error) {
        console.error("MiniMax TTS generation error:", error);
        throw error;
    }
}

/**
 * Register a voice clone permanently with MiniMax Voice Clone API.
 *
 * This creates a persistent voice_id that can be used directly in T2A calls
 * without needing clone_prompt. Produces better quality than inline cloning.
 *
 * Requirements:
 * - Audio must be 10s-5min (uploaded with purpose='voice_clone')
 * - voice_id: min 8 chars, alphanumeric, starts with letter, must be unique per account
 * - Registered voices are deleted after 7 days if never used in a T2A call
 * - Limit: ~4 registered voices per account (use them wisely)
 *
 * @returns The registered voice_id (same as input) and optional demo audio URL
 */
export async function registerVoiceClone(
    audioFileId: string,
    voiceId: string,
    model: string = 'speech-01-turbo'
): Promise<{ success: boolean; voiceId: string; demoAudio?: string }> {
    const key = await apiKeys.minimax().catch(() => null) || env.MINIMAX_API_KEY;
    if (!key) throw new Error("MiniMax API key not found");

    // Validate voice_id format (min 8 chars, alphanumeric, starts with letter)
    if (voiceId.length < 8 || !/^[a-zA-Z][a-zA-Z0-9]*$/.test(voiceId)) {
        throw new Error(`Invalid voice_id "${voiceId}": must be 8+ chars, alphanumeric, start with letter`);
    }

    console.log(`[MiniMax] Registering voice clone: ${voiceId} (model=${model})...`);

    const res = await axios.post('https://api.minimax.io/v1/voice_clone', {
        file_id: audioFileId,
        voice_id: voiceId,
        model,
        need_noise_reduction: false,
        need_volumn_normalization: true, // Note: MiniMax spells it "volumn"
    }, {
        headers: { 'Authorization': `Bearer ${key}`, 'Content-Type': 'application/json' }
    });

    if (res.data.base_resp?.status_code !== 0) {
        throw new Error(`MiniMax voice clone registration failed: ${res.data.base_resp?.status_msg}`);
    }

    console.log(`[MiniMax] Voice clone registered successfully: ${voiceId}`);
    return { success: true, voiceId, demoAudio: res.data.demo_audio };
}

/**
 * Upload audio for Voice Clone API registration (requires 10s-5min audio).
 * Use this with registerVoiceClone() for permanent voice registration.
 */
export async function uploadForVoiceClone(wavBuffer: Buffer, filename: string = 'reference.wav'): Promise<string> {
    return uploadReferenceAudio(wavBuffer, filename, 'voice_clone');
}

async function downloadAndExtractMp3FromTar(url: string): Promise<Buffer> {
    return new Promise(async (resolve, reject) => {
        try {
            const res = await axios.get(url, { responseType: 'stream' });
            const extract = tar.extract();

            let found = false;
            extract.on('entry', (header, stream, next) => {
                if (header.name.endsWith('.mp3')) {
                    const chunks: Buffer[] = [];
                    stream.on('data', chunk => chunks.push(chunk));
                    stream.on('end', () => {
                        found = true;
                        resolve(Buffer.concat(chunks));
                        next();
                    });
                } else {
                    stream.on('end', () => next());
                    stream.resume();
                }
            });

            extract.on('finish', () => {
                if (!found) reject(new Error('MP3 file not found inside the MiniMax output tar stream'));
            });

            extract.on('error', (err) => reject(err));
            res.data.pipe(extract);
        } catch (e) {
            reject(e);
        }
    });
}
