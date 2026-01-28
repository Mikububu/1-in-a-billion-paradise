#!/usr/bin/env node
/**
 * VOICE SAMPLE GENERATION SCRIPT
 * 
 * Generates voice samples for all voices using the standard Henry Miller quote.
 * Samples are stored in Supabase Storage at: voice-samples/{voice_id}/henry_miller_sample.mp3
 * 
 * Usage:
 *   npx ts-node src/scripts/generate_voice_samples.ts              # Generate all voices
 *   npx ts-node src/scripts/generate_voice_samples.ts --voice=default  # Generate specific voice
 */

import axios from 'axios';
import { createClient } from '@supabase/supabase-js';
import { env } from '../config/env';
import { VOICES, VOICE_SAMPLE_QUOTE, getVoiceById } from '../config/voices';
import { getApiKey } from '../services/apiKeys';

const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

interface GenerationResult {
    voiceId: string;
    success: boolean;
    sampleUrl?: string;
    error?: string;
}

/**
 * Generate voice sample using Chatterbox via RunPod
 */
async function generateVoiceSample(voiceId: string, voiceSampleUrl: string): Promise<Buffer> {
    console.log(`\n🎤 Generating sample for voice: ${voiceId}`);
    console.log(`   Voice sample URL: ${voiceSampleUrl}`);
    console.log(`   Quote length: ${VOICE_SAMPLE_QUOTE.length} characters`);

    // Fetch RunPod API keys from Supabase (with env fallback)
    const runpodApiKey = await getApiKey('runpod', env.RUNPOD_API_KEY);
    const runpodEndpointId = await getApiKey('runpod_endpoint', env.RUNPOD_ENDPOINT_ID);

    if (!runpodApiKey || !runpodEndpointId) {
        throw new Error('RunPod not configured (RUNPOD_API_KEY and RUNPOD_ENDPOINT_ID required)');
    }

    try {
        const response = await axios.post(
            `https://api.runpod.ai/v2/${runpodEndpointId}/runsync`,
            {
                input: {
                    text: VOICE_SAMPLE_QUOTE,
                    audio_url: voiceSampleUrl,
                    exaggeration: 0.3, // Natural voice
                    cfg_weight: 0.5,
                },
            },
            {
                headers: {
                    Authorization: `Bearer ${runpodApiKey}`,
                    'Content-Type': 'application/json',
                },
                timeout: 180000, // 3 minutes
            }
        );

        const output = response.data?.output;
        if (!output?.audio_base64) {
            throw new Error('No audio_base64 in response');
        }

        const audioBuffer = Buffer.from(output.audio_base64, 'base64');
        console.log(`   ✅ Generated audio: ${Math.round(audioBuffer.length / 1024)}KB`);

        return audioBuffer;
    } catch (error: any) {
        console.error(`   ❌ Generation failed: ${error.message}`);
        throw error;
    }
}

/**
 * Upload audio buffer to Supabase Storage
 */
async function uploadToStorage(voiceId: string, audioBuffer: Buffer): Promise<string> {
    const storagePath = `voice-samples/${voiceId}/henry_miller_sample.mp3`;

    console.log(`💾 Uploading to storage: ${storagePath}`);

    // Check if bucket exists, if not create it
    const { data: buckets } = await supabase.storage.listBuckets();
    const bucketExists = buckets?.some((b) => b.name === 'voice-samples');

    if (!bucketExists) {
        console.log('   Creating voice-samples bucket...');
        await supabase.storage.createBucket('voice-samples', {
            public: true,
            fileSizeLimit: 10485760, // 10MB
        });
    }

    // Upload file (upsert to overwrite if exists)
    const { data, error } = await supabase.storage
        .from('voice-samples')
        .upload(storagePath, audioBuffer, {
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
async function processVoice(voiceId: string): Promise<GenerationResult> {
    const voice = getVoiceById(voiceId);

    if (!voice) {
        return {
            voiceId,
            success: false,
            error: `Voice '${voiceId}' not found or disabled`,
        };
    }

    try {
        console.log(`\n${'='.repeat(60)}`);
        console.log(`Processing: ${voice.displayName} (${voiceId})`);
        console.log(`${'='.repeat(60)}`);

        // Generate audio
        const audioBuffer = await generateVoiceSample(voiceId, voice.sampleAudioUrl);

        // Upload to storage
        const sampleUrl = await uploadToStorage(voiceId, audioBuffer);

        console.log(`✅ SUCCESS: ${voice.displayName}`);

        return {
            voiceId,
            success: true,
            sampleUrl,
        };
    } catch (error: any) {
        console.error(`❌ FAILED: ${voice.displayName} - ${error.message}`);

        return {
            voiceId,
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
    console.log('║         VOICE SAMPLE GENERATION                           ║');
    console.log('╚════════════════════════════════════════════════════════════╝');
    console.log('\nStandard Quote:');
    console.log(`"${VOICE_SAMPLE_QUOTE}"`);
    console.log('\n― Henry Miller, Tropic of Cancer\n');

    // Parse arguments
    const args = process.argv.slice(2);
    const voiceArg = args.find((arg) => arg.startsWith('--voice='));
    const specificVoice = voiceArg ? voiceArg.split('=')[1] : null;

    let voicesToProcess: string[];

    if (specificVoice) {
        console.log(`Mode: Generating sample for specific voice: ${specificVoice}\n`);
        voicesToProcess = [specificVoice];
    } else {
        console.log(`Mode: Generating samples for all ${VOICES.length} voices\n`);
        voicesToProcess = VOICES.filter((v) => v.enabled !== false).map((v) => v.id);
    }

    // Process voices
    const results: GenerationResult[] = [];

    for (const voiceId of voicesToProcess) {
        const result = await processVoice(voiceId);
        results.push(result);

        // Small delay between voices to avoid rate limiting
        if (voicesToProcess.length > 1) {
            await new Promise((resolve) => setTimeout(resolve, 2000));
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
