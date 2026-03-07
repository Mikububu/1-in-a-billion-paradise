"use strict";
/**
 * AUDIOBOOK QUEUE WORKER - Persistent GPU Worker
 *
 * This worker runs continuously on a persistent GPU pod and processes
 * audiobook chapters from the queue. It replaces the serverless /runsync
 * approach which fails at scale.
 *
 * Architecture:
 * - Pulls chapters from audiobook_chapters queue (FOR UPDATE SKIP LOCKED)
 * - Processes ONE chapter at a time (sequential, not parallel)
 * - Chunks text, generates audio via RunPod, concatenates chunks
 * - Uploads final audio to Supabase Storage
 * - Marks chapter as complete
 * - Loops to get next chapter
 *
 * This decouples user concurrency from GPU concurrency:
 * - Thousands of users can queue jobs
 * - Only N workers process them (where N = number of GPU pods)
 *
 * Date: December 27, 2025
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AudiobookQueueWorker = void 0;
const axios_1 = __importDefault(require("axios"));
const child_process_1 = require("child_process");
const promises_1 = __importDefault(require("fs/promises"));
const os_1 = __importDefault(require("os"));
const path_1 = __importDefault(require("path"));
const supabaseClient_1 = require("../services/supabaseClient");
const env_1 = require("../config/env");
const apiKeysHelper_1 = require("../services/apiKeysHelper");
const audioProcessing_1 = require("../services/audioProcessing");
// ─────────────────────────────────────────────────────────────────────────────
// NOTE: Text chunking and WAV concatenation logic now imported from shared audioProcessing module
// To adjust chunking or crossfade behavior, edit: src/services/audioProcessing.ts
// ─────────────────────────────────────────────────────────────────────────────
// ─────────────────────────────────────────────────────────────────────────────
// WAV Header Parsing (for duration calculation)
// ─────────────────────────────────────────────────────────────────────────────
function parseWavHeader(buffer) {
    if (buffer.length < 44)
        return null;
    if (buffer.toString('ascii', 0, 4) !== 'RIFF')
        return null;
    if (buffer.toString('ascii', 8, 12) !== 'WAVE')
        return null;
    let offset = 12;
    let audioFormat = 1, numChannels = 1, sampleRate = 24000, bitsPerSample = 16;
    let dataOffset = 0, dataSize = 0;
    while (offset < buffer.length - 8) {
        const chunkId = buffer.toString('ascii', offset, offset + 4);
        const chunkSize = buffer.readUInt32LE(offset + 4);
        if (chunkId === 'fmt ') {
            audioFormat = buffer.readUInt16LE(offset + 8);
            numChannels = buffer.readUInt16LE(offset + 10);
            sampleRate = buffer.readUInt32LE(offset + 12);
            bitsPerSample = buffer.readUInt16LE(offset + 22);
        }
        else if (chunkId === 'data') {
            dataOffset = offset + 8;
            dataSize = chunkSize;
            break;
        }
        offset += 8 + chunkSize;
        if (chunkSize % 2 === 1)
            offset++;
    }
    if (dataOffset === 0)
        return null;
    return { audioFormat, numChannels, sampleRate, bitsPerSample, dataOffset, dataSize };
}
// ─────────────────────────────────────────────────────────────────────────────
// FFmpeg Conversion
// ─────────────────────────────────────────────────────────────────────────────
async function runFfmpeg(args) {
    await new Promise((resolve, reject) => {
        const proc = (0, child_process_1.spawn)('ffmpeg', ['-y', ...args], { stdio: ['ignore', 'ignore', 'pipe'] });
        let stderr = '';
        proc.stderr.on('data', (d) => (stderr += d.toString()));
        proc.on('error', (err) => reject(err));
        proc.on('close', (code) => {
            if (code === 0)
                return resolve();
            reject(new Error(`ffmpeg failed (code=${code}): ${stderr.slice(-500)}`));
        });
    });
}
async function convertWavToM4a(wav) {
    const dir = await promises_1.default.mkdtemp(path_1.default.join(os_1.default.tmpdir(), 'iab-audio-'));
    const inPath = path_1.default.join(dir, 'in.wav');
    const outPath = path_1.default.join(dir, 'out.m4a');
    try {
        await promises_1.default.writeFile(inPath, wav);
        await runFfmpeg(['-i', inPath, '-vn', '-c:a', 'aac', '-b:a', '96k', outPath]);
        const m4a = await promises_1.default.readFile(outPath);
        console.log(`WAV->M4A: ${Math.round(wav.length / 1024)}KB -> ${Math.round(m4a.length / 1024)}KB`);
        return m4a;
    }
    finally {
        await promises_1.default.rm(dir, { recursive: true, force: true }).catch(() => { });
    }
}
// ─────────────────────────────────────────────────────────────────────────────
// RunPod TTS Generation
// ─────────────────────────────────────────────────────────────────────────────
async function generateChunkAudio(chunk, index, totalChunks, runpodApiKey, runpodEndpointId, voiceSampleUrl) {
    console.log(`  Chunk ${index + 1}/${totalChunks} (${chunk.length} chars)`);
    const response = await axios_1.default.post(`https://api.runpod.ai/v2/${runpodEndpointId}/run`, {
        input: {
            text: chunk,
            audio_url: voiceSampleUrl,
            exaggeration: 0.3,
            cfg_weight: 0.5,
        },
    }, {
        headers: {
            Authorization: `Bearer ${runpodApiKey}`,
            'Content-Type': 'application/json',
        },
        timeout: 180000,
    });
    const data = response.data || {};
    // RunPod /run returns async job ID
    if (data.id && data.status && data.status !== 'COMPLETED') {
        console.log(`  ⏳ RunPod async job ${data.id}, status: ${data.status}, polling...`);
        // Poll for completion
        const maxPollAttempts = 240; // 240 * 5s = 20 minutes max
        for (let pollAttempt = 0; pollAttempt < maxPollAttempts; pollAttempt++) {
            await new Promise(resolve => setTimeout(resolve, 5000)); // Poll every 5 seconds
            if (pollAttempt > 0 && pollAttempt % 20 === 0) {
                console.log(`  🔍 Poll attempt ${pollAttempt}/${maxPollAttempts}`);
            }
            const statusResp = await axios_1.default.get(`https://api.runpod.ai/v2/${runpodEndpointId}/status/${data.id}`, {
                headers: { Authorization: `Bearer ${runpodApiKey}` },
                timeout: 10000,
            });
            const statusData = statusResp.data || {};
            if (statusData.status === 'COMPLETED') {
                console.log(`  ✅ RunPod job ${data.id} completed, fetching result...`);
                // Fetch the result (same endpoint, just different status)
                if (statusData.output?.audio_base64) {
                    console.log(`  ✅ Chunk ${index + 1} done (async)`);
                    return Buffer.from(statusData.output.audio_base64, 'base64');
                }
                if (statusData.output?.audio_url) {
                    const audioResp = await axios_1.default.get(statusData.output.audio_url, {
                        responseType: 'arraybuffer',
                        timeout: 60000,
                    });
                    const buf = Buffer.from(audioResp.data);
                    console.log(`  ✅ Chunk ${index + 1} done (async audio_url, ${buf.length} bytes)`);
                    return buf;
                }
                throw new Error(`RunPod job completed but no audio in result`);
            }
            else if (statusData.status === 'FAILED') {
                throw new Error(`RunPod job failed: ${statusData.error || 'Unknown error'}`);
            }
        }
        throw new Error(`RunPod job ${data.id} timed out after ${maxPollAttempts * 5}s`);
    }
    // Synchronous response (shouldn't happen with /run, but handle it)
    if (data?.output?.audio_base64) {
        console.log(`  ✅ Chunk ${index + 1} done (sync)`);
        return Buffer.from(data.output.audio_base64, 'base64');
    }
    throw new Error(`No audio_base64 in RunPod response`);
}
// ─────────────────────────────────────────────────────────────────────────────
// AudiobookQueueWorker Class
// ─────────────────────────────────────────────────────────────────────────────
class AudiobookQueueWorker {
    constructor(options) {
        this.running = false;
        this.workerId = options?.workerId || `audiobook-worker-${os_1.default.hostname()}-${process.pid}`;
        this.pollingIntervalMs = options?.pollingIntervalMs || 5000; // 5 seconds
        // API keys will be fetched from Supabase on first use
        // Fallback to env vars if Supabase unavailable
        this.runpodApiKey = env_1.env.RUNPOD_API_KEY;
        this.runpodEndpointId = env_1.env.RUNPOD_ENDPOINT_ID;
        this.voiceSampleUrl =
            env_1.env.VOICE_SAMPLE_URL ||
                'https://qdfikbgwuauertfmkmzk.supabase.co/storage/v1/object/public/voices/david.wav';
        console.log(`🤖 AudiobookQueueWorker initialized: ${this.workerId}`);
    }
    /**
     * Start worker loop (blocking)
     */
    async start() {
        if (!supabaseClient_1.supabase) {
            throw new Error('Supabase not configured');
        }
        this.running = true;
        console.log(`▶️ AudiobookQueueWorker started: ${this.workerId}`);
        while (this.running) {
            try {
                // Claim ONE chapter from queue
                const { data: chapters, error } = await supabaseClient_1.supabase.rpc('claim_audiobook_chapter', {
                    p_worker_id: this.workerId,
                    p_max_chapters: 1,
                });
                if (error) {
                    console.error('Failed to claim chapter:', error);
                    await this.sleep(10000);
                    continue;
                }
                if (!chapters || chapters.length === 0) {
                    // No work available, wait before polling again
                    await this.sleep(this.pollingIntervalMs);
                    continue;
                }
                const chapter = chapters[0];
                console.log(`📋 Claimed chapter ${chapter.chapter_index} from job ${chapter.job_id}`);
                // Process the chapter
                await this.processChapter(chapter);
            }
            catch (error) {
                console.error('❌ Worker loop error:', error.message);
                await this.sleep(10000); // Cool down on error
            }
        }
        console.log(`⏹ AudiobookQueueWorker stopped: ${this.workerId}`);
    }
    /**
     * Stop worker gracefully
     */
    stop() {
        console.log(`⏸ Stopping worker: ${this.workerId}`);
        this.running = false;
    }
    /**
     * Process a single chapter
     */
    async processChapter(chapter) {
        try {
            console.log(`🎤 Processing chapter ${chapter.chapter_index}: "${chapter.title || 'Untitled'}"`);
            // Get text content - may be stored directly or need to download from storage
            let text = chapter.text;
            // If text starts with 'ARTIFACT_PATH:', download from storage
            if (text.startsWith('ARTIFACT_PATH:')) {
                const artifactPath = text.substring('ARTIFACT_PATH:'.length);
                console.log(`   Downloading text from storage: ${artifactPath}`);
                const { data, error } = await supabaseClient_1.supabase.storage
                    .from('job-artifacts')
                    .download(artifactPath);
                if (error || !data) {
                    throw new Error(`Failed to download text artifact: ${error?.message || 'No data'}`);
                }
                text = Buffer.from(await data.arrayBuffer()).toString('utf-8');
                console.log(`   Downloaded ${text.length} chars from storage`);
            }
            else {
                console.log(`   Text length: ${text.length} chars`);
            }
            if (!text || text.length === 0) {
                throw new Error('No text content available for chapter');
            }
            // Chunk text
            const chunks = (0, audioProcessing_1.splitIntoChunks)(text, audioProcessing_1.AUDIO_CONFIG.CHUNK_MAX_LENGTH);
            console.log(`   Split into ${chunks.length} chunks`);
            // Fetch RunPod keys from Supabase (with env fallback)
            const runpodKey = await apiKeysHelper_1.apiKeys.runpod().catch(() => this.runpodApiKey);
            const runpodEndpoint = await apiKeysHelper_1.apiKeys.runpodEndpoint().catch(() => this.runpodEndpointId);
            if (!runpodKey || !runpodEndpoint) {
                throw new Error('RunPod API key or endpoint ID not found (check Supabase api_keys table or .env)');
            }
            // Generate audio for each chunk SEQUENTIALLY (not parallel!)
            // This is critical: we process one chunk at a time to avoid overwhelming RunPod
            const audioChunks = [];
            for (let i = 0; i < chunks.length; i++) {
                const audioChunk = await generateChunkAudio(chunks[i], i, chunks.length, runpodKey, runpodEndpoint, this.voiceSampleUrl);
                audioChunks.push(audioChunk);
            }
            // Concatenate WAV chunks
            console.log(`   Concatenating ${audioChunks.length} audio chunks...`);
            const concatenatedWav = (0, audioProcessing_1.concatenateWavBuffers)(audioChunks);
            // Convert to M4A (primary format only, no MP3)
            const finalAudio = await convertWavToM4a(concatenatedWav);
            const audioFormat = 'm4a';
            const storageExtension = 'm4a';
            console.log(`   Final audio: ${Math.round(finalAudio.length / 1024)}KB (${audioFormat})`);
            // Get job to determine user_id and storage path
            const { data: job, error: jobError } = await supabaseClient_1.supabase
                .from('audiobook_jobs')
                .select('user_id')
                .eq('id', chapter.job_id)
                .single();
            if (jobError || !job) {
                throw new Error(`Failed to get job: ${jobError?.message}`);
            }
            // Upload to Storage
            const storagePath = `${job.user_id}/${chapter.job_id}/chapters/${chapter.chapter_id}.${storageExtension}`;
            const contentType = 'audio/mp4';
            const { error: uploadError } = await supabaseClient_1.supabase.storage
                .from('job-artifacts')
                .upload(storagePath, finalAudio, {
                contentType,
                upsert: true,
            });
            if (uploadError) {
                throw new Error(`Storage upload failed: ${uploadError.message}`);
            }
            // Get public URL
            const { data: urlData } = supabaseClient_1.supabase.storage
                .from('job-artifacts')
                .getPublicUrl(storagePath);
            const audioUrl = urlData.publicUrl;
            // Calculate duration (rough estimate: assume ~24000 samples/sec, 16-bit PCM)
            // This is approximate - for exact duration, we'd need to decode the MP3/M4A
            const wavHeader = parseWavHeader(concatenatedWav);
            const durationSeconds = wavHeader
                ? Math.round(wavHeader.dataSize / (wavHeader.sampleRate * wavHeader.numChannels * 2))
                : null;
            // Mark chapter as complete
            const { error: completeError } = await supabaseClient_1.supabase.rpc('complete_audiobook_chapter', {
                p_chapter_id: chapter.chapter_id,
                p_audio_url: audioUrl,
                p_audio_format: audioFormat,
                p_duration_seconds: durationSeconds,
                p_error: null,
            });
            if (completeError) {
                throw new Error(`Failed to complete chapter: ${completeError.message}`);
            }
            console.log(`✅ Chapter ${chapter.chapter_index} complete: ${audioUrl}`);
        }
        catch (error) {
            console.error(`❌ Chapter processing failed: ${error.message}`);
            // Mark chapter as failed
            const { error: failError } = await supabaseClient_1.supabase.rpc('complete_audiobook_chapter', {
                p_chapter_id: chapter.chapter_id,
                p_audio_url: null,
                p_audio_format: null,
                p_duration_seconds: null,
                p_error: error.message || 'Unknown error',
            });
            if (failError) {
                console.error(`Failed to mark chapter as failed: ${failError.message}`);
            }
        }
    }
    /**
     * Helper: Sleep
     */
    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}
exports.AudiobookQueueWorker = AudiobookQueueWorker;
// ─────────────────────────────────────────────────────────────────────────────
// Main Entry Point (if run directly)
// ─────────────────────────────────────────────────────────────────────────────
if (require.main === module) {
    async function main() {
        console.log('🚀 Starting Audiobook Queue Worker...');
        const worker = new AudiobookQueueWorker({
            pollingIntervalMs: 5000,
        });
        // Handle graceful shutdown
        process.on('SIGINT', () => {
            console.log('\n🛑 Received SIGINT, shutting down gracefully...');
            worker.stop();
            process.exit(0);
        });
        process.on('SIGTERM', () => {
            console.log('\n🛑 Received SIGTERM, shutting down gracefully...');
            worker.stop();
            process.exit(0);
        });
        // Start worker (blocking)
        await worker.start();
    }
    main().catch((error) => {
        console.error('❌ Fatal error:', error);
        process.exit(1);
    });
}
//# sourceMappingURL=audiobookQueueWorker.js.map