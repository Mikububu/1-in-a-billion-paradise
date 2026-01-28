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

import path from 'path';
import fs from 'fs';
import { jobQueue } from '../services/jobQueue';
import { llm } from '../services/llm';
import { env } from '../config/env';

// Side-effect import: registers processors on the jobQueue
import '../routes/jobs';

type Provider = 'deepseek' | 'claude' | 'openai';
type Approach = '5-part' | '16-call';

function parseArgs(argv: string[]) {
  const args: Record<string, string> = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]!;
    if (a.startsWith('--')) {
      const key = a.slice(2);
      const next = argv[i + 1];
      if (!next || next.startsWith('--')) args[key] = 'true';
      else {
        args[key] = next;
        i++;
      }
    }
  }
  return args;
}

function ensureDir(dir: string) {
  fs.mkdirSync(dir, { recursive: true });
}

function detectAudioExt(buf: Buffer): 'mp3' | 'wav' {
  if (buf.slice(0, 4).toString('ascii') === 'RIFF') return 'wav';
  // MP3 often starts with ID3 or 0xFF 0xFB frame sync
  if (buf.slice(0, 3).toString('ascii') === 'ID3') return 'mp3';
  if (buf[0] === 0xff && (buf[1] & 0xe0) === 0xe0) return 'mp3';
  return 'mp3';
}

async function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

async function waitForJob(jobId: string, timeoutMs: number) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const job = jobQueue.getJob(jobId);
    if (!job) throw new Error(`Job not found: ${jobId}`);
    if (job.status === 'complete' || job.status === 'error') return job;
    await sleep(2000);
  }
  throw new Error(`Timed out waiting for job ${jobId}`);
}

function writeJson(filePath: string, data: unknown) {
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
}

function copyIfExists(srcPath: string, destPath: string) {
  if (fs.existsSync(srcPath)) fs.copyFileSync(srcPath, destPath);
}

async function runScenario(opts: {
  provider: Provider;
  approach: Approach;
  outDir: string;
}) {
  const { provider, approach, outDir } = opts;

  console.log('\n============================================================');
  console.log(`🏁 Scenario: provider=${provider} | approach=${approach}`);
  console.log('============================================================');

  llm.setProvider(provider);

  const jobType = approach === '16-call' ? 'nuclear_v2' : 'nuclear';

  const jobId = jobQueue.createJob(jobType as any, {
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
  writeJson(path.join(outDir, 'job.json'), job);

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
  const pdfPaths: string[] = results.pdfPaths || [];
  ensureDir(path.join(outDir, 'pdfs'));
  for (const p of pdfPaths) {
    const base = path.basename(p);
    copyIfExists(p, path.join(outDir, 'pdfs', base));
  }

  // Write audio chapters (if present)
  ensureDir(path.join(outDir, 'audio'));

  if (results.documents?.length) {
    for (let i = 0; i < results.documents.length; i++) {
      const d: any = results.documents[i]!;
      if (!d.audioBase64) continue;
      const buf = Buffer.from(d.audioBase64, 'base64');
      const ext = detectAudioExt(buf);
      const safeTitle = String(d.title || `doc-${i + 1}`)
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/(^-|-$)/g, '');
      const filename = `${String(i + 1).padStart(2, '0')}-${safeTitle}.${ext}`;
      fs.writeFileSync(path.join(outDir, 'audio', filename), buf);
    }
  } else if (results.chapters?.length) {
    for (let i = 0; i < results.chapters.length; i++) {
      const ch: any = results.chapters[i]!;
      if (!ch.audioBase64) continue;
      const buf = Buffer.from(ch.audioBase64, 'base64');
      const ext = detectAudioExt(buf);
      const safeTitle = String(ch.name || `chapter-${i + 1}`)
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/(^-|-$)/g, '');
      const filename = `${String(i + 1).padStart(2, '0')}-${safeTitle}.${ext}`;
      fs.writeFileSync(path.join(outDir, 'audio', filename), buf);
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
    `runpodConfigured=${!!(env.RUNPOD_API_KEY && env.RUNPOD_ENDPOINT_ID)}`,
    `audioMinutes=${totalAudioMinutes ?? 'unknown'}`,
  ].join('\n');
  fs.writeFileSync(path.join(outDir, 'summary.txt'), summary);

  console.log('✅ Scenario complete. Saved to:', outDir);
}

async function main() {
  const args = parseArgs(process.argv.slice(2));

  const providers = (args.providers || 'deepseek,claude')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean) as Provider[];

  const approaches = (args.approaches || '16-call,5-part')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean) as Approach[];

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const outRoot = args.outDir
    ? path.resolve(args.outDir)
    : path.resolve(process.cwd(), 'benchmarks', timestamp);

  ensureDir(outRoot);
  writeJson(path.join(outRoot, 'run-config.json'), { providers, approaches, timestamp });

  console.log(`📦 Output root: ${outRoot}`);

  for (const provider of providers) {
    for (const approach of approaches) {
      const outDir = path.join(outRoot, provider, approach);
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


