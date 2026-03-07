"use strict";
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
    }
    catch (error) {
        console.error(`   ❌ Error: ${error.message}`);
        return false;
    }
}
/**
 * Main function
 */
async function uploadWAVAndGenerateMP3() {
    const supabase = (0, supabaseClient_1.createSupabaseServiceClient)();
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
    const voiceFileMap = {
        anabella: ['Anabella.wav', 'anabella.wav'],
        dorothy: ['Dorothy.wav', 'dorothy.wav'],
        ludwig: ['Ludwig.wav', 'ludwig.wav'],
        grandpa: ['grandpa_15sec.wav', 'grandpa.wav', 'Grandpa.wav'],
    };
    const enabledVoices = (0, voices_1.getEnabledVoices)();
    console.log(`📤 Step 1: Uploading WAV files to 'voices' bucket...\n`);
    let uploadedWAV = 0;
    const uploadedFiles = [];
    for (const voice of enabledVoices) {
        const possibleNames = voiceFileMap[voice.id] || [`${voice.id}.wav`, `${voice.displayName}.wav`];
        let found = false;
        for (const filename of possibleNames) {
            const localPath = (0, path_1.join)(localDir, filename);
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
    console.log('  2. Generate MP3 samples with the Anaïs Nin quote');
    console.log('  3. Upload them to voice-samples bucket\n');
}
// Run the script
uploadWAVAndGenerateMP3().catch(err => {
    console.error('❌ Fatal error:', err);
    process.exit(1);
});
//# sourceMappingURL=uploadWAVAndGenerateMP3.js.map