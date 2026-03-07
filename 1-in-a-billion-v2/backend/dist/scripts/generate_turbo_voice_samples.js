#!/usr/bin/env node
"use strict";
/**
 * TURBO VOICE SAMPLE GENERATION SCRIPT
 *
 * Generates preview samples for Chatterbox Turbo preset voices using Replicate.
 * Uses the Anaïs Nin quote from docs/PREVIEW_Speaker_text.md
 *
 * Usage:
 *   npx ts-node src/scripts/generate_turbo_voice_samples.ts              # Generate all Turbo voices
 *   npx ts-node src/scripts/generate_turbo_voice_samples.ts --voice=turbo-alloy  # Generate specific voice
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const replicate_1 = __importDefault(require("replicate"));
const supabase_js_1 = require("@supabase/supabase-js");
const dotenv = __importStar(require("dotenv"));
const fs_1 = require("fs");
const os = __importStar(require("os"));
const path = __importStar(require("path"));
const child_process_1 = require("child_process");
dotenv.config();
const SUPABASE_URL = process.env.SUPABASE_URL || '';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const supabase = (0, supabase_js_1.createClient)(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
// Get Replicate API token from Supabase api_keys table (with env fallback)
async function getReplicateToken() {
    // Try env first
    if (process.env.REPLICATE_API_TOKEN) {
        return process.env.REPLICATE_API_TOKEN;
    }
    // Try Supabase api_keys table
    const { data } = await supabase
        .from('api_keys')
        .select('key')
        .eq('service', 'replicate')
        .single();
    if (data?.key) {
        return data.key;
    }
    throw new Error('REPLICATE_API_TOKEN not found in env or api_keys table');
}
// Import the standard quote and voice config
const voices_1 = require("../config/voices");
// Turbo preset voices with their API voice IDs
// Valid voices from Chatterbox Turbo API: Aaron, Abigail, Anaya, Andy, Archer, Brian, Chloe, Dylan, 
// Emmanuel, Ethan, Evelyn, Gavin, Gordon, Ivan, Laura, Lucy, Madison, Marisol, Meera, Walter
const TURBO_VOICES = [
    { id: 'turbo-aaron', displayName: 'Aaron', turboVoiceId: 'Aaron' },
    { id: 'turbo-abigail', displayName: 'Abigail', turboVoiceId: 'Abigail' },
    { id: 'turbo-andy', displayName: 'Andy', turboVoiceId: 'Andy' },
    { id: 'turbo-brian', displayName: 'Brian', turboVoiceId: 'Brian' },
    { id: 'turbo-emmanuel', displayName: 'Emmanuel', turboVoiceId: 'Emmanuel' },
    { id: 'turbo-evelyn', displayName: 'Evelyn', turboVoiceId: 'Evelyn' },
    { id: 'turbo-gavin', displayName: 'Gavin', turboVoiceId: 'Gavin' },
    { id: 'turbo-gordon', displayName: 'Gordon', turboVoiceId: 'Gordon' },
    { id: 'turbo-ivan', displayName: 'Ivan', turboVoiceId: 'Ivan' },
    { id: 'turbo-laura', displayName: 'Laura', turboVoiceId: 'Laura' },
    { id: 'turbo-lucy', displayName: 'Lucy', turboVoiceId: 'Lucy' },
    { id: 'turbo-walter', displayName: 'Walter', turboVoiceId: 'Walter' },
];
/**
 * Generate voice sample using Chatterbox Turbo via Replicate
 */
async function generateVoiceSample(turboVoiceId, voiceConfig) {
    console.log(`\n🎤 Generating sample for Turbo voice: ${turboVoiceId}`);
    console.log(`   Quote: "${voices_1.VOICE_SAMPLE_QUOTE}"`);
    const replicateToken = await getReplicateToken();
    const replicate = new replicate_1.default({ auth: replicateToken });
    try {
        // Retry logic for rate limiting
        let output;
        let attempts = 0;
        const maxAttempts = 5;
        while (attempts < maxAttempts) {
            try {
                // Get voice-specific settings from centralized config
                const voiceSettings = voiceConfig?.turboSettings || {};
                const settings = {
                    temperature: voiceSettings.temperature ?? 0.8,
                    top_p: voiceSettings.top_p ?? 0.95,
                };
                // Add optional settings if defined
                if (voiceSettings.cfg_weight !== undefined) {
                    settings.cfg_weight = voiceSettings.cfg_weight;
                }
                if (voiceSettings.exaggeration !== undefined) {
                    settings.exaggeration = voiceSettings.exaggeration;
                }
                console.log(`   Settings:`, settings);
                // Use clean text without modifications
                const textToUse = voices_1.VOICE_SAMPLE_QUOTE;
                output = await replicate.run('resemble-ai/chatterbox-turbo', {
                    input: {
                        text: textToUse,
                        voice: turboVoiceId,
                        ...settings,
                    },
                });
                break; // Success
            }
            catch (e) {
                if (e.message?.includes('429') && attempts < maxAttempts - 1) {
                    const waitTime = 10 + attempts * 5; // 10s, 15s, 20s, 25s
                    console.log(`   ⏳ Rate limited, waiting ${waitTime}s... (attempt ${attempts + 1}/${maxAttempts})`);
                    await new Promise(r => setTimeout(r, waitTime * 1000));
                    attempts++;
                }
                else {
                    throw e;
                }
            }
        }
        // Handle different output formats
        let audioBuffer;
        if (output instanceof ReadableStream) {
            const chunks = [];
            const reader = output.getReader();
            while (true) {
                const { done, value } = await reader.read();
                if (done)
                    break;
                chunks.push(value);
            }
            audioBuffer = Buffer.concat(chunks);
        }
        else if (typeof output === 'string' && output.startsWith('http')) {
            // URL output - download it
            const response = await fetch(output);
            const arrayBuffer = await response.arrayBuffer();
            audioBuffer = Buffer.from(arrayBuffer);
        }
        else {
            throw new Error(`Unexpected output format: ${typeof output}`);
        }
        console.log(`   ✅ Generated audio: ${Math.round(audioBuffer.length / 1024)}KB`);
        return audioBuffer;
    }
    catch (error) {
        console.error(`   ❌ Generation failed: ${error.message}`);
        throw error;
    }
}
/**
 * Run ffmpeg command
 */
async function runFfmpeg(args) {
    return new Promise((resolve, reject) => {
        const proc = (0, child_process_1.spawn)('ffmpeg', args, { stdio: 'pipe' });
        let stderr = '';
        proc.stderr?.on('data', (chunk) => { stderr += chunk.toString(); });
        proc.on('close', (code) => {
            if (code === 0)
                resolve();
            else
                reject(new Error(`ffmpeg exited with code ${code}: ${stderr}`));
        });
    });
}
/**
 * Normalize audio volume using ffmpeg
 */
async function normalizeAudioVolume(audioBuffer) {
    const dir = await fs_1.promises.mkdtemp(path.join(os.tmpdir(), 'turbo-voice-'));
    const inPath = path.join(dir, 'in.mp3');
    const outPath = path.join(dir, 'out.mp3');
    try {
        await fs_1.promises.writeFile(inPath, audioBuffer);
        // Apply loudnorm filter (target -16 LUFS for consistent volume)
        await runFfmpeg([
            '-i', inPath,
            '-af', 'loudnorm=I=-16:TP=-1.5:LRA=11',
            '-c:a', 'libmp3lame',
            '-b:a', '128k',
            outPath
        ]);
        const normalized = await fs_1.promises.readFile(outPath);
        console.log(`   🔊 Volume normalized: ${Math.round(audioBuffer.length / 1024)}KB -> ${Math.round(normalized.length / 1024)}KB`);
        return normalized;
    }
    finally {
        await fs_1.promises.rm(dir, { recursive: true, force: true }).catch(() => { });
    }
}
/**
 * Upload audio buffer to Supabase Storage
 */
async function uploadToStorage(voiceId, audioBuffer) {
    const storagePath = `${voiceId}/preview.mp3`;
    console.log(`💾 Uploading to storage: voice-samples/${storagePath}`);
    // Normalize audio volume before uploading
    const normalizedAudio = await normalizeAudioVolume(audioBuffer);
    // Upload file (upsert to overwrite if exists)
    const { data, error } = await supabase.storage
        .from('voice-samples')
        .upload(storagePath, normalizedAudio, {
        contentType: 'audio/mpeg',
        upsert: true,
    });
    if (error) {
        throw new Error(`Upload failed: ${error.message}`);
    }
    const publicUrl = supabase.storage
        .from('voice-samples')
        .getPublicUrl(storagePath).data.publicUrl;
    console.log(`   ✅ Uploaded: ${publicUrl}`);
    return publicUrl;
}
/**
 * Process a single voice
 */
async function processVoice(voice) {
    try {
        console.log(`\n${'='.repeat(60)}`);
        console.log(`Processing: ${voice.displayName} (${voice.id})`);
        console.log(`${'='.repeat(60)}`);
        // Find voice config from centralized VOICES array
        const voiceConfig = voices_1.VOICES.find(v => v.id === voice.id);
        // Generate audio
        const audioBuffer = await generateVoiceSample(voice.turboVoiceId, voiceConfig);
        // Upload to storage
        const sampleUrl = await uploadToStorage(voice.id, audioBuffer);
        console.log(`✅ SUCCESS: ${voice.displayName}`);
        return {
            voiceId: voice.id,
            success: true,
            sampleUrl,
        };
    }
    catch (error) {
        console.error(`❌ FAILED: ${voice.displayName} - ${error.message}`);
        return {
            voiceId: voice.id,
            success: false,
            error: error.message,
        };
    }
}
/**
 * Main execution
 */
async function main() {
    console.log('╔════════════════════════════════════════════════════════════╗');
    console.log('║     TURBO VOICE SAMPLE GENERATION (Replicate)             ║');
    console.log('╚════════════════════════════════════════════════════════════╝');
    console.log('\nQuote:');
    console.log(`"${voices_1.VOICE_SAMPLE_QUOTE}"`);
    console.log('\n― Anaïs Nin, House of Incest\n');
    // Parse arguments
    const args = process.argv.slice(2);
    const voiceArg = args.find((arg) => arg.startsWith('--voice='));
    const specificVoice = voiceArg ? voiceArg.split('=')[1] : null;
    let voicesToProcess;
    if (specificVoice) {
        const voice = TURBO_VOICES.find(v => v.id === specificVoice);
        if (!voice) {
            console.error(`❌ Voice '${specificVoice}' not found`);
            process.exit(1);
        }
        console.log(`Mode: Generating sample for specific voice: ${specificVoice}\n`);
        voicesToProcess = [voice];
    }
    else {
        console.log(`Mode: Generating samples for all ${TURBO_VOICES.length} Turbo voices\n`);
        voicesToProcess = TURBO_VOICES;
    }
    // Process voices
    const results = [];
    for (const voice of voicesToProcess) {
        const result = await processVoice(voice);
        results.push(result);
        // Small delay between voices to avoid rate limiting
        if (voicesToProcess.length > 1) {
            await new Promise((resolve) => setTimeout(resolve, 3000));
        }
    }
    // Summary
    console.log(`\n${'='.repeat(60)}`);
    console.log('SUMMARY');
    console.log(`${'='.repeat(60)}`);
    const successful = results.filter((r) => r.success);
    const failed = results.filter((r) => !r.success);
    console.log(`Total: ${results.length}`);
    console.log(`✅ Successful: ${successful.length}`);
    console.log(`❌ Failed: ${failed.length}`);
    if (successful.length > 0) {
        console.log('\nSuccessful:');
        successful.forEach((r) => {
            console.log(`  ✅ ${r.voiceId}: ${r.sampleUrl}`);
        });
    }
    if (failed.length > 0) {
        console.log('\nFailed:');
        failed.forEach((r) => {
            console.log(`  ❌ ${r.voiceId}: ${r.error}`);
        });
    }
    console.log('\n✅ Generation complete!');
    process.exit(failed.length > 0 ? 1 : 0);
}
main().catch((error) => {
    console.error('\n❌ Fatal error:', error);
    process.exit(1);
});
//# sourceMappingURL=generate_turbo_voice_samples.js.map