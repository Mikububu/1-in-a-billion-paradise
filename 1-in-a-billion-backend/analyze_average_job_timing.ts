import { createSupabaseServiceClient } from './src/services/supabaseClient';
import { config } from 'dotenv';
import { join } from 'path';

config({ path: join(__dirname, '.env') });

const supabase = createSupabaseServiceClient();

if (!supabase) {
  console.error('❌ Supabase not configured');
  process.exit(1);
}

async function analyzeAverageJobTiming() {
  console.log('📊 Analyzing average job timing for ALL recent jobs...\n');

  // Get all recent completed jobs
  const { data: allJobs, error: jobError } = await supabase
    .from('jobs')
    .select('id, status, created_at, updated_at, params, type')
    .eq('status', 'complete')
    .order('created_at', { ascending: false })
    .limit(50);

  if (jobError) {
    console.error('❌ Error fetching jobs:', jobError.message);
    return;
  }

  if (!allJobs || allJobs.length === 0) {
    console.log('⚠️  No completed jobs found');
    return;
  }

  console.log(`Found ${allJobs.length} completed job(s)\n`);

  const jobStats: Array<{
    jobId: string;
    type: string;
    personName: string;
    totalTime: number;
    textTasks: number;
    pdfTasks: number;
    audioTasks: number;
    songTasks: number;
    avgTextTime: number;
    avgPdfTime: number;
    avgAudioTime: number;
    avgSongTime: number;
  }> = [];

  for (const job of allJobs) {
    const created = new Date(job.created_at);
    const updated = new Date(job.updated_at);
    const totalTime = Math.floor((updated.getTime() - created.getTime()) / 1000);

    // Get tasks with timing
    const { data: tasks } = await supabase
      .from('job_tasks')
      .select('task_type, status, created_at, updated_at, sequence')
      .eq('job_id', job.id)
      .eq('status', 'complete')
      .order('sequence', { ascending: true });

    if (!tasks || tasks.length === 0) continue;

    const jobStartTime = created.getTime();
    
    const textTasks = tasks.filter(t => t.task_type === 'text_generation');
    const pdfTasks = tasks.filter(t => t.task_type === 'pdf_generation');
    const audioTasks = tasks.filter(t => t.task_type === 'audio_generation' || t.task_type === 'audio_mp3' || t.task_type === 'audio_m4a');
    const songTasks = tasks.filter(t => t.task_type === 'song_generation');

    const calcAvgTime = (taskList: any[]) => {
      if (taskList.length === 0) return 0;
      const total = taskList.reduce((sum, t) => {
        const taskCreated = new Date(t.created_at);
        const taskUpdated = new Date(t.updated_at);
        return sum + Math.floor((taskUpdated.getTime() - taskCreated.getTime()) / 1000);
      }, 0);
      return total / taskList.length;
    };

    const personName = (job.params as any)?.person1?.name || (job.params as any)?.person?.name || 'Unknown';

    jobStats.push({
      jobId: job.id.substring(0, 8),
      type: job.type || 'unknown',
      personName,
      totalTime,
      textTasks: textTasks.length,
      pdfTasks: pdfTasks.length,
      audioTasks: audioTasks.length,
      songTasks: songTasks.length,
      avgTextTime: calcAvgTime(textTasks),
      avgPdfTime: calcAvgTime(pdfTasks),
      avgAudioTime: calcAvgTime(audioTasks),
      avgSongTime: calcAvgTime(songTasks),
    });
  }

  if (jobStats.length === 0) {
    console.log('⚠️  No jobs with complete tasks found');
    return;
  }

  // Calculate averages across all jobs
  const avgTotalTime = jobStats.reduce((sum, j) => sum + j.totalTime, 0) / jobStats.length;
  const avgTextTime = jobStats.filter(j => j.textTasks > 0).reduce((sum, j) => sum + j.avgTextTime, 0) / jobStats.filter(j => j.textTasks > 0).length || 0;
  const avgPdfTime = jobStats.filter(j => j.pdfTasks > 0).reduce((sum, j) => sum + j.avgPdfTime, 0) / jobStats.filter(j => j.pdfTasks > 0).length || 0;
  const avgAudioTime = jobStats.filter(j => j.audioTasks > 0).reduce((sum, j) => sum + j.avgAudioTime, 0) / jobStats.filter(j => j.audioTasks > 0).length || 0;
  const avgSongTime = jobStats.filter(j => j.songTasks > 0).reduce((sum, j) => sum + j.avgSongTime, 0) / jobStats.filter(j => j.songTasks > 0).length || 0;

  const totalTextTasks = jobStats.reduce((sum, j) => sum + j.textTasks, 0);
  const totalPdfTasks = jobStats.reduce((sum, j) => sum + j.pdfTasks, 0);
  const totalAudioTasks = jobStats.reduce((sum, j) => sum + j.audioTasks, 0);
  const totalSongTasks = jobStats.reduce((sum, j) => sum + j.songTasks, 0);

  console.log('═══════════════════════════════════════════════════════════');
  console.log('📊 AVERAGE JOB TIMING ANALYSIS');
  console.log('═══════════════════════════════════════════════════════════\n');

  console.log(`📦 Total Jobs Analyzed: ${jobStats.length}`);
  console.log(`\n⏱️  AVERAGE TIMES (per task):`);
  console.log(`   📝 Text Generation:    ${formatTime(avgTextTime)} (${totalTextTasks} tasks)`);
  console.log(`   📄 PDF Generation:     ${formatTime(avgPdfTime)} (${totalPdfTasks} tasks)`);
  console.log(`   🎙️  Audio Generation:   ${formatTime(avgAudioTime)} (${totalAudioTasks} tasks) ← RunPod TTS`);
  console.log(`   🎵 Song Generation:    ${formatTime(avgSongTime)} (${totalSongTasks} tasks)`);
  console.log(`\n⏱️  TOTAL JOB TIME (from start to complete):`);
  console.log(`   Average: ${formatTime(avgTotalTime)}`);
  console.log(`   Min:     ${formatTime(Math.min(...jobStats.map(j => j.totalTime)))}`);
  console.log(`   Max:     ${formatTime(Math.max(...jobStats.map(j => j.totalTime)))}`);

  // Show breakdown by job type
  const byType = new Map<string, number[]>();
  jobStats.forEach(j => {
    if (!byType.has(j.type)) byType.set(j.type, []);
    byType.get(j.type)!.push(j.totalTime);
  });

  if (byType.size > 1) {
    console.log(`\n📊 BY JOB TYPE:`);
    for (const [type, times] of byType.entries()) {
      const avg = times.reduce((sum, t) => sum + t, 0) / times.length;
      console.log(`   ${type}: ${formatTime(avg)} (${times.length} jobs)`);
    }
  }

  console.log('\n═══════════════════════════════════════════════════════════\n');

  // Show recent jobs summary
  console.log('📋 RECENT JOBS SUMMARY (last 10):');
  jobStats.slice(0, 10).forEach(j => {
    console.log(`   ${j.jobId}... ${j.personName.padEnd(20)} ${formatTime(j.totalTime)} (T:${j.textTasks} P:${j.pdfTasks} A:${j.audioTasks} S:${j.songTasks})`);
  });
}

function formatTime(seconds: number): string {
  if (seconds === 0) return '0s';
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  if (mins > 0) {
    return `${mins}m ${secs}s`;
  }
  return `${secs}s`;
}

analyzeAverageJobTiming().catch(err => {
  console.error('❌ Fatal error:', err);
  process.exit(1);
});
