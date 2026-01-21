/**
 * Watch and download artifacts for both couples
 * Downloads PDFs and audio files (no songs) as they're generated
 */

import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';
import 'dotenv/config';

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const AKASHA_ANAND_JOB = '05fc81eb-aabe-4440-9662-4f8fa617f16d';
const MICHAEL_CHARMAINE_JOB = '74fa60e5-c742-4cbb-bdef-84daac587880';

const OUTPUT_DIRS = {
  [AKASHA_ANAND_JOB]: '/Users/michaelperinwogenburg/Desktop/Akasha and Anand',
  [MICHAEL_CHARMAINE_JOB]: '/Users/michaelperinwogenburg/Desktop/Michael and Charmaine',
};

const downloadedIds = new Set<string>();

async function downloadNewArtifacts() {
  // Get all PDF and audio artifacts for both jobs
  const { data: artifacts, error } = await supabase
    .from('job_artifacts')
    .select('id, job_id, storage_path, artifact_type')
    .in('job_id', [AKASHA_ANAND_JOB, MICHAEL_CHARMAINE_JOB])
    .in('artifact_type', ['pdf', 'audio_mp3', 'audio_m4a'])
    .order('created_at', { ascending: true });

  if (error) {
    console.error('Error fetching artifacts:', error.message);
    return;
  }

  for (const artifact of artifacts || []) {
    if (downloadedIds.has(artifact.id)) continue;

    const outputDir = OUTPUT_DIRS[artifact.job_id as keyof typeof OUTPUT_DIRS];
    if (!outputDir) continue;

    const filename = artifact.storage_path.split('/').pop()!;
    const localPath = path.join(outputDir, filename);

    // Skip if already exists locally
    if (fs.existsSync(localPath)) {
      downloadedIds.add(artifact.id);
      continue;
    }

    // Download from Supabase Storage
    const { data, error: downloadError } = await supabase.storage
      .from('job-artifacts')
      .download(artifact.storage_path);

    if (downloadError || !data) {
      console.error(`Failed to download ${filename}:`, downloadError?.message);
      continue;
    }

    // Save locally
    const buffer = Buffer.from(await data.arrayBuffer());
    fs.writeFileSync(localPath, buffer);
    downloadedIds.add(artifact.id);

    const coupleName = artifact.job_id === AKASHA_ANAND_JOB ? 'Akasha & Anand' : 'Michael & Charmaine';
    console.log(`✅ [${coupleName}] Downloaded: ${filename} (${Math.round(buffer.length / 1024)} KB)`);
  }
}

async function checkProgress() {
  const { data: tasks } = await supabase
    .from('job_tasks')
    .select('job_id, task_type, status')
    .in('job_id', [AKASHA_ANAND_JOB, MICHAEL_CHARMAINE_JOB]);

  const stats: Record<string, Record<string, number>> = {
    [AKASHA_ANAND_JOB]: { text_pending: 0, text_complete: 0, audio_pending: 0, audio_complete: 0, pdf_pending: 0, pdf_complete: 0 },
    [MICHAEL_CHARMAINE_JOB]: { text_pending: 0, text_complete: 0, audio_pending: 0, audio_complete: 0, pdf_pending: 0, pdf_complete: 0 },
  };

  for (const task of tasks || []) {
    const key = task.task_type.replace('_generation', '');
    const statusKey = task.status === 'complete' ? `${key}_complete` : `${key}_pending`;
    if (stats[task.job_id]) {
      stats[task.job_id][statusKey] = (stats[task.job_id][statusKey] || 0) + 1;
    }
  }

  console.log('\n📊 Progress:');
  console.log('  Akasha & Anand:', `text: ${stats[AKASHA_ANAND_JOB].text_complete}/16, audio: ${stats[AKASHA_ANAND_JOB].audio_complete}/16, pdf: ${stats[AKASHA_ANAND_JOB].pdf_complete}/16`);
  console.log('  Michael & Charmaine:', `text: ${stats[MICHAEL_CHARMAINE_JOB].text_complete}/16, audio: ${stats[MICHAEL_CHARMAINE_JOB].audio_complete}/16, pdf: ${stats[MICHAEL_CHARMAINE_JOB].pdf_complete}/16`);

  const totalComplete = Object.values(stats).reduce((sum, s) => sum + s.text_complete + s.audio_complete + s.pdf_complete, 0);
  const totalTasks = 96 * 2; // 48 tasks per job (no songs)

  if (totalComplete >= totalTasks - 2) { // Allow for some tolerance
    console.log('\n🎉 All done! Check your Desktop folders.');
    process.exit(0);
  }
}

async function main() {
  console.log('🔄 Watching for new artifacts...');
  console.log('   Akasha & Anand →', OUTPUT_DIRS[AKASHA_ANAND_JOB]);
  console.log('   Michael & Charmaine →', OUTPUT_DIRS[MICHAEL_CHARMAINE_JOB]);
  console.log('\nPress Ctrl+C to stop.\n');

  // Initial check
  await downloadNewArtifacts();
  await checkProgress();

  // Poll every 15 seconds
  setInterval(async () => {
    await downloadNewArtifacts();
    await checkProgress();
  }, 15000);
}

main().catch(console.error);
