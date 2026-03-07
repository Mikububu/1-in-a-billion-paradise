"use strict";
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
Object.defineProperty(exports, "__esModule", { value: true });
const supabaseClient_1 = require("../services/supabaseClient");
const dotenv_1 = require("dotenv");
const path_1 = require("path");
const fs = __importStar(require("fs"));
const voices_1 = require("../config/voices");
(0, dotenv_1.config)({ path: (0, path_1.join)(__dirname, '../../.env') });
/**
 * Check if a file exists in Supabase storage
 */
async function fileExists(supabase, bucket, path) {
    try {
        const pathParts = path.split('/');
        const folder = pathParts.slice(0, -1).join('/');
        const filename = pathParts[pathParts.length - 1];
        const { data, error } = await supabase.storage
            .from(bucket)
            .list(folder || '', {
            search: filename
        });
        if (error)
            return false;
        return data && data.some((f) => f.name === filename);
    }
    catch {
        return false;
    }
}
/**
 * Upload a file to Supabase storage
 */
async function uploadFile(supabase, bucket, filePath, localPath) {
    try {
        // Check if bucket exists, create if not
        const { data: buckets } = await supabase.storage.listBuckets();
        const bucketExists = buckets?.some((b) => b.name === bucket);
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
    }
    catch (error) {
        console.error(`   ❌ Error: ${error.message}`);
        return false;
    }
}
/**
 * Main function
 */
async function uploadVoiceSamplesMP3() {
    const supabase = (0, supabaseClient_1.createSupabaseServiceClient)();
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
    const enabledVoices = (0, voices_1.getEnabledVoices)();
    console.log(`📋 Checking ${enabledVoices.length} voice(s) in Supabase...\n`);
    const requiredFiles = enabledVoices.map(voice => ({
        voiceId: voice.id,
        displayName: voice.displayName,
        bucket: 'voice-samples',
        path: `voice-samples/${voice.id}/preview.mp3`,
        filename: `preview.mp3`,
    }));
    const missingFiles = [];
    for (const file of requiredFiles) {
        const exists = await fileExists(supabase, file.bucket, file.path);
        if (exists) {
            console.log(`   ✅ ${file.displayName} (${file.path}) - EXISTS`);
        }
        else {
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
                const localPath = (0, path_1.join)(localDir, name);
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
    }
    else {
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
//# sourceMappingURL=uploadVoiceSamplesMP3.js.map