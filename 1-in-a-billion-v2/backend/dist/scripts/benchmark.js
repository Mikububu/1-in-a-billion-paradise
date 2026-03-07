"use strict";
/**
 * BENCHMARK RUNNER (NO SIMULATOR CLICKING)
 *
 * Runs multiple generation scenarios (provider × nuclear approach) and saves:
 * - job.json (full job + results)
 * - PDFs (copied into scenario folder)
 * - Audio chapters (mp3 or wav, depending on backend availability of ffmpeg)
 *
 * Usage (from backend root):
 *   npm run benchmark -- --providers deepseek,claude --approaches 16-call,5-part
 *
 * Notes:
 * - This script imports routes/jobs to register job processors.
 * - Jobs run sequentially (single worker) so switching llm provider is safe here.
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const path_1 = __importDefault(require("path"));
const fs_1 = __importDefault(require("fs"));
const jobQueue_1 = require("../services/jobQueue");
const llm_1 = require("../services/llm");
const env_1 = require("../config/env");
// Side-effect import: registers processors on the jobQueue
require("../routes/jobs");
function parseArgs(argv) {
    const args = {};
    for (let i = 0; i < argv.length; i++) {
        const a = argv[i];
        if (a.startsWith('--')) {
            const key = a.slice(2);
            const next = argv[i + 1];
            if (!next || next.startsWith('--'))
                args[key] = 'true';
            else {
                args[key] = next;
                i++;
            }
        }
    }
    return args;
}
function ensureDir(dir) {
    fs_1.default.mkdirSync(dir, { recursive: true });
}
function detectAudioExt(buf) {
    if (buf.slice(0, 4).toString('ascii') === 'RIFF')
        return 'wav';
    // MP3 often starts with ID3 or 0xFF 0xFB frame sync
    if (buf.slice(0, 3).toString('ascii') === 'ID3')
        return 'mp3';
    if (buf[0] === 0xff && (buf[1] & 0xe0) === 0xe0)
        return 'mp3';
    return 'mp3';
}
async function sleep(ms) {
    return new Promise((r) => setTimeout(r, ms));
}
async function waitForJob(jobId, timeoutMs) {
    const start = Date.now();
    while (Date.now() - start < timeoutMs) {
        const job = jobQueue_1.jobQueue.getJob(jobId);
        if (!job)
            throw new Error(`Job not found: ${jobId}`);
        if (job.status === 'complete' || job.status === 'error')
            return job;
        await sleep(2000);
    }
    throw new Error(`Timed out waiting for job ${jobId}`);
}
function writeJson(filePath, data) {
    fs_1.default.writeFileSync(filePath, JSON.stringify(data, null, 2));
}
function copyIfExists(srcPath, destPath) {
    if (fs_1.default.existsSync(srcPath))
        fs_1.default.copyFileSync(srcPath, destPath);
}
async function runScenario(opts) {
    const { provider, approach, outDir } = opts;
    console.log('\n============================================================');
    console.log(`🏁 Scenario: provider=${provider} | approach=${approach}`);
    console.log('============================================================');
    llm_1.llm.setProvider(provider);
    const jobType = approach === '16-call' ? 'nuclear_v2' : 'nuclear';
    const jobId = jobQueue_1.jobQueue.createJob(jobType, {
        type: jobType,
        style: 'spicy_surreal',
        relationshipIntensity: 7,
        person1: {
            name: 'Michael',
            birthDate: '1968-08-23',
            birthTime: '13:45',
            birthPlace: 'Villach, Austria',
            latitude: 46.6103,
            longitude: 13.8558,
            timezone: 'Europe/Vienna',
        },
        person2: {
            name: 'Charmaine',
            birthDate: '1983-11-23',
            birthTime: '06:25',
            birthPlace: 'Hong Kong',
            latitude: 22.3193,
            longitude: 114.1694,
            timezone: 'Asia/Hong_Kong',
        },
    });
    console.log(`📌 Job started: ${jobId}`);
    const job = await waitForJob(jobId, 6 * 60 * 60 * 1000); // 6 hours
    writeJson(path_1.default.join(outDir, 'job.json'), job);
    if (job.status === 'error') {
        console.log(`❌ Scenario failed: ${job.error}`);
        return;
    }
    const results = job.results;
    if (!results) {
        console.log('⚠️ No results on job');
        return;
    }
    // Copy PDFs
    const pdfPaths = results.pdfPaths || [];
    ensureDir(path_1.default.join(outDir, 'pdfs'));
    for (const p of pdfPaths) {
        const base = path_1.default.basename(p);
        copyIfExists(p, path_1.default.join(outDir, 'pdfs', base));
    }
    // Write audio chapters (if present)
    ensureDir(path_1.default.join(outDir, 'audio'));
    if (results.documents?.length) {
        for (let i = 0; i < results.documents.length; i++) {
            const d = results.documents[i];
            if (!d.audioBase64)
                continue;
            const buf = Buffer.from(d.audioBase64, 'base64');
            const ext = detectAudioExt(buf);
            const safeTitle = String(d.title || `doc-${i + 1}`)
                .toLowerCase()
                .replace(/[^a-z0-9]+/g, '-')
                .replace(/(^-|-$)/g, '');
            const filename = `${String(i + 1).padStart(2, '0')}-${safeTitle}.${ext}`;
            fs_1.default.writeFileSync(path_1.default.join(outDir, 'audio', filename), buf);
        }
    }
    else if (results.chapters?.length) {
        for (let i = 0; i < results.chapters.length; i++) {
            const ch = results.chapters[i];
            if (!ch.audioBase64)
                continue;
            const buf = Buffer.from(ch.audioBase64, 'base64');
            const ext = detectAudioExt(buf);
            const safeTitle = String(ch.name || `chapter-${i + 1}`)
                .toLowerCase()
                .replace(/[^a-z0-9]+/g, '-')
                .replace(/(^-|-$)/g, '');
            const filename = `${String(i + 1).padStart(2, '0')}-${safeTitle}.${ext}`;
            fs_1.default.writeFileSync(path_1.default.join(outDir, 'audio', filename), buf);
        }
    }
    // Summary
    const totalWords = (results.fullText || '').split(/\s+/).length;
    const totalAudioMinutes = results.totalAudioMinutes ?? undefined;
    const summary = [
        `provider=${provider}`,
        `approach=${approach}`,
        `jobId=${jobId}`,
        `words=${totalWords}`,
        `pdfs=${pdfPaths.length}`,
        `runpodConfigured=${!!(env_1.env.RUNPOD_API_KEY && env_1.env.RUNPOD_ENDPOINT_ID)}`,
        `audioMinutes=${totalAudioMinutes ?? 'unknown'}`,
    ].join('\n');
    fs_1.default.writeFileSync(path_1.default.join(outDir, 'summary.txt'), summary);
    console.log('✅ Scenario complete. Saved to:', outDir);
}
async function main() {
    const args = parseArgs(process.argv.slice(2));
    const providers = (args.providers || 'deepseek,claude')
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);
    const approaches = (args.approaches || '16-call,5-part')
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const outRoot = args.outDir
        ? path_1.default.resolve(args.outDir)
        : path_1.default.resolve(process.cwd(), 'benchmarks', timestamp);
    ensureDir(outRoot);
    writeJson(path_1.default.join(outRoot, 'run-config.json'), { providers, approaches, timestamp });
    console.log(`📦 Output root: ${outRoot}`);
    for (const provider of providers) {
        for (const approach of approaches) {
            const outDir = path_1.default.join(outRoot, provider, approach);
            ensureDir(outDir);
            await runScenario({ provider, approach, outDir });
        }
    }
    console.log('\n🎉 BENCHMARK RUN COMPLETE');
    console.log(`📦 Results: ${outRoot}`);
}
main().catch((e) => {
    console.error('❌ Benchmark failed:', e);
    process.exit(1);
});
//# sourceMappingURL=benchmark.js.map