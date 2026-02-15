import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import os from 'node:os';
import { spawnSync } from 'node:child_process';
import { pipeline } from 'node:stream/promises';
import { Readable } from 'node:stream';
import { loadEnvFromRepoRoot } from './lib/env.mjs';
import { fetchBinary, fetchJson, sleep } from './lib/http.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '../..');

loadEnvFromRepoRoot({ repoRoot });

function getArg(flag) {
  const idx = process.argv.indexOf(flag);
  if (idx === -1) return null;
  return process.argv[idx + 1] || null;
}

function hasFlag(flag) {
  return process.argv.includes(flag);
}

function requireArg(name, val) {
  if (!val) throw new Error(`Missing required arg: ${name}`);
  return val;
}

function nowIso() {
  return new Date().toISOString();
}

function normalizeBaseUrl(url) {
  return String(url || '').replace(/\/+$/, '');
}

const CORE_API_URL = normalizeBaseUrl(
  process.env.CORE_API_URL ||
    process.env.EXPO_PUBLIC_CORE_API_URL ||
    'https://1-in-a-billion-backend.fly.dev'
);

const USER_ID = process.env.USER_ID || 'f23f2057-5a74-4fc7-ab39-2a1f17729c2c';
const PERSON1_ID = process.env.PERSON1_ID || `self-${USER_ID}`;
const PERSON2_ID = process.env.PERSON2_ID || 'partner-tata-umana-1982';
const MIN_WORDS_DEFAULT = Number(process.env.MIN_WORDS || 4500);
const MIN_AUDIO_MINUTES_DEFAULT = Number(process.env.MIN_AUDIO_MINUTES || 25);

const DEFAULT_OUT_DIR = path.join(os.homedir(), 'Desktop', '1-in-a-billion-media');
const OUT_DIR = path.resolve(process.env.PIPELINE_OUT_DIR || getArg('--out-dir') || DEFAULT_OUT_DIR);

const P1 = {
  id: PERSON1_ID,
  name: 'Michael',
  birthDate: '1968-08-23',
  birthTime: '13:45',
  timezone: 'Europe/Vienna',
  latitude: 46.6103,
  longitude: 13.8558,
};

const P2 = {
  id: PERSON2_ID,
  name: 'Tata Umana',
  birthDate: '1982-06-30',
  birthTime: '15:15',
  timezone: 'America/Bogota',
  latitude: 4.711,
  longitude: -74.0721,
};

function readFileBase64(p) {
  const buf = fs.readFileSync(p);
  return buf.toString('base64');
}

function formatMinutes(sec) {
  if (!Number.isFinite(sec) || sec <= 0) return null;
  return (sec / 60).toFixed(2);
}

function extForContentType(contentType) {
  const ct = String(contentType || '').toLowerCase();
  if (ct.includes('audio/mpeg')) return '.mp3';
  if (ct.includes('audio/mp3')) return '.mp3';
  // Fly/Supabase often serve AAC in an MP4 container for narration.
  if (ct.includes('audio/mp4')) return '.m4a';
  if (ct.includes('audio/x-m4a')) return '.m4a';
  if (ct.includes('audio/aac')) return '.aac';
  if (ct.includes('audio/wav')) return '.wav';
  if (ct.includes('application/pdf')) return '.pdf';
  return '';
}

function safeSegment(s) {
  return String(s || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 60);
}

async function downloadToFile(url, outPath, { headers = {}, timeoutMs = 10 * 60_000 } = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { headers, signal: controller.signal });
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      const err = new Error(`HTTP ${res.status} fetching ${url}: ${text || 'failed'}`);
      err.status = res.status;
      err.url = url;
      throw err;
    }

    if (!res.body) {
      throw new Error(`No body returned for ${url}`);
    }

    fs.mkdirSync(path.dirname(outPath), { recursive: true });
    const fileStream = fs.createWriteStream(outPath);
    await pipeline(Readable.fromWeb(res.body), fileStream);
    return res.headers;
  } finally {
    clearTimeout(timer);
  }
}

function getAudioDurationSecondsViaFfprobe(url) {
  const args = [
    '-v',
    'error',
    '-show_entries',
    'format=duration',
    '-of',
    'default=noprint_wrappers=1:nokey=1',
    url,
  ];
  const res = spawnSync('ffprobe', args, { encoding: 'utf8', timeout: 120_000 });
  if (res.status !== 0) {
    const msg = (res.stderr || res.stdout || '').trim().slice(-500);
    throw new Error(`ffprobe failed for ${url}: ${msg || 'unknown error'}`);
  }
  const raw = String(res.stdout || '').trim();
  const sec = Number(raw);
  if (!Number.isFinite(sec) || sec <= 0) {
    throw new Error(`ffprobe returned invalid duration for ${url}: "${raw}"`);
  }
  return sec;
}

async function generatePortrait({ imagePath, personId }) {
  const photoBase64 = readFileBase64(imagePath);
  const res = await fetchJson(`${CORE_API_URL}/api/profile/portrait`, {
    method: 'POST',
    headers: { 'X-User-Id': USER_ID },
    timeoutMs: 10 * 60_000,
    body: { photoBase64, personId },
  });
  if (!res?.success) throw new Error(`[portrait] Failed: ${res?.error || 'unknown error'}`);
  console.log('[portrait] ok:', { personId, imageUrl: res.imageUrl });
  return res.imageUrl;
}

async function getPortraitUrl(personId) {
  const url = personId
    ? `${CORE_API_URL}/api/profile/portrait/${encodeURIComponent(personId)}`
    : `${CORE_API_URL}/api/profile/portrait`;
  try {
    const res = await fetchJson(url, {
      method: 'GET',
      headers: { 'X-User-Id': USER_ID },
      timeoutMs: 30_000,
    });
    if (!res?.success) return null;
    return res.imageUrl || null;
  } catch (err) {
    // Expected in clean runs before any photo upload.
    if (err && (err.status === 404 || err.status === 401)) return null;
    throw err;
  }
}

async function generateCoupleImage({ portrait1Url, portrait2Url }) {
  const res = await fetchJson(`${CORE_API_URL}/api/couples/image`, {
    method: 'POST',
    headers: { 'X-User-Id': USER_ID },
    timeoutMs: 10 * 60_000,
    body: {
      person1Id: PERSON1_ID,
      person2Id: PERSON2_ID,
      portrait1Url,
      portrait2Url,
      forceRegenerate: true,
    },
  });
  if (!res?.success) throw new Error(`[couple] Failed: ${res?.error || 'unknown error'}`);
  console.log('[couple] ok:', { coupleImageUrl: res.coupleImageUrl });
  return res.coupleImageUrl;
}

async function startJob({ type, systems }) {
  const minWords = Number(getArg('--min-words') || MIN_WORDS_DEFAULT);
  const lengthInjection = `OUTPUT LENGTH HARD FLOOR: Write at least ${minWords} words. If you are about to end early, continue writing with more depth until you reach the minimum. Do not mention word count.`;

  const payload = {
    type,
    systems,
    style: 'spicy_surreal',
    person1: P1,
    person2: type === 'extended' ? undefined : P2,
    relationshipIntensity: 5,
    relationshipContext: `Testing pipeline. ${lengthInjection}`,
    personalContext: `Testing pipeline. ${lengthInjection}`,
  };

  const res = await fetchJson(`${CORE_API_URL}/api/jobs/v2/start`, {
    method: 'POST',
    headers: { 'X-User-Id': USER_ID },
    timeoutMs: 60_000,
    body: payload,
  });

  if (!res?.success || !res?.jobId) throw new Error(`[job] start failed: ${res?.error || 'unknown'}`);
  console.log('[job] started:', { type, jobId: res.jobId });
  return res.jobId;
}

async function waitForJobComplete(jobId, { timeoutMs }) {
  const started = Date.now();
  let lastLog = 0;

  while (Date.now() - started < timeoutMs) {
    const [jobRes, tasksRes] = await Promise.all([
      fetchJson(`${CORE_API_URL}/api/jobs/v2/${jobId}`, { timeoutMs: 30_000 }),
      fetchJson(`${CORE_API_URL}/api/jobs/v2/${jobId}/tasks`, { timeoutMs: 30_000 }),
    ]);

    const job = jobRes?.job;
    const status = job?.status || 'unknown';
    const progress = job?.progress ?? null;

    const tasks = tasksRes?.tasks || [];
    const counts = tasks.reduce(
      (acc, t) => {
        acc.total += 1;
        acc[t.status] = (acc[t.status] || 0) + 1;
        return acc;
      },
      { total: 0 }
    );

    if (Date.now() - lastLog > 10_000) {
      lastLog = Date.now();
      console.log('[job] status:', {
        jobId,
        status,
        progress,
        tasks: counts,
      });
    }

    // The backend sometimes marks a job complete before post-processing media finishes.
    // We treat the job as complete ONLY when all tasks are complete.
    const allTasksComplete = counts.total > 0 && counts.complete === counts.total;

    if (counts.failed > 0 || status === 'failed') {
      throw new Error(`[job] failed: ${job?.error || 'unknown error'}`);
    }

    if (allTasksComplete) return job;

    await sleep(5_000);
  }

  throw new Error(`[job] timeout waiting for completion (${Math.round(timeoutMs / 1000)}s): ${jobId}`);
}

async function deleteJob(jobId) {
  try {
    const res = await fetchJson(`${CORE_API_URL}/api/jobs/v2/${jobId}`, { method: 'DELETE', timeoutMs: 30_000 });
    console.log('[job] deleted:', res);
  } catch (err) {
    console.warn('[job] delete failed (non-fatal):', err?.message || err);
  }
}

function basicPdfHasEmbeddedImages(buffer) {
  // Heuristic: pdfkit output commonly includes these markers even when compressed.
  const hay = buffer.toString('latin1');
  return hay.includes('/Subtype /Image') || hay.includes('/Image') || hay.includes('PNG') || hay.includes('JFIF');
}

async function downloadAllMedia(jobId, { minAudioMinutes }) {
  const jobRes = await fetchJson(`${CORE_API_URL}/api/jobs/v2/${jobId}`, { timeoutMs: 30_000 });

  // Flatten output: all files go into ONE folder (no per-job subfolders).
  const outDir = OUT_DIR;
  fs.mkdirSync(outDir, { recursive: true });

  const docs = jobRes?.job?.results?.documents || [];
  const docNums = Array.from(new Set(docs.map((d) => d.docNum).filter((n) => Number.isFinite(n)))).sort(
    (a, b) => a - b
  );

  if (docNums.length === 0) {
    console.warn('[pdf] No docNums discovered on job.results.documents; skipping downloads.');
    return;
  }

  const minSeconds = minAudioMinutes * 60;
  const audioFailures = [];

  for (const docNum of docNums) {
    const meta = docs.find((d) => d.docNum === docNum) || {};
    const system = safeSegment(meta.system || 'unknown');
    const docType = safeSegment(meta.docType || 'unknown');
    const who = (() => {
      const dt = String(meta.docType || '').toLowerCase();
      if (dt === 'person2') return safeSegment(P2.name);
      if (dt === 'overlay' || dt === 'verdict' || dt === 'synastry') return safeSegment(`${P1.name}_${P2.name}`);
      return safeSegment(P1.name);
    })();

    // Keep a short job id prefix to avoid collisions across repeated runs,
    // but make filenames human-readable by including names + system.
    const base = `${who}_${system}_${docType}_job_${String(jobId).slice(0, 8)}_doc_${String(docNum).padStart(2, '0')}`;

    const { buffer, headers } = await fetchBinary(`${CORE_API_URL}/api/jobs/v2/${jobId}/pdf/${docNum}`, {
      timeoutMs: 120_000,
    });
    const pageCount = headers.get('x-page-count');
    const outPath = path.join(outDir, `${base}.pdf`);
    fs.writeFileSync(outPath, buffer);

    const hasImages = basicPdfHasEmbeddedImages(buffer);
    console.log('[pdf] downloaded:', { docNum, outPath, bytes: buffer.length, pageCount, hasEmbeddedImages: hasImages });

    // Narration audio (stream to disk, then ffprobe local file)
    const audioUrl = `${CORE_API_URL}/api/jobs/v2/${jobId}/audio/${docNum}`;
    const audioTmpPath = path.join(outDir, `${base}.audio`);
    const audioHeaders = await downloadToFile(audioUrl, audioTmpPath, { timeoutMs: 60 * 60_000 });
    const audioExt = extForContentType(audioHeaders.get('content-type')) || '.mp3';
    const audioPath = `${audioTmpPath}${audioExt}`;
    fs.renameSync(audioTmpPath, audioPath);

    const audioSeconds = getAudioDurationSecondsViaFfprobe(audioPath);
    const audioMinutes = Number(formatMinutes(audioSeconds));
    console.log('[audio] downloaded:', { docNum, audioPath, minutes: audioMinutes });
    if (audioSeconds < minSeconds) {
      audioFailures.push({ docNum, minutes: audioMinutes, minAudioMinutes });
    }

    // Optional song audio
    const songUrl = `${CORE_API_URL}/api/jobs/v2/${jobId}/song/${docNum}`;
    const songTmpPath = path.join(outDir, `${base}.song`);
    try {
      const songHeaders = await downloadToFile(songUrl, songTmpPath, { timeoutMs: 60 * 60_000 });
      const songExt = extForContentType(songHeaders.get('content-type')) || '.mp3';
      const songPath = `${songTmpPath}${songExt}`;
      fs.renameSync(songTmpPath, songPath);
      console.log('[song] downloaded:', { docNum, songPath });
    } catch (err) {
      fs.existsSync(songTmpPath) && fs.rmSync(songTmpPath, { force: true });
      console.warn('[song] skipped:', { docNum, reason: err?.message || String(err) });
    }
  }

  if (audioFailures.length > 0) {
    console.error('[audio] FAIL: some narration audios below minimum minutes:', { minAudioMinutes });
    console.table(audioFailures);
    throw new Error(`[audio] Job ${jobId} produced short narration audio (minAudioMinutes=${minAudioMinutes}).`);
  }
}

async function validateAudioDurations(jobId, { minAudioMinutes }) {
  const urlFor = (docNum) => `${CORE_API_URL}/api/jobs/v2/${jobId}/audio/${docNum}`;

  // Discover available docNums by asking the job endpoint (documents list has docNum even when URLs are missing).
  const jobRes = await fetchJson(`${CORE_API_URL}/api/jobs/v2/${jobId}`, { timeoutMs: 30_000 });
  const docs = jobRes?.job?.results?.documents || [];
  const docNums = Array.from(new Set(docs.map((d) => d.docNum).filter((n) => Number.isFinite(n)))).sort((a, b) => a - b);

  if (docNums.length === 0) {
    console.warn('[audio] No docNums discovered; skipping duration checks.');
    return;
  }

  const minSeconds = minAudioMinutes * 60;
  const failures = [];
  for (const docNum of docNums) {
    const u = urlFor(docNum);
    const sec = getAudioDurationSecondsViaFfprobe(u);
    const minutes = Number(formatMinutes(sec));
    console.log('[audio] duration:', { docNum, minutes });
    if (sec < minSeconds) failures.push({ docNum, minutes, minAudioMinutes });
  }

  if (failures.length > 0) {
    console.error('[audio] FAIL: some audios below minimum minutes:', { minAudioMinutes });
    console.table(failures);
    throw new Error(`[audio] Job ${jobId} produced short audio (minAudioMinutes=${minAudioMinutes}).`);
  }

  console.log('[audio] ok:', { minAudioMinutes, docsChecked: docNums.length });
}

async function main() {
  const p1Image = getArg('--p1-image');
  const p2Image = getArg('--p2-image');
  const stopAfter = getArg('--stop-after'); // "single" | "synastry"
  const startAt = getArg('--start-at') || 'single'; // "single" | "synastry" | "bundle"
  const minWords = Number(getArg('--min-words') || MIN_WORDS_DEFAULT);
  const minAudioMinutes = Number(getArg('--min-audio-minutes') || MIN_AUDIO_MINUTES_DEFAULT);

  if (!hasFlag('--skip-images')) {
    requireArg('--p1-image', p1Image);
    requireArg('--p2-image', p2Image);
  }

  console.log('[config]', { CORE_API_URL, USER_ID, PERSON1_ID, PERSON2_ID, OUT_DIR });

  let p1PortraitUrl = await getPortraitUrl(PERSON1_ID);
  let p2PortraitUrl = await getPortraitUrl(PERSON2_ID);

  if (!hasFlag('--skip-images')) {
    p1PortraitUrl = await generatePortrait({ imagePath: p1Image, personId: PERSON1_ID });
    p2PortraitUrl = await generatePortrait({ imagePath: p2Image, personId: PERSON2_ID });
    await generateCoupleImage({ portrait1Url: p1PortraitUrl, portrait2Url: p2PortraitUrl });
  }

  let singleJobId = null;
  if (startAt === 'single') {
    // Stage 1: single (extended, 1 system)
    singleJobId = await startJob({ type: 'extended', systems: ['western'] });
    await waitForJobComplete(singleJobId, { timeoutMs: 60 * 60_000 });
    await downloadAllMedia(singleJobId, { minAudioMinutes });
    if (stopAfter === 'single') {
      console.log('[done] Stopped after single job as requested:', { singleJobId, out: OUT_DIR });
      return;
    }
  } else {
    console.log('[skip] Skipping single stage (startAt=', startAt, ')');
  }

  // Stage 2: synastry
  let synJobId = null;
  if (startAt === 'single' || startAt === 'synastry') {
    synJobId = await startJob({ type: 'synastry', systems: ['western', 'vedic', 'kabbalah'] });
    await waitForJobComplete(synJobId, { timeoutMs: 90 * 60_000 });
    await downloadAllMedia(synJobId, { minAudioMinutes });
    if (stopAfter === 'synastry') {
      console.log('[done] Stopped after synastry job as requested:', { singleJobId, synJobId, out: OUT_DIR });
      return;
    }
  } else {
    console.log('[skip] Skipping synastry stage (startAt=bundle)');
  }

  // Stage 3: bundle (nuclear_v2 in backend contract)
  const bundleJobId = await startJob({
    type: 'nuclear_v2',
    systems: ['western', 'vedic', 'human_design', 'gene_keys', 'kabbalah'],
  });
  await waitForJobComplete(bundleJobId, { timeoutMs: 6 * 60 * 60_000 });
  await downloadAllMedia(bundleJobId, { minAudioMinutes });

  console.log('[done] E2E pipeline complete:', { singleJobId, synJobId, bundleJobId, out: OUT_DIR });
}

main().catch((err) => {
  console.error('E2E pipeline failed:', err?.message || err);
  process.exit(1);
});
