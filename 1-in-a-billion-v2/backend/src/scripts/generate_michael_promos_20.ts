import fs from 'node:fs';
import path from 'node:path';
import axios from 'axios';

const TTS_URL = process.env.TTS_URL || 'http://localhost:8787/api/audio/generate-tts';
function normalizeOutDir(input: string): string {
  const trimmed = String(input || '').trim();
  return trimmed.endsWith('/out')
    ? `${trimmed.replace(/\/out$/, '')}/promo-michael-20`
    : trimmed;
}

const OUT_DIR = normalizeOutDir(
  process.env.OUT_DIR || '/Users/michaelperinwogenburg/Desktop/1-in-a-billion-media/promo-michael-20'
);
const VOICE_URL = 'https://qdfikbgwuauertfmkmzk.supabase.co/storage/v1/object/public/voices/michael.wav';

const lines: string[] = [
  'One in a Billion is a space where you understand yourself deeply before you connect with someone else. You receive narrative readings about your character, your timing, your emotional structure. And from that foundation, meaningful matches appear.',
  'This platform combines self exploration and matchmaking. You explore your own patterns through five systems, and the same systems compare you to others. It becomes both a mirror and a bridge.',
  'You join to discover who you are. The app turns your birth data into layered stories about your psychology and life cycles. Then it uses that structure to reveal compatible connections.',
  'This is about identity and relationship together. You hear your own story first, almost like an audiobook about your life. Then the system quietly searches for resonance.',
  'One in a Billion creates a private home for your relational world. Your insights, your compatibility overlays, your potential matches all live in one place. It feels immersive and intentional.',
  'The core is self knowledge. The matchmaking grows from that. When you understand your own structure, the right connections become clearer.',
  'You explore yourself through astrology, numerology, human design, gene keys, and Kabbalah. Then those same systems compare you to others. It connects inner work with outer relationships.',
  'This app blends narrative depth with structured compatibility. You do not just receive data. You experience your own story, and then see how it interacts with someone else’s.',
  'It offers personal readings, compatibility overlays, and a growing matchmaking field. The experience feels layered and evolving. You return to it over time.',
  'One in a Billion builds a resonance ecosystem. It starts with understanding yourself, expands into comparing patterns, and eventually reveals rare alignment. It is both introspection and connection.',
];

type Take = { name: 'A' | 'B'; exaggeration: number };
const takes: Take[] = [
  { name: 'A', exaggeration: 0.28 },
  { name: 'B', exaggeration: 0.38 },
];

async function sleep(ms: number) {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

async function generateOne(text: string, index: number, take: Take): Promise<string> {
  const base = `${String(index + 1).padStart(2, '0')}_take-${take.name}_michael`;
  const outPath = path.join(OUT_DIR, `${base}.mp3`);

  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const res = await axios.post(
        TTS_URL,
        {
          text,
          provider: 'chatterbox',
          audioUrl: VOICE_URL,
          exaggeration: take.exaggeration,
          includeIntro: false,
        },
        {
          headers: { 'Content-Type': 'application/json' },
          timeout: 12 * 60 * 1000,
        }
      );

      if (!res.data?.success || !res.data?.audioBase64) {
        throw new Error(res.data?.message || 'No audioBase64 returned');
      }

      const buf = Buffer.from(res.data.audioBase64, 'base64');
      fs.writeFileSync(outPath, buf);
      return outPath;
    } catch (err: any) {
      const message = err?.response?.data?.message || err?.message || String(err);
      if (attempt >= 3) throw new Error(`${base} failed after 3 attempts: ${message}`);
      await sleep(1000 * attempt);
    }
  }

  throw new Error(`${base} unexpected generation flow`);
}

async function main() {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  console.log(`🎙️ Generating ${lines.length * takes.length} mp3 files into ${OUT_DIR}`);

  const outputs: string[] = [];
  const startedAt = Date.now();

  for (let i = 0; i < lines.length; i++) {
    for (const take of takes) {
      const file = await generateOne(lines[i], i, take);
      outputs.push(file);
      console.log(`✅ ${path.basename(file)}`);
      await sleep(500);
    }
  }

  const durationSec = ((Date.now() - startedAt) / 1000).toFixed(1);
  const manifestPath = path.join(OUT_DIR, 'manifest.json');
  fs.writeFileSync(manifestPath, JSON.stringify({ generatedAt: new Date().toISOString(), durationSec: Number(durationSec), count: outputs.length, files: outputs }, null, 2));
  console.log(`\n✅ Done: ${outputs.length} files in ${durationSec}s`);
  console.log(`🧾 Manifest: ${manifestPath}`);
}

main().catch((err) => {
  console.error(`❌ ${err?.message || err}`);
  process.exit(1);
});
