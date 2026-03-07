"use strict";
/**
 * DOWNLOAD AND UPLOAD VOICE SAMPLES FROM GITHUB
 *
 * Downloads MP3 voice samples from a GitHub repository and uploads them to Supabase.
 *
 * Usage:
 *   # From GitHub repo:
 *   npx ts-node src/scripts/downloadAndUploadVoiceSamples.ts --github-repo=owner/repo --github-path=path/to/audio/files
 *
 *   # Or from local directory (if already cloned):
 *   npx ts-node src/scripts/downloadAndUploadVoiceSamples.ts --local-dir=/path/to/audio/files
 *
 *   # Or specify GitHub branch/tag:
 *   npx ts-node src/scripts/downloadAndUploadVoiceSamples.ts --github-repo=owner/repo --github-path=path/to/files --branch=main
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
const https = __importStar(require("https"));
const voices_1 = require("../config/voices");
(0, dotenv_1.config)({ path: (0, path_1.join)(__dirname, '../../.env') });
/**
 * Download a file from GitHub raw content
 */
async function downloadFromGitHub(repo, // e.g., "owner/repo"
path, // e.g., "audio/preview.mp3"
branch = 'main') {
    return new Promise((resolve, reject) => {
        const url = `https://raw.githubusercontent.com/${repo}/${branch}/${path}`;
        console.log(`   📥 Downloading: ${url}`);
        https.get(url, (response) => {
            if (response.statusCode === 301 || response.statusCode === 302) {
                // Follow redirect
                return downloadFromGitHub(repo, path, branch).then(resolve).catch(reject);
            }
            if (response.statusCode !== 200) {
                reject(new Error(`Failed to download: ${response.statusCode} ${response.statusMessage}`));
                return;
            }
            const chunks = [];
            response.on('data', (chunk) => chunks.push(chunk));
            response.on('end', () => resolve(Buffer.concat(chunks)));
            response.on('error', reject);
        }).on('error', reject);
    });
}
/**
 * Upload a file to Supabase storage
 */
async function uploadFile(supabase, bucket, filePath, fileBuffer) {
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
async function downloadAndUploadVoiceSamples() {
    const supabase = (0, supabaseClient_1.createSupabaseServiceClient)();
    if (!supabase) {
        console.error('❌ Supabase not configured');
        process.exit(1);
    }
    console.log('🎤 DOWNLOAD AND UPLOAD VOICE SAMPLES');
    console.log('═══════════════════════════════════════════════════════════\n');
    // Parse arguments
    const args = process.argv.slice(2);
    const githubRepoArg = args.find((arg) => arg.startsWith('--github-repo='));
    const githubPathArg = args.find((arg) => arg.startsWith('--github-path='));
    const branchArg = args.find((arg) => arg.startsWith('--branch='));
    const localDirArg = args.find((arg) => arg.startsWith('--local-dir='));
    const githubRepo = githubRepoArg ? githubRepoArg.split('=')[1] : null;
    const githubPath = githubPathArg ? githubPathArg.split('=')[1] : null;
    const branch = branchArg ? branchArg.split('=')[1] : 'main';
    const localDir = localDirArg ? localDirArg.split('=')[1] : null;
    if (!githubRepo && !localDir) {
        console.log('❌ Please provide either --github-repo or --local-dir');
        console.log('\nUsage:');
        console.log('  From GitHub:');
        console.log('    npx ts-node src/scripts/downloadAndUploadVoiceSamples.ts --github-repo=owner/repo --github-path=path/to/files');
        console.log('\n  From local directory:');
        console.log('    npx ts-node src/scripts/downloadAndUploadVoiceSamples.ts --local-dir=/path/to/files');
        process.exit(1);
    }
    // Get enabled voices
    const enabledVoices = (0, voices_1.getEnabledVoices)();
    console.log(`📋 Processing ${enabledVoices.length} voice(s)...\n`);
    let uploaded = 0;
    let failed = 0;
    for (const voice of enabledVoices) {
        console.log(`\n🎤 ${voice.displayName} (${voice.id})`);
        let fileBuffer = null;
        const targetPath = `voice-samples/${voice.id}/preview.mp3`;
        // Try to get file from GitHub or local directory
        if (githubRepo && githubPath) {
            try {
                // Try different possible filenames
                const possibleNames = [
                    `${voice.id}.mp3`,
                    `${voice.displayName}.mp3`,
                    `preview.mp3`,
                    `${voice.id}_preview.mp3`,
                ];
                for (const filename of possibleNames) {
                    try {
                        const githubFilePath = `${githubPath}/${filename}`.replace(/\/\//g, '/');
                        fileBuffer = await downloadFromGitHub(githubRepo, githubFilePath, branch);
                        console.log(`   ✅ Downloaded: ${filename}`);
                        break;
                    }
                    catch (e) {
                        // Try next filename
                        continue;
                    }
                }
                if (!fileBuffer) {
                    console.log(`   ⚠️  File not found in GitHub (tried: ${possibleNames.join(', ')})`);
                    failed++;
                    continue;
                }
            }
            catch (error) {
                console.error(`   ❌ Download failed: ${error.message}`);
                failed++;
                continue;
            }
        }
        else if (localDir) {
            // Try to read from local directory
            const possibleNames = [
                `${voice.id}.mp3`,
                `${voice.displayName}.mp3`,
                `preview.mp3`,
                `${voice.id}_preview.mp3`,
            ];
            let found = false;
            for (const filename of possibleNames) {
                const localPath = (0, path_1.join)(localDir, filename);
                if (fs.existsSync(localPath)) {
                    fileBuffer = fs.readFileSync(localPath);
                    console.log(`   ✅ Found locally: ${filename}`);
                    found = true;
                    break;
                }
            }
            if (!found) {
                console.log(`   ⚠️  File not found locally (tried: ${possibleNames.join(', ')})`);
                failed++;
                continue;
            }
        }
        // Upload to Supabase
        if (fileBuffer) {
            console.log(`   📤 Uploading to Supabase...`);
            const success = await uploadFile(supabase, 'voice-samples', targetPath, fileBuffer);
            if (success) {
                console.log(`   ✅ Uploaded: ${targetPath}`);
                uploaded++;
            }
            else {
                failed++;
            }
        }
    }
    console.log('\n═══════════════════════════════════════════════════════════');
    console.log('📊 SUMMARY');
    console.log('═══════════════════════════════════════════════════════════');
    console.log(`✅ Uploaded: ${uploaded}/${enabledVoices.length}`);
    if (failed > 0) {
        console.log(`❌ Failed: ${failed}/${enabledVoices.length}`);
    }
    console.log('═══════════════════════════════════════════════════════════\n');
}
// Run the script
downloadAndUploadVoiceSamples().catch(err => {
    console.error('❌ Fatal error:', err);
    process.exit(1);
});
//# sourceMappingURL=downloadAndUploadVoiceSamples.js.map