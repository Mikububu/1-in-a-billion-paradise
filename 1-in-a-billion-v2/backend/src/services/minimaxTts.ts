import axios from 'axios';
import FormData from 'form-data';
import * as tar from 'tar-stream';
import { apiKeys } from './apiKeysHelper';
import { env } from '../config/env';
import { VOICE_SAMPLE_QUOTE } from '../config/voices';

/**
 * Uploads a reference WAV file to MiniMax for voice cloning
 */
async function uploadReferenceAudio(wavBuffer: Buffer, filename: string = 'reference.wav'): Promise<string> {
    const key = await apiKeys.minimax().catch(() => null) || env.MINIMAX_API_KEY;
    if (!key) throw new Error("MiniMax API key not found");

    console.log(`[MiniMax TTS] Uploading reference audio (${filename})...`);

    // Check if it's a URL or a buffer
    const form = new FormData();
    form.append('file', wavBuffer, { filename, contentType: 'audio/wav' });
    form.append('purpose', 'voice_clone');

    const upRes = await axios.post('https://api.minimax.io/v1/files/upload', form, {
        headers: { ...form.getHeaders(), 'Authorization': `Bearer ${key}` }
    });

    if (upRes.data.base_resp?.status_code !== 0) {
        throw new Error(`MiniMax upload failed: ${upRes.data.base_resp?.status_msg}`);
    }

    const fileId = upRes.data.file?.file_id;
    if (!fileId) throw new Error("MiniMax did not return a file_id after upload");

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
 * Generates an MP3 using the MiniMax T2A Async API
 */
export async function generateMinimaxAsync(text: string, voiceId: string, clonePromptFileId?: string, speed: number = 1.0, volume: number = 1.0): Promise<Buffer> {
    try {
        const apiKey = await apiKeys.minimax().catch(() => null) || env.MINIMAX_API_KEY;
        if (!apiKey) throw new Error("MiniMax API key not found");

        console.log(`[MiniMax TTS] Submitting Async task for ${text.length} chars...`);

        const payload: any = {
            model: 'speech-01-turbo',
            text: text,
            voice_setting: {
                voice_id: voiceId,
                speed: speed,
                vol: volume
            },
            audio_setting: { sample_rate: 44100, format: 'mp3', bit_rate: 128000 }
        };

        if (clonePromptFileId) {
            payload.clone_prompt = { prompt_audio: clonePromptFileId };
            // Enforce deep timbre cloning by heavily weighting the clone over the base voice scaffolding.
            payload.voice_setting.timber_weights = [
                { voice_id: voiceId, weight: 1 },
                { voice_id: clonePromptFileId, weight: 15 }
            ];
        }

        const submitRes = await axios.post('https://api.minimax.io/v1/t2a_async_v2', payload, {
            headers: { 'Authorization': `Bearer ${apiKey}` } // Use the actual dynamically fetched key
        });

        if (submitRes.data.base_resp?.status_code !== 0) {
            throw new Error(`MiniMax T2A Async failed: ${submitRes.data.base_resp?.status_msg}`);
        }

        const taskId = submitRes.data.task_id;
        console.log(`[MiniMax TTS] Task ID: ${taskId}. Waiting for completion...`);

        // Poll for completion
        while (true) {
            const fetchRes = await axios.get(`https://api.minimax.io/v1/query/t2a_async_query_v2?task_id=${taskId}`, {
                headers: { 'Authorization': `Bearer ${apiKey}` } // Use the actual dynamically fetched key
            });

            const status = fetchRes.data.status;

            if (status === 'Success') {
                const outputFileId = fetchRes.data.file_id;
                console.log(`[MiniMax TTS] Completed. Audio File ID: ${outputFileId}`);

                const retrieveRes = await axios.get(`https://api.minimax.io/v1/files/retrieve?file_id=${outputFileId}`, {
                    headers: { 'Authorization': `Bearer ${apiKey}` } // Use the actual dynamically fetched key
                });

                const downloadUrl = retrieveRes.data.file?.download_url;
                if (!downloadUrl) throw new Error('MiniMax did not return a download_url for the generated audio');

                console.log(`[MiniMax TTS] Downloading output tar stream...`);
                return await downloadAndExtractMp3FromTar(downloadUrl);
            }

            if (status === 'Fail') {
                throw new Error(`MiniMax T2A Async Task failed on server: ${JSON.stringify(fetchRes.data)}`);
            }

            await new Promise(res => setTimeout(res, 2000));
        }
    } catch (error) {
        console.error("MiniMax TTS generation error:", error);
        throw error;
    }
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
