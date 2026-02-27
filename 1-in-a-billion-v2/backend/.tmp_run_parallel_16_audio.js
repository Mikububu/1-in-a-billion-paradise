const fs = require('fs');
const path = require('path');
const axios = require('axios');

const MEDIA_DIR = process.env.MEDIA_DIR || '/Users/michaelperinwogenburg/Desktop/1-in-a-billion-media';
const TTS_URL = process.env.TTS_URL || 'https://1-in-a-billion-backend.fly.dev/api/audio/generate-tts';
const HEALTH_URL = process.env.HEALTH_URL || 'https://1-in-a-billion-backend.fly.dev/health';
const VOICE_URL = 'https://qdfikbgwuauertfmkmzk.supabase.co/storage/v1/object/public/voices/david.wav';
const startTsPath = '/tmp/mt16_logs/start_ts';
const MAX_CONCURRENCY = parseInt(process.env.AUDIO_PAR || '16', 10);
const RETRIES = parseInt(process.env.AUDIO_RETRIES || '1', 10);

function prettyName(token) {
  return String(token || '').replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase()).trim();
}

function detectSystemLabel(baseName) {
  const value = baseName.toLowerCase();
  if (value.includes('western-astrology')) return 'Western Astrology';
  if (value.includes('vedic-astrology-jyotish') || value.includes('vedic-astrology')) return 'Vedic Astrology';
  if (value.includes('human-design')) return 'Human Design';
  if (value.includes('gene-keys')) return 'Gene Keys';
  if (value.includes('kabbalah')) return 'Kabbalah';
  if (value.includes('verdict')) return 'Final Verdict';
  return 'Compatibility';
}

function buildSpokenIntroFromFile(baseName) {
  const generatedOn = new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' });
  const system = detectSystemLabel(baseName);

  if (baseName.startsWith('verdict_')) {
    const parts = baseName.split('_');
    const p1 = prettyName(parts[1] || 'Person 1');
    const p2 = prettyName(parts[2] || 'Person 2');
    return `This is the final verdict reading for ${p1} and ${p2}. Generated on ${generatedOn} by 1 in a billion app, powered by forbidden-yoga dot com.`;
  }

  if (baseName.startsWith('overlay_')) {
    const parts = baseName.split('_');
    const p1 = prettyName(parts[1] || 'Person 1');
    const p2 = prettyName(parts[2] || 'Person 2');
    return `This is a ${system} compatibility reading for ${p1} and ${p2}. Generated on ${generatedOn} by 1 in a billion app, powered by forbidden-yoga dot com.`;
  }

  if (baseName.startsWith('individual_')) {
    const parts = baseName.split('_');
    const person = prettyName(parts[1] || 'Person 1');
    return `This is a ${system} reading for ${person}. Generated on ${generatedOn} by 1 in a billion app, powered by forbidden-yoga dot com.`;
  }

  return `This is an audio reading. Generated on ${generatedOn} by 1 in a billion app, powered by forbidden-yoga dot com.`;
}

function getTargetFiles() {
  const all = fs.readdirSync(MEDIA_DIR)
    .filter(f => f.endsWith('.reading.txt'))
    .map(f => ({ file: f, p: path.join(MEDIA_DIR, f), mtime: fs.statSync(path.join(MEDIA_DIR, f)).mtimeMs / 1000 }));

  let filtered = all;
  if (fs.existsSync(startTsPath)) {
    const startTs = parseInt(fs.readFileSync(startTsPath, 'utf8').trim(), 10);
    const byStart = all.filter(x => x.mtime >= startTs);
    if (byStart.length > 0) filtered = byStart;
  }

  // Fallback: keep only latest 16 readings to avoid huge historical batches.
  if (filtered.length > 16) {
    filtered = [...filtered].sort((a, b) => b.mtime - a.mtime).slice(0, 16);
  }

  return filtered.sort((a, b) => a.file.localeCompare(b.file));
}

async function generateOne(fileObj) {
  const file = fileObj.file;
  const textPath = fileObj.p;
  const text = fs.readFileSync(textPath, 'utf8');
  const baseName = file.replace('.reading.txt', '');
  const outPath = path.join(MEDIA_DIR, `${baseName}.mp3`);
  const spokenIntro = buildSpokenIntroFromFile(baseName);

  if (fs.existsSync(outPath)) {
    return { file, baseName, success: true, skipped: true, durationSec: 0, outPath };
  }

  const t0 = Date.now();
  let lastErr = '';
  for (let attempt = 1; attempt <= RETRIES + 1; attempt++) {
    try {
      const res = await axios.post(
        TTS_URL,
        {
          text,
          provider: 'chatterbox',
          exaggeration: 0.3,
          audioUrl: VOICE_URL,
          title: baseName.replace(/_/g, ' '),
          spokenIntro,
          includeIntro: true,
        },
        {
          headers: { 'Content-Type': 'application/json' },
          timeout: 45 * 60 * 1000,
          maxContentLength: Infinity,
          maxBodyLength: Infinity,
        }
      );

      if (!res.data?.success || !res.data?.audioBase64) {
        throw new Error(res.data?.message || 'no audioBase64');
      }

      const buf = Buffer.from(res.data.audioBase64, 'base64');
      fs.writeFileSync(outPath, buf);
      const durationSec = Number(((Date.now() - t0) / 1000).toFixed(1));
      return {
        file,
        baseName,
        success: true,
        skipped: false,
        durationSec,
        outPath,
        sizeKb: Number((buf.length / 1024).toFixed(1)),
      };
    } catch (e) {
      lastErr = e?.response?.data?.message || e?.message || String(e);
      if (attempt <= RETRIES) {
        await new Promise(r => setTimeout(r, 2000 * attempt));
      }
    }
  }

  const durationSec = Number(((Date.now() - t0) / 1000).toFixed(1));
  return { file, baseName, success: false, skipped: false, durationSec, error: lastErr };
}

async function runPool(items, concurrency) {
  const results = new Array(items.length);
  let next = 0;
  async function worker(workerId) {
    while (true) {
      const i = next++;
      if (i >= items.length) return;
      const item = items[i];
      console.log(`[W${workerId}] ${i + 1}/${items.length} start ${item.file}`);
      const r = await generateOne(item);
      results[i] = r;
      if (r.success) {
        const flag = r.skipped ? 'SKIP' : 'OK';
        console.log(`[W${workerId}] ${i + 1}/${items.length} ${flag} ${r.baseName} ${r.durationSec}s`);
      } else {
        console.log(`[W${workerId}] ${i + 1}/${items.length} FAIL ${r.baseName} ${r.durationSec}s :: ${r.error}`);
      }
    }
  }

  const workers = [];
  for (let w = 1; w <= Math.min(concurrency, items.length); w++) workers.push(worker(w));
  await Promise.all(workers);
  return results;
}

(async () => {
  const t0 = Date.now();
  console.log('MEDIA_DIR='+MEDIA_DIR);
  console.log('readingTxtCount=' + fs.readdirSync(MEDIA_DIR).filter(f => f.endsWith('.reading.txt')).length);
  const files = getTargetFiles();
  if (!files.length) {
    console.error('No target .reading.txt files found');
    process.exit(1);
  }
  console.log(`Target files: ${files.length}`);
  console.log(`Concurrency: ${MAX_CONCURRENCY}`);

  try {
    const health = await axios.get(HEALTH_URL, { timeout: 10000 });
    console.log(`Health: ${health.status}`);
  } catch (e) {
    console.error('Backend health failed', e?.message || e);
    process.exit(2);
  }

  const results = await runPool(files, MAX_CONCURRENCY);
  const success = results.filter(r => r?.success).length;
  const failed = results.filter(r => r && !r.success).length;
  const skipped = results.filter(r => r?.skipped).length;
  const elapsed = Number(((Date.now() - t0) / 1000).toFixed(1));

  const report = {
    generatedAt: new Date().toISOString(),
    mediaDir: MEDIA_DIR,
    concurrency: MAX_CONCURRENCY,
    retries: RETRIES,
    totalFiles: results.length,
    success,
    failed,
    skipped,
    elapsedSec: elapsed,
    avgSecSuccessful: success ? Number((results.filter(r => r?.success && !r?.skipped).reduce((a, r) => a + (r.durationSec || 0), 0) / Math.max(1, success - skipped)).toFixed(1)) : 0,
    results,
  };

  const stamp = new Date().toISOString().replace(/[:.]/g, '').replace('T', '_').slice(0, 15);
  const reportPath = path.join(MEDIA_DIR, `audio_parallel_timing_${stamp}_c${MAX_CONCURRENCY}.json`);
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));

  console.log('======================================');
  console.log(`DONE success=${success} failed=${failed} skipped=${skipped} elapsed=${elapsed}s`);
  console.log(`REPORT ${reportPath}`);
  if (failed > 0) process.exitCode = 3;
})();
