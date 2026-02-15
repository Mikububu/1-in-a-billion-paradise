/**
 * REGENERATE MICHAEL AUDIO TEST
 *
 * Standalone testing script (not part of the app). Output is saved to your Desktop only;
 * nothing is stored in the app or shown in the app.
 *
 * Regenerates Michael Gene Keys (last rendered reading) in its totality, using Elisabeth's
 * voice — same reading, same voice as original — so you can verify if bad stitching is fixed
 * by comparing the new MP3 to the original.
 *
 * 1. Finds Michael's last rendered reading (Michael Gene Keys)
 * 2. Fetches the full text for that reading from storage
 * 3. Regenerates audio via /api/audio/generate-tts (RunPod Chatterbox, 30ms fade) with Elisabeth
 * 4. Saves M4A to ~/Desktop/michael_genekeys_elisabeth_test_<timestamp>.m4a
 *
 * Run:
 *   1. Start backend: npm run dev
 *   2. In another terminal: npm run regenerate:michael-audio
 *
 * Requires: Supabase + RunPod configured in .env (generate-tts uses RunPod Chatterbox).
 *
 * Why test audio might not arrive:
 *   - Backend not running → preflight fails immediately (start npm run dev first).
 *   - RunPod not configured → TTS returns 500; check RUNPOD_API_KEY, RUNPOD_ENDPOINT_ID.
 *   - No Michael artifact in DB → script exits; "Recent artifacts" shows what we saw.
 *   - TTS timeout → Gene Keys text is long; RunPod can be slow (25 min limit).
 *   - Desktop path wrong → we log DESKTOP and check it exists; fix HOME if needed.
 */

import { config } from 'dotenv';
import { join } from 'path';
import fs from 'fs/promises';
import path from 'path';
import axios from 'axios';
import { createSupabaseServiceClient } from '../services/supabaseClient';

// Load .env from backend root (npm run is from backend dir)
config({ path: join(process.cwd(), '.env') });

const HOME = process.env.HOME || '/Users/michaelperinwogenburg';
const DESKTOP = path.join(HOME, 'Desktop');
const ELISABETH_VOICE_URL =
  'https://qdfikbgwuauertfmkmzk.supabase.co/storage/v1/object/public/voices/elisabeth.wav';
const PORT = process.env.PORT || '8787';
const TTS_URL = `http://localhost:${PORT}/api/audio/generate-tts`;

async function main() {
  console.log('🔊 REGENERATE MICHAEL AUDIO TEST');
  console.log('═══════════════════════════════════════════════════════════\n');

  // Diagnostics: where we'll write, and that it's usable
  console.log('📂 Output directory (Desktop):', DESKTOP);
  if (!process.env.HOME) {
    console.warn('   ⚠️  HOME not set; using fallback:', HOME);
  }
  try {
    const st = await fs.stat(DESKTOP);
    if (!st.isDirectory()) {
      console.error('❌ Desktop path exists but is not a directory:', DESKTOP);
      process.exit(1);
    }
  } catch (e: any) {
    console.error('❌ Desktop not found or not accessible:', DESKTOP, e?.message || e);
    process.exit(1);
  }
  console.log('   ✅ Desktop exists and is accessible\n');
  console.log('🌐 TTS URL:', TTS_URL);
  console.log('   (Backend must be running: npm run dev)\n');

  // Preflight: backend reachable?
  try {
    await axios.get(`http://localhost:${PORT}/health`, { timeout: 5000 });
    console.log('   ✅ Backend reachable\n');
  } catch (e: any) {
    if (e.code === 'ECONNREFUSED') {
      console.error('❌ Backend not reachable at', `http://localhost:${PORT}`);
      console.error('   Start it first: cd 1-in-a-billion-backend && npm run dev');
      console.error('   Then run: npm run regenerate:michael-audio');
    } else {
      console.error('❌ Backend health check failed:', e.message);
    }
    process.exit(1);
  }

  const supabase = createSupabaseServiceClient();
  if (!supabase) {
    console.error('❌ Supabase not configured. Set SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY in .env');
    process.exit(1);
  }

  // 1. Find most recent Michael-related audio artifact
  const { data: audioArtifacts, error: audioErr } = await supabase
    .from('job_artifacts')
    .select('id, job_id, task_id, storage_path, metadata, created_at')
    .in('artifact_type', ['audio_mp3', 'audio_m4a'])
    .not('storage_path', 'is', null)
    .order('created_at', { ascending: false });

  if (audioErr) {
    console.error('❌ Failed to fetch artifacts:', audioErr.message);
    process.exit(1);
  }

  const michaelAudio = (audioArtifacts || []).find((a: any) => {
    const name = (a.storage_path || '').split('/').pop()?.toLowerCase() ?? '';
    return name.includes('michael') || name.includes('person_2');
  });

  if (!michaelAudio) {
    console.error('❌ No Michael-related audio found in job_artifacts.');
    console.error('   (Looking for storage_path filename containing "michael" or "person_2")');
    const recent = (audioArtifacts || []).slice(0, 5).map((a: any) => a.storage_path);
    if (recent.length) {
      console.error('   Recent artifacts (first 5):');
      recent.forEach((p: string) => console.error('     -', p));
    }
    process.exit(1);
  }

  console.log(`✅ Found Michael's last audio: ${michaelAudio.storage_path}`);
  console.log(`   Job: ${michaelAudio.job_id} | Task: ${michaelAudio.task_id || 'n/a'}\n`);

  // 2. Get text for this reading
  let text = '';
  const taskId = michaelAudio.task_id;

  if (taskId) {
    const { data: task, error: taskErr } = await supabase
      .from('job_tasks')
      .select('input')
      .eq('id', taskId)
      .single();

    if (!taskErr && task?.input?.textArtifactPath) {
      const storagePath = String(task.input.textArtifactPath);
      const { data: blob, error: dlErr } = await supabase.storage
        .from('job-artifacts')
        .download(storagePath);

      if (!dlErr && blob) {
        text = await blob.text();
        console.log(`✅ Fetched text from ${storagePath} (${text.length} chars)\n`);
      }
    }
  }

  if (!text) {
    // Fallback: same job, any text artifact (e.g. docNum in metadata)
    const docNum = michaelAudio.metadata?.docNum ?? 1;
    const { data: textArtifacts, error: textErr } = await supabase
      .from('job_artifacts')
      .select('storage_path, metadata')
      .eq('job_id', michaelAudio.job_id)
      .eq('artifact_type', 'text');

    if (textErr || !textArtifacts?.length) {
      console.error('❌ Could not find text for this reading.');
      process.exit(1);
    }

    const match = textArtifacts.find(
      (a: any) =>
        a.metadata?.docNum === docNum ||
        Number(a.metadata?.docNum) === docNum ||
        a.metadata?.chapter_index === docNum - 1
    );
    const artifact = match || textArtifacts[0];
    const storagePath = artifact.storage_path;

    const { data: blob, error: dlErr } = await supabase.storage
      .from('job-artifacts')
      .download(storagePath);

    if (dlErr || !blob) {
      console.error('❌ Failed to download text:', dlErr?.message || 'unknown');
      process.exit(1);
    }

    text = await blob.text();
    console.log(`✅ Fetched text from ${storagePath} (${text.length} chars)\n`);
  }

  if (!text || text.length < 50) {
    console.error('❌ Text too short or empty.');
    process.exit(1);
  }

  // 3. Regenerate audio via local TTS API (RunPod Chatterbox, 30ms fade) — Elisabeth, same as original
  console.log('🎙️  Regenerating Michael Gene Keys (full text) with Elisabeth voice...');
  console.log(`   Text length: ${text.length} chars`);
  console.log('   (RunPod Chatterbox, 30ms fade — can take several minutes)\n');

  try {
    const res = await axios.post(
      TTS_URL,
      {
        text,
        provider: 'chatterbox',
        exaggeration: 0.3,
        audioUrl: ELISABETH_VOICE_URL,
      },
      {
        headers: { 'Content-Type': 'application/json' },
        timeout: 25 * 60 * 1000,
      }
    );

    if (!res.data?.success || !res.data?.audioBase64) {
      console.error('❌ TTS returned no audio.');
      console.error('   success:', res.data?.success);
      console.error('   message:', res.data?.message ?? '(none)');
      console.error('   has audioBase64:', !!res.data?.audioBase64);
      if (res.data?.error) console.error('   error:', res.data.error);
      process.exit(1);
    }

    const buf = Buffer.from(res.data.audioBase64, 'base64');
    const ext = (res.data.format || 'm4a') === 'mp3' ? 'mp3' : 'm4a';
    const outName = `michael_genekeys_elisabeth_test_${new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)}.${ext}`;
    const outPath = path.join(DESKTOP, outName);

    console.log('💾 Writing to Desktop:', outPath);
    await fs.writeFile(outPath, buf);

    const stat = await fs.stat(outPath);
    const sizeKb = ((stat as any).size || buf.length) / 1024;
    console.log('\n═══════════════════════════════════════════════════════════');
    console.log('✅ Done! Audio saved to Desktop:');
    console.log(`   ${outPath}`);
    console.log(`   ${sizeKb.toFixed(1)} KB`);
    console.log('═══════════════════════════════════════════════════════════\n');
  } catch (e: any) {
    if (e.code === 'ECONNREFUSED') {
      console.error('❌ Could not reach backend.');
      console.error('   Start it first: cd 1-in-a-billion-backend && npm run dev');
      console.error('   Then run this script again.');
    } else if (e.code === 'ECONNABORTED' || e.message?.includes('timeout')) {
      console.error('❌ TTS request timed out (25 min).');
      console.error('   Gene Keys text may be very long; RunPod can be slow.');
    } else if (e.response) {
      console.error('❌ TTS request failed:', e.response.status, e.response.statusText);
      console.error('   body:', JSON.stringify(e.response.data, null, 2).slice(0, 500));
      if (e.response.status === 500 && e.response.data?.message?.includes('RunPod')) {
        console.error('   → RunPod may not be configured (RUNPOD_API_KEY, RUNPOD_ENDPOINT_ID).');
      }
    } else {
      console.error('❌ TTS request failed:', e.message);
      if (e.stack) console.error(e.stack);
    }
    process.exit(1);
  }
}

main();
