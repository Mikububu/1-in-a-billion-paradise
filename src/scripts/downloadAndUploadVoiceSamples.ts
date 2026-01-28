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

import { createSupabaseServiceClient } from '../services/supabaseClient';
import { config } from 'dotenv';
import { join } from 'path';
import * as fs from 'fs';
import * as https from 'https';
import * as http from 'http';
import { getEnabledVoices } from '../config/voices';

config({ path: join(__dirname, '../../.env') });

/**
 * Download a file from GitHub raw content
 */
async function downloadFromGitHub(
    repo: string, // e.g., "owner/repo"
    path: string, // e.g., "audio/henry_miller_sample.mp3"
    branch: string = 'main'
): Promise<Buffer> {
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

            const chunks: Buffer[] = [];
            response.on('data', (chunk) => chunks.push(chunk));
            response.on('end', () => resolve(Buffer.concat(chunks)));
            response.on('error', reject);
        }).on('error', reject);
    });
}

/**
 * Upload a file to Supabase storage
 */
async function uploadFile(
    supabase: any,
    bucket: string,
    filePath: string,
    fileBuffer: Buffer
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
async function downloadAndUploadVoiceSamples() {
    const supabase = createSupabaseServiceClient();
    
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
    const enabledVoices = getEnabledVoices();
    
    console.log(`📋 Processing ${enabledVoices.length} voice(s)...\n`);

    let uploaded = 0;
    let failed = 0;

    for (const voice of enabledVoices) {
        console.log(`\n🎤 ${voice.displayName} (${voice.id})`);
        
        let fileBuffer: Buffer | null = null;
        const targetPath = `voice-samples/${voice.id}/henry_miller_sample.mp3`;

        // Try to get file from GitHub or local directory
        if (githubRepo && githubPath) {
            try {
                // Try different possible filenames
                const possibleNames = [
                    `${voice.id}.mp3`,
                    `${voice.displayName}.mp3`,
                    `henry_miller_sample.mp3`,
                    `${voice.id}_henry_miller_sample.mp3`,
                ];

                for (const filename of possibleNames) {
                    try {
                        const githubFilePath = `${githubPath}/${filename}`.replace(/\/\//g, '/');
                        fileBuffer = await downloadFromGitHub(githubRepo, githubFilePath, branch);
                        console.log(`   ✅ Downloaded: ${filename}`);
                        break;
                    } catch (e: any) {
                        // Try next filename
                        continue;
                    }
                }

                if (!fileBuffer) {
                    console.log(`   ⚠️  File not found in GitHub (tried: ${possibleNames.join(', ')})`);
                    failed++;
                    continue;
                }
            } catch (error: any) {
                console.error(`   ❌ Download failed: ${error.message}`);
                failed++;
                continue;
            }
        } else if (localDir) {
            // Try to read from local directory
            const possibleNames = [
                `${voice.id}.mp3`,
                `${voice.displayName}.mp3`,
                `henry_miller_sample.mp3`,
                `${voice.id}_henry_miller_sample.mp3`,
            ];

            let found = false;
            for (const filename of possibleNames) {
                const localPath = join(localDir, filename);
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
            } else {
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
