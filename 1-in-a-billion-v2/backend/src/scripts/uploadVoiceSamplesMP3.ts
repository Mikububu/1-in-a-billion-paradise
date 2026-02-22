/**
 * UPLOAD VOICE SAMPLES (MP3 ONLY)
 * 
 * Uploads MP3 voice samples needed for the app to run.
 * 
 * Required MP3 files:
 * - voice-samples/{voiceId}/preview.mp3
 * 
 * These MP3 files are used for:
 * 1. Frontend previews (voice selection UI)
 * 2. Voice cloning (RunPod accepts MP3 URLs)
 * 
 * Usage:
 *   # Upload from local directory:
 *   npx ts-node src/scripts/uploadVoiceSamplesMP3.ts --local-dir=/path/to/mp3/files
 * 
 *   # Or generate them (if you have the original WAV files):
 *   npx ts-node src/scripts/generate_voice_samples.ts
 */

import { createSupabaseServiceClient } from '../services/supabaseClient';
import { config } from 'dotenv';
import { join } from 'path';
import * as fs from 'fs';
import { getEnabledVoices } from '../config/voices';

config({ path: join(__dirname, '../../.env') });

/**
 * Check if a file exists in Supabase storage
 */
async function fileExists(supabase: any, bucket: string, path: string): Promise<boolean> {
    try {
        const pathParts = path.split('/');
        const folder = pathParts.slice(0, -1).join('/');
        const filename = pathParts[pathParts.length - 1];
        
        const { data, error } = await supabase.storage
            .from(bucket)
            .list(folder || '', {
                search: filename
            });
        
        if (error) return false;
        return data && data.some((f: any) => f.name === filename);
    } catch {
        return false;
    }
}

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

        // Upload
        const { error } = await supabase.storage
            .from(bucket)
            .upload(filePath, fileBuffer, {
                contentType: 'audio/mpeg',
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
async function uploadVoiceSamplesMP3() {
    const supabase = createSupabaseServiceClient();
    
    if (!supabase) {
        console.error('❌ Supabase not configured');
        process.exit(1);
    }

    console.log('🎤 UPLOAD VOICE SAMPLES (MP3)');
    console.log('═══════════════════════════════════════════════════════════\n');

    // Parse arguments
    const args = process.argv.slice(2);
    const localDirArg = args.find((arg) => arg.startsWith('--local-dir='));
    const localDir = localDirArg ? localDirArg.split('=')[1] : null;

    // Get enabled voices
    const enabledVoices = getEnabledVoices();
    
    console.log(`📋 Checking ${enabledVoices.length} voice(s) in Supabase...\n`);
    
    const requiredFiles = enabledVoices.map(voice => ({
        voiceId: voice.id,
        displayName: voice.displayName,
        bucket: 'voice-samples',
        path: `voice-samples/${voice.id}/preview.mp3`,
        filename: `preview.mp3`,
    }));

    const missingFiles: typeof requiredFiles = [];
    
    for (const file of requiredFiles) {
        const exists = await fileExists(supabase, file.bucket, file.path);
        if (exists) {
            console.log(`   ✅ ${file.displayName} (${file.path}) - EXISTS`);
        } else {
            console.log(`   ❌ ${file.displayName} (${file.path}) - MISSING`);
            missingFiles.push(file);
        }
    }

    if (missingFiles.length === 0) {
        console.log('\n✅ All required voice samples are already in Supabase!\n');
        return;
    }

    console.log(`\n📊 Missing ${missingFiles.length} file(s)`);

    // If local directory provided, try to upload
    if (localDir) {
        console.log(`\n📤 Uploading from local directory: ${localDir}\n`);
        
        let uploaded = 0;
        for (const file of missingFiles) {
            // Try different possible filenames
            const possibleNames = [
                `${file.voiceId}.mp3`,
                `${file.displayName}.mp3`,
                `preview.mp3`,
                file.filename,
            ];

            let found = false;
            for (const name of possibleNames) {
                const localPath = join(localDir, name);
                
                if (fs.existsSync(localPath)) {
                    console.log(`   📤 Uploading ${file.displayName} (${name})...`);
                    const success = await uploadFile(supabase, file.bucket, file.path, localPath);
                    
                    if (success) {
                        console.log(`   ✅ Uploaded: ${file.displayName}`);
                        uploaded++;
                        found = true;
                        break;
                    }
                }
            }

            if (!found) {
                console.log(`   ⚠️  ${file.displayName} - File not found locally, skipping`);
                console.log(`      Tried: ${possibleNames.join(', ')}`);
            }
        }

        console.log(`\n✅ Uploaded ${uploaded}/${missingFiles.length} file(s)`);
        
        if (uploaded < missingFiles.length) {
            console.log('\n⚠️  Some files are still missing.');
            console.log('   Make sure MP3 files are named correctly or use generate_voice_samples.ts\n');
        }
    } else {
        console.log('\n📝 INSTRUCTIONS:');
        console.log('═══════════════════════════════════════════════════════════');
        console.log('To upload the missing voice samples:');
        console.log('\nOption 1: Upload MP3 files directly');
        console.log('  1. Ensure you have MP3 files for each voice');
        console.log('  2. Run:');
        console.log(`     npx ts-node src/scripts/uploadVoiceSamplesMP3.ts --local-dir=/path/to/mp3/files`);
        console.log('\nOption 2: Generate from original WAV files');
        console.log('  1. Ensure original WAV files are in Supabase "voices" bucket');
        console.log('  2. Run:');
        console.log('     npx ts-node src/scripts/generate_voice_samples.ts');
        console.log('═══════════════════════════════════════════════════════════\n');
    }
}

// Run the script
uploadVoiceSamplesMP3().catch(err => {
    console.error('❌ Fatal error:', err);
    process.exit(1);
});
