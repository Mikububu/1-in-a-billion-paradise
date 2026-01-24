/**
 * UPLOAD VOICE MP3 FILES ONLY
 * 
 * Uploads only MP3 voice sample files (skips WAV files).
 * Looks for MP3 files with various naming patterns.
 * 
 * Required MP3 files:
 * - anabella/preview.mp3 (or anabella.mp3, etc.)
 * - dorothy/preview.mp3
 * - ludwig/preview.mp3
 * - grandpa/preview.mp3
 * 
 * Usage:
 *   # From local directory:
 *   npx ts-node src/scripts/uploadVoiceMP3sOnly.ts --local-dir=/path/to/mp3/files
 * 
 *   # From GitHub repo:
 *   npx ts-node src/scripts/uploadVoiceMP3sOnly.ts --github-repo=owner/repo --github-path=path/to/files
 */

import { createSupabaseServiceClient } from '../services/supabaseClient';
import { config } from 'dotenv';
import { join } from 'path';
import * as fs from 'fs';
import * as https from 'https';
import { getEnabledVoices } from '../config/voices';

config({ path: join(__dirname, '../../.env') });

/**
 * Download a file from GitHub raw content
 */
async function downloadFromGitHub(
    repo: string,
    path: string,
    branch: string = 'main'
): Promise<Buffer> {
    return new Promise((resolve, reject) => {
        const url = `https://raw.githubusercontent.com/${repo}/${branch}/${path}`;
        console.log(`   📥 Downloading: ${url}`);
        
        https.get(url, (response) => {
            if (response.statusCode === 301 || response.statusCode === 302) {
                return downloadFromGitHub(repo, path, branch).then(resolve).catch(reject);
            }
            
            if (response.statusCode !== 200) {
                reject(new Error(`HTTP ${response.statusCode}`));
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
 * Find MP3 file in local directory with various naming patterns
 */
function findMP3File(localDir: string, voiceId: string, displayName: string): string | null {
    const possibleNames = [
        `${voiceId}.mp3`,
        `${displayName}.mp3`,
        `preview.mp3`,
        `${voiceId}_preview.mp3`,
        `${displayName}_preview.mp3`,
        // Poetic names (user mentioned)
        `${voiceId}_sample.mp3`,
        `${displayName}_sample.mp3`,
    ];

    for (const name of possibleNames) {
        const path = join(localDir, name);
        if (fs.existsSync(path)) {
            return path;
        }
    }

    // Also check subdirectories
    try {
        const files = fs.readdirSync(localDir);
        for (const file of files) {
            const fullPath = join(localDir, file);
            const stat = fs.statSync(fullPath);
            if (stat.isDirectory()) {
                for (const name of possibleNames) {
                    const subPath = join(fullPath, name);
                    if (fs.existsSync(subPath)) {
                        return subPath;
                    }
                }
            }
        }
    } catch (e) {
        // Ignore errors
    }

    return null;
}

/**
 * Main function
 */
async function uploadVoiceMP3sOnly() {
    const supabase = createSupabaseServiceClient();
    
    if (!supabase) {
        console.error('❌ Supabase not configured');
        process.exit(1);
    }

    console.log('🎤 UPLOAD VOICE MP3 FILES ONLY');
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
        // Try default local location
        const defaultDir = join(__dirname, '../../../1-in-a-billion-frontend/assets/audio/voices');
        if (fs.existsSync(defaultDir)) {
            console.log(`📁 Using default directory: ${defaultDir}\n`);
            // Continue with defaultDir
        } else {
            console.log('❌ Please provide --local-dir or --github-repo');
            console.log('\nUsage:');
            console.log('  From local:');
            console.log('    npx ts-node src/scripts/uploadVoiceMP3sOnly.ts --local-dir=/path/to/mp3/files');
            console.log('\n  From GitHub:');
            console.log('    npx ts-node src/scripts/uploadVoiceMP3sOnly.ts --github-repo=owner/repo --github-path=path/to/files');
            process.exit(1);
        }
    }

    const enabledVoices = getEnabledVoices();
    
    console.log(`📋 Processing ${enabledVoices.length} voice(s)...\n`);

    let uploaded = 0;
    let failed = 0;

    for (const voice of enabledVoices) {
        console.log(`\n🎤 ${voice.displayName} (${voice.id})`);
        
        let fileBuffer: Buffer | null = null;
        const targetPath = `voice-samples/${voice.id}/preview.mp3`;

        // Try to get MP3 file
        if (githubRepo && githubPath) {
            // Try downloading from GitHub
            const possibleNames = [
                `${voice.id}.mp3`,
                `${voice.displayName}.mp3`,
                `preview.mp3`,
            ];

            for (const filename of possibleNames) {
                try {
                    const githubFilePath = `${githubPath}/${filename}`.replace(/\/\//g, '/');
                    fileBuffer = await downloadFromGitHub(githubRepo, githubFilePath, branch);
                    console.log(`   ✅ Downloaded: ${filename}`);
                    break;
                } catch (e: any) {
                    continue;
                }
            }

            if (!fileBuffer) {
                console.log(`   ⚠️  MP3 not found in GitHub`);
                failed++;
                continue;
            }
        } else {
            // Try local directory
            const searchDir = localDir || join(__dirname, '../../../1-in-a-billion-frontend/assets/audio/voices');
            const localPath = findMP3File(searchDir, voice.id, voice.displayName);

            if (localPath) {
                try {
                    fileBuffer = fs.readFileSync(localPath);
                    console.log(`   ✅ Found locally: ${localPath.split('/').pop()}`);
                } catch (e: any) {
                    console.log(`   ❌ Error reading file: ${e.message}`);
                    failed++;
                    continue;
                }
            } else {
                console.log(`   ⚠️  MP3 file not found locally`);
                failed++;
                continue;
            }
        }

        // Upload to Supabase (only MP3 files)
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
    console.log(`✅ Uploaded: ${uploaded}/${enabledVoices.length} MP3 file(s)`);
    if (failed > 0) {
        console.log(`❌ Failed: ${failed}/${enabledVoices.length}`);
        console.log('\n💡 Missing MP3 files need to be uploaded manually or generated.');
    }
    console.log('═══════════════════════════════════════════════════════════\n');
}

// Run the script
uploadVoiceMP3sOnly().catch(err => {
    console.error('❌ Fatal error:', err);
    process.exit(1);
});
