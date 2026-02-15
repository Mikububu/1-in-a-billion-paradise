#!/usr/bin/env node
/**
 * UPLOAD NEW VOICES SCRIPT
 * 
 * Uploads voice files from ~/Desktop/new voices/ to Supabase:
 * - WAV files → voices/ bucket (for RunPod/Chatterbox voice cloning)
 * - MP3 files → voice-samples/{voiceId}/preview.mp3 (for frontend preview)
 */

import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { env } from '../config/env';

const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

const VOICE_IDS = ['david', 'elisabeth', 'michael', 'peter', 'victor'];
const SOURCE_DIR = '/Users/michaelperinwogenburg/Desktop/new voices';

interface UploadResult {
    voiceId: string;
    wavSuccess: boolean;
    mp3Success: boolean;
    wavUrl?: string;
    mp3Url?: string;
    error?: string;
}

async function uploadFile(
    bucket: string,
    path: string,
    filePath: string,
    contentType: string
): Promise<string> {
    const fileBuffer = readFileSync(filePath);
    
    const { data, error } = await supabase.storage
        .from(bucket)
        .upload(path, fileBuffer, {
            contentType,
            upsert: true,
        });

    if (error) {
        throw new Error(`Upload failed: ${error.message}`);
    }

    const publicUrl = supabase.storage
        .from(bucket)
        .getPublicUrl(path).data.publicUrl;

    return publicUrl;
}

async function processVoice(voiceId: string): Promise<UploadResult> {
    console.log(`\n${'='.repeat(60)}`);
    console.log(`Processing: ${voiceId}`);
    console.log(`${'='.repeat(60)}`);

    const result: UploadResult = {
        voiceId,
        wavSuccess: false,
        mp3Success: false,
    };

    // Capitalize first letter for filename
    const capitalizedName = voiceId.charAt(0).toUpperCase() + voiceId.slice(1);

    try {
        // Upload WAV (for voice cloning)
        console.log(`📤 Uploading WAV for cloning...`);
        const wavPath = `${SOURCE_DIR}/${capitalizedName}.wav`;
        const wavUrl = await uploadFile(
            'voices',
            `${voiceId}.wav`,
            wavPath,
            'audio/wav'
        );
        result.wavSuccess = true;
        result.wavUrl = wavUrl;
        console.log(`   ✅ WAV uploaded: ${wavUrl}`);
    } catch (error: any) {
        console.error(`   ❌ WAV upload failed: ${error.message}`);
        result.error = error.message;
    }

    try {
        // Upload MP3 (for preview)
        console.log(`📤 Uploading MP3 for preview...`);
        const mp3Path = `${SOURCE_DIR}/${capitalizedName}.mp3`;
        const mp3Url = await uploadFile(
            'voice-samples',
            `${voiceId}/preview.mp3`,
            mp3Path,
            'audio/mpeg'
        );
        result.mp3Success = true;
        result.mp3Url = mp3Url;
        console.log(`   ✅ MP3 uploaded: ${mp3Url}`);
    } catch (error: any) {
        console.error(`   ❌ MP3 upload failed: ${error.message}`);
        if (!result.error) result.error = error.message;
    }

    return result;
}

async function main() {
    console.log('╔════════════════════════════════════════════════════════════╗');
    console.log('║         UPLOAD NEW VOICES                                  ║');
    console.log('╚════════════════════════════════════════════════════════════╝\n');

    const results: UploadResult[] = [];

    for (const voiceId of VOICE_IDS) {
        const result = await processVoice(voiceId);
        results.push(result);
    }

    // Summary
    console.log(`\n${'='.repeat(60)}`);
    console.log('SUMMARY');
    console.log(`${'='.repeat(60)}`);

    results.forEach((r) => {
        console.log(`\n${r.voiceId}:`);
        console.log(`  WAV (cloning): ${r.wavSuccess ? '✅' : '❌'} ${r.wavUrl || ''}`);
        console.log(`  MP3 (preview): ${r.mp3Success ? '✅' : '❌'} ${r.mp3Url || ''}`);
        if (r.error) console.log(`  Error: ${r.error}`);
    });

    const allSuccess = results.every((r) => r.wavSuccess && r.mp3Success);
    console.log(`\n${allSuccess ? '✅' : '❌'} Upload ${allSuccess ? 'complete' : 'had errors'}!`);

    process.exit(allSuccess ? 0 : 1);
}

main().catch((error) => {
    console.error('\n❌ Fatal error:', error);
    process.exit(1);
});
