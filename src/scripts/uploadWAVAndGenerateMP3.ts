/**
 * UPLOAD WAV FILES AND GENERATE MP3 SAMPLES
 * 
 * This script:
 * 1. Uploads WAV files to Supabase 'voices' bucket (for voice cloning)
 * 2. Generates MP3 preview samples using generate_voice_samples.ts
 * 
 * Usage:
 *   npx ts-node src/scripts/uploadWAVAndGenerateMP3.ts --local-dir=/path/to/wav/files
 */

import { createSupabaseServiceClient } from '../services/supabaseClient';
import { config } from 'dotenv';
import { join } from 'path';
import * as fs from 'fs';
import { VOICES, getEnabledVoices } from '../config/voices';

config({ path: join(__dirname, '../../.env') });

/**
 * Upload a file to Supabase storage
 */
async function uploadFile(
    supabase: any,
    bucket: string,
    filePath: string,
    localPath: string
): Promise<boolean> {
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

        // Read local file
        const fileBuffer = fs.readFileSync(localPath);
        const contentType = filePath.endsWith('.wav') ? 'audio/wav' : 'audio/mpeg';

        // Upload
        const { error } = await supabase.storage
            .from(bucket)
            .upload(filePath, fileBuffer, {
                contentType,
                upsert: true,
            });

        if (error) {
            console.error(`   ❌ Upload failed: ${error.message}`);
            return false;
        }

        return true;
    } catch (error: any) {
        console.error(`   ❌ Error: ${error.message}`);
        return false;
    }
}

/**
 * Main function
 */
async function uploadWAVAndGenerateMP3() {
    const supabase = createSupabaseServiceClient();
    
    if (!supabase) {
        console.error('❌ Supabase not configured');
        process.exit(1);
    }

    console.log('🎤 UPLOAD WAV FILES AND GENERATE MP3 SAMPLES');
    console.log('═══════════════════════════════════════════════════════════\n');

    // Parse arguments
    const args = process.argv.slice(2);
    const localDirArg = args.find((arg) => arg.startsWith('--local-dir='));
    const localDir = localDirArg ? localDirArg.split('=')[1] : null;

    if (!localDir) {
        console.log('❌ Please provide --local-dir');
        console.log('\nUsage:');
        console.log('  npx ts-node src/scripts/uploadWAVAndGenerateMP3.ts --local-dir=/path/to/wav/files');
        process.exit(1);
    }

    // Map voice IDs to possible WAV filenames
    const voiceFileMap: Record<string, string[]> = {
        anabella: ['Anabella.wav', 'anabella.wav'],
        dorothy: ['Dorothy.wav', 'dorothy.wav'],
        ludwig: ['Ludwig.wav', 'ludwig.wav'],
        grandpa: ['grandpa_15sec.wav', 'grandpa.wav', 'Grandpa.wav'],
    };

    const enabledVoices = getEnabledVoices();
    
    console.log(`📤 Step 1: Uploading WAV files to 'voices' bucket...\n`);

    let uploadedWAV = 0;
    const uploadedFiles: string[] = [];

    for (const voice of enabledVoices) {
        const possibleNames = voiceFileMap[voice.id] || [`${voice.id}.wav`, `${voice.displayName}.wav`];
        let found = false;

        for (const filename of possibleNames) {
            const localPath = join(localDir, filename);
            
            if (fs.existsSync(localPath)) {
                console.log(`   📤 Uploading ${voice.displayName} (${filename})...`);
                const success = await uploadFile(supabase, 'voices', filename, localPath);
                
                if (success) {
                    console.log(`   ✅ Uploaded: ${filename}`);
                    uploadedWAV++;
                    uploadedFiles.push(filename);
                    found = true;
                    break;
                }
            }
        }

        if (!found) {
            console.log(`   ⚠️  ${voice.displayName} - WAV file not found (tried: ${possibleNames.join(', ')})`);
        }
    }

    console.log(`\n✅ Uploaded ${uploadedWAV}/${enabledVoices.length} WAV file(s)`);

    if (uploadedWAV === 0) {
        console.log('\n❌ No WAV files uploaded. Cannot generate MP3 samples.');
        process.exit(1);
    }

    console.log('\n═══════════════════════════════════════════════════════════');
    console.log('🎵 Step 2: Generating MP3 samples...');
    console.log('═══════════════════════════════════════════════════════════\n');
    console.log('💡 Now run the generate_voice_samples script:');
    console.log('   npx ts-node src/scripts/generate_voice_samples.ts\n');
    console.log('This will:');
    console.log('  1. Use the WAV files we just uploaded');
    console.log('  2. Generate MP3 samples with the Henry Miller quote');
    console.log('  3. Upload them to voice-samples bucket\n');
}

// Run the script
uploadWAVAndGenerateMP3().catch(err => {
    console.error('❌ Fatal error:', err);
    process.exit(1);
});
