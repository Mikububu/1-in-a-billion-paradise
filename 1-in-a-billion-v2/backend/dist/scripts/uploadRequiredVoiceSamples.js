"use strict";
/**
 * UPLOAD REQUIRED VOICE SAMPLES
 *
 * Uploads the essential voice files needed for the app to run.
 *
 * Required files:
 * 1. Original WAV files in 'voices' bucket (for voice cloning):
 *    - Anabella.wav
 *    - Dorothy.wav
 *    - Ludwig.wav
 *    - grandpa_15sec.wav
 *
 * 2. Generated preview samples in 'voice-samples' bucket (can be regenerated):
 *    - voice-samples/{voiceId}/preview.mp3
 *
 * Usage:
 *   # Upload from local files (if you have them):
 *   npx ts-node src/scripts/uploadRequiredVoiceSamples.ts --local-dir=/path/to/voice/files
 *
 *   # Or just generate preview samples (if WAV files already exist in Supabase):
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
 * Required voice files for the app
 */
const REQUIRED_VOICE_FILES = [
    { bucket: 'voices', filename: 'Anabella.wav', voiceId: 'anabella' },
    { bucket: 'voices', filename: 'Dorothy.wav', voiceId: 'dorothy' },
    { bucket: 'voices', filename: 'Ludwig.wav', voiceId: 'ludwig' },
    { bucket: 'voices', filename: 'grandpa_15sec.wav', voiceId: 'grandpa' },
];
/**
 * Check if a file exists in Supabase storage
 */
async function fileExists(supabase, bucket, path) {
    try {
        const { data, error } = await supabase.storage
            .from(bucket)
            .list(path.split('/').slice(0, -1).join('/') || '', {
            search: path.split('/').pop()
        });
        if (error)
            return false;
        return data && data.some((f) => f.name === path.split('/').pop());
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
        const contentType = filePath.endsWith('.wav') ? 'audio/wav' :
            filePath.endsWith('.mp3') ? 'audio/mpeg' :
                'application/octet-stream';
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
    }
    catch (error) {
        console.error(`   ❌ Error: ${error.message}`);
        return false;
    }
}
/**
 * Main function
 */
async function uploadRequiredVoiceSamples() {
    const supabase = (0, supabaseClient_1.createSupabaseServiceClient)();
    if (!supabase) {
        console.error('❌ Supabase not configured');
        process.exit(1);
    }
    console.log('🎤 UPLOAD REQUIRED VOICE SAMPLES');
    console.log('═══════════════════════════════════════════════════════════\n');
    // Parse arguments
    const args = process.argv.slice(2);
    const localDirArg = args.find((arg) => arg.startsWith('--local-dir='));
    const localDir = localDirArg ? localDirArg.split('=')[1] : null;
    // Check what's already in Supabase
    console.log('📋 Checking existing files in Supabase...\n');
    const missingFiles = [];
    for (const file of REQUIRED_VOICE_FILES) {
        const exists = await fileExists(supabase, file.bucket, file.filename);
        if (exists) {
            console.log(`   ✅ ${file.bucket}/${file.filename} - EXISTS`);
        }
        else {
            console.log(`   ❌ ${file.bucket}/${file.filename} - MISSING`);
            missingFiles.push(file);
        }
    }
    if (missingFiles.length === 0) {
        console.log('\n✅ All required voice files are already in Supabase!');
        console.log('\n💡 Next step: Generate preview samples');
        console.log('   Run: npx ts-node src/scripts/generate_voice_samples.ts\n');
        return;
    }
    console.log(`\n📊 Missing ${missingFiles.length} file(s)`);
    // If local directory provided, try to upload
    if (localDir) {
        console.log(`\n📤 Uploading from local directory: ${localDir}\n`);
        let uploaded = 0;
        for (const file of missingFiles) {
            const localPath = (0, path_1.join)(localDir, file.filename);
            if (!fs.existsSync(localPath)) {
                console.log(`   ⚠️  ${file.filename} - Not found locally, skipping`);
                continue;
            }
            console.log(`   📤 Uploading ${file.filename}...`);
            const success = await uploadFile(supabase, file.bucket, file.filename, localPath);
            if (success) {
                console.log(`   ✅ Uploaded: ${file.filename}`);
                uploaded++;
            }
        }
        console.log(`\n✅ Uploaded ${uploaded}/${missingFiles.length} file(s)`);
        if (uploaded < missingFiles.length) {
            console.log('\n⚠️  Some files are still missing. Please ensure all files are available.');
        }
    }
    else {
        console.log('\n📝 INSTRUCTIONS:');
        console.log('═══════════════════════════════════════════════════════════');
        console.log('To upload the missing voice files:');
        console.log('\n1. Ensure you have these WAV files:');
        missingFiles.forEach(f => console.log(`   - ${f.filename}`));
        console.log('\n2. Run this script with --local-dir flag:');
        console.log(`   npx ts-node src/scripts/uploadRequiredVoiceSamples.ts --local-dir=/path/to/voice/files`);
        console.log('\n3. After uploading, generate preview samples:');
        console.log('   npx ts-node src/scripts/generate_voice_samples.ts');
        console.log('═══════════════════════════════════════════════════════════\n');
    }
    // Check preview samples
    console.log('\n📋 Checking preview samples...\n');
    const enabledVoices = (0, voices_1.getEnabledVoices)();
    let missingPreviews = 0;
    for (const voice of enabledVoices) {
        const previewPath = `voice-samples/${voice.id}/preview.mp3`;
        const exists = await fileExists(supabase, 'voice-samples', previewPath);
        if (exists) {
            console.log(`   ✅ Preview for ${voice.displayName} - EXISTS`);
        }
        else {
            console.log(`   ❌ Preview for ${voice.displayName} - MISSING`);
            missingPreviews++;
        }
    }
    if (missingPreviews > 0) {
        console.log(`\n💡 Generate missing preview samples:`);
        console.log(`   npx ts-node src/scripts/generate_voice_samples.ts\n`);
    }
    else {
        console.log('\n✅ All preview samples exist!\n');
    }
}
// Run the script
uploadRequiredVoiceSamples().catch(err => {
    console.error('❌ Fatal error:', err);
    process.exit(1);
});
//# sourceMappingURL=uploadRequiredVoiceSamples.js.map