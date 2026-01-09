/**
 * PROCESS NEW VOICES
 * 
 * Processes new voice files from the "new voices" folder:
 * 1. Converts MP3 to WAV (for RunPod/Chatterbox training)
 * 2. Uploads WAV to 'voices' bucket
 * 3. Uploads MP3 to 'voice-samples' bucket (for previews)
 * 4. Generates config entries
 * 
 * Usage:
 *   npx ts-node src/scripts/processNewVoices.ts
 */

import { createSupabaseServiceClient } from '../services/supabaseClient';
import { config } from 'dotenv';
import { join, basename, extname } from 'path';
import * as fs from 'fs';
import { execSync } from 'child_process';

config({ path: join(__dirname, '../../.env') });

interface VoiceFile {
    name: string;
    path: string;
    voiceId: string;
    displayName: string;
}

/**
 * Convert filename to kebab-case voice ID
 */
function toVoiceId(filename: string): string {
    return filename
        .replace(/\.[^/.]+$/, '')
        .replace(/[^a-zA-Z0-9]+/g, '-')
        .toLowerCase()
        .replace(/^-+|-+$/g, '');
}

/**
 * Convert filename to display name
 */
function toDisplayName(filename: string): string {
    return filename
        .replace(/\.[^/.]+$/, '')
        .replace(/[-_]/g, ' ')
        .replace(/\b\w/g, (l) => l.toUpperCase());
}

/**
 * Check if ffmpeg is available
 */
function hasFFmpeg(): boolean {
    try {
        execSync('ffmpeg -version', { stdio: 'ignore' });
        return true;
    } catch {
        return false;
    }
}

/**
 * Convert MP3 to WAV using ffmpeg
 */
function convertToWAV(inputPath: string, outputPath: string): boolean {
    try {
        console.log(`   🔄 Converting MP3 → WAV...`);
        execSync(`ffmpeg -i "${inputPath}" -ar 22050 -ac 1 -f wav "${outputPath}" -y`, {
            stdio: 'inherit',
        });
        return fs.existsSync(outputPath);
    } catch (error: any) {
        console.error(`   ❌ Conversion failed: ${error.message}`);
        return false;
    }
}

/**
 * Upload file to Supabase storage
 */
async function uploadFile(
    supabase: any,
    bucket: string,
    filePath: string,
    localPath: string,
    contentType: string
): Promise<string | null> {
    try {
        // Check if bucket exists, create if not
        const { data: buckets } = await supabase.storage.listBuckets();
        const bucketExists = buckets?.some((b: any) => b.name === bucket);

        if (!bucketExists) {
            console.log(`   Creating bucket: ${bucket}...`);
            await supabase.storage.createBucket(bucket, {
                public: true,
                fileSizeLimit: 10485760, // 10MB
            });
        }

        // Read file
        const fileBuffer = fs.readFileSync(localPath);

        // Upload
        const { error } = await supabase.storage
            .from(bucket)
            .upload(filePath, fileBuffer, {
                contentType,
                upsert: true,
            });

        if (error) {
            console.error(`   ❌ Upload failed: ${error.message}`);
            return null;
        }

        const publicUrl = `https://qdfikbgwuauertfmkmzk.supabase.co/storage/v1/object/public/${bucket}/${filePath}`;
        return publicUrl;
    } catch (error: any) {
        console.error(`   ❌ Error: ${error.message}`);
        return null;
    }
}

/**
 * Main function
 */
async function processNewVoices() {
    const supabase = createSupabaseServiceClient();
    
    if (!supabase) {
        console.error('❌ Supabase not configured');
        process.exit(1);
    }

    console.log('🎤 PROCESS NEW VOICES');
    console.log('═══════════════════════════════════════════════════════════\n');

    const voicesDir = '/Users/michaelperinwogenburg/Desktop/new voices';

    if (!fs.existsSync(voicesDir)) {
        console.error(`❌ Directory not found: ${voicesDir}`);
        process.exit(1);
    }

    // Scan for MP3 files
    const files = fs.readdirSync(voicesDir)
        .filter(f => f.toLowerCase().endsWith('.mp3'))
        .map(f => ({
            name: f,
            path: join(voicesDir, f),
            voiceId: toVoiceId(f),
            displayName: toDisplayName(f),
        }));

    if (files.length === 0) {
        console.log('❌ No MP3 files found');
        process.exit(1);
    }

    console.log(`✅ Found ${files.length} voice file(s):\n`);
    files.forEach((f, i) => {
        console.log(`   ${i + 1}. ${f.displayName} → ${f.voiceId}`);
    });

    console.log('\n═══════════════════════════════════════════════════════════');
    console.log('📤 PROCESSING FILES');
    console.log('═══════════════════════════════════════════════════════════\n');

    const processedVoices: Array<{
        voiceId: string;
        displayName: string;
        wavUrl: string;
        mp3Url: string;
        category: 'male' | 'female' | 'neutral';
    }> = [];

    const hasFFmpegInstalled = hasFFmpeg();
    if (!hasFFmpegInstalled) {
        console.log('⚠️  ffmpeg not found - WAV conversion will be skipped');
        console.log('   Install with: brew install ffmpeg\n');
    }

    for (const voiceFile of files) {
        console.log(`\n🎤 ${voiceFile.displayName} (${voiceFile.voiceId})`);

        // Upload MP3 to voice-samples bucket (for previews)
        const mp3Path = `voice-samples/${voiceFile.voiceId}/henry_miller_sample.mp3`;
        console.log(`   📤 Uploading MP3 preview...`);
        const mp3Url = await uploadFile(
            supabase,
            'voice-samples',
            mp3Path,
            voiceFile.path,
            'audio/mpeg'
        );

        if (!mp3Url) {
            console.log(`   ⚠️  Skipping - MP3 upload failed`);
            continue;
        }
        console.log(`   ✅ MP3 uploaded: ${mp3Url}`);

        // Convert and upload WAV (for RunPod training)
        let wavUrl = '';
        if (hasFFmpegInstalled) {
            const tempWavPath = join(voicesDir, `${voiceFile.voiceId}.wav`);
            if (convertToWAV(voiceFile.path, tempWavPath)) {
                const wavFileName = `${voiceFile.voiceId}.wav`;
                console.log(`   📤 Uploading WAV for training...`);
                wavUrl = await uploadFile(
                    supabase,
                    'voices',
                    wavFileName,
                    tempWavPath,
                    'audio/wav'
                ) || '';

                if (wavUrl) {
                    console.log(`   ✅ WAV uploaded: ${wavUrl}`);
                }

                // Cleanup temp file
                if (fs.existsSync(tempWavPath)) {
                    fs.unlinkSync(tempWavPath);
                }
            }
        } else {
            // Use MP3 URL as fallback (RunPod might accept MP3)
            wavUrl = mp3Url;
            console.log(`   ⚠️  Using MP3 for training (WAV conversion skipped)`);
        }

        // Determine category (simple heuristic - can be updated manually)
        const category: 'male' | 'female' | 'neutral' = 
            voiceFile.displayName.toLowerCase().includes('elisabeth') ? 'female' : 'male';

        processedVoices.push({
            voiceId: voiceFile.voiceId,
            displayName: voiceFile.displayName,
            wavUrl: wavUrl || mp3Url,
            mp3Url,
            category,
        });
    }

    // Generate config update
    console.log('\n═══════════════════════════════════════════════════════════');
    console.log('📝 VOICES CONFIG UPDATE');
    console.log('═══════════════════════════════════════════════════════════\n');

    console.log('Add these voices to src/config/voices.ts:\n');
    
    processedVoices.forEach((voice) => {
        console.log(`    {`);
        console.log(`        id: '${voice.voiceId}',`);
        console.log(`        displayName: '${voice.displayName}',`);
        console.log(`        description: 'Add description here',`);
        console.log(`        sampleAudioUrl: '${voice.wavUrl}',`);
        console.log(`        previewSampleUrl: '${voice.mp3Url}',`);
        console.log(`        category: '${voice.category}',`);
        console.log(`        enabled: true,`);
        console.log(`    },`);
        console.log('');
    });

    console.log('✅ Processing complete!');
    console.log('\n💡 Next steps:');
    console.log('   1. Review and update descriptions above');
    console.log('   2. Add the voices to src/config/voices.ts');
    console.log('   3. Update getVoiceSampleUrl() to use previewSampleUrl if provided\n');
}

// Run the script
processNewVoices().catch(err => {
    console.error('❌ Fatal error:', err);
    process.exit(1);
});
