import { createSupabaseServiceClient } from './src/services/supabaseClient';

const supabase = createSupabaseServiceClient();

if (!supabase) {
  console.error('❌ Supabase not configured');
  process.exit(1);
}

async function analyzePipelineTiming() {
  console.log('🔍 Analyzing pipeline timing for Michael\'s Vedic job...\n');

  // Find Michael's Vedic jobs
  const { data: allJobs, error: jobError } = await supabase
    .from('jobs')
    .select('id, status, created_at, updated_at, params, progress')
    .order('created_at', { ascending: false })
    .limit(20);

  if (jobError) {
    console.error('❌ Error fetching jobs:', jobError.message);
    return;
  }

  // Filter for Michael's Vedic jobs
  const jobs = (allJobs || []).filter((job: any) => {
    const personName = job.params?.person1?.name || '';
    const systems = job.params?.systems || [];
    return personName.toLowerCase().includes('michael') && systems.includes('vedic');
  }).slice(0, 5);

  if (!jobs || jobs.length === 0) {
    console.log('⚠️  No Vedic jobs found for Michael');
    return;
  }

  console.log(`Found ${jobs.length} Vedic job(s) for Michael:\n`);

  for (const job of jobs) {
    const created = new Date(job.created_at);
    const updated = new Date(job.updated_at);
    const totalTime = Math.floor((updated.getTime() - created.getTime()) / 1000);

    console.log(`📦 Job: ${job.id.substring(0, 8)}...`);
    console.log(`   Status: ${job.status}`);
    console.log(`   Created: ${created.toLocaleString()}`);
    console.log(`   Updated: ${updated.toLocaleString()}`);
    console.log(`   Total time: ${Math.floor(totalTime / 60)}m ${totalTime % 60}s`);

    // Get tasks with timing
    const { data: tasks } = await supabase
      .from('job_tasks')
      .select('task_type, status, created_at, updated_at, sequence, error')
      .eq('job_id', job.id)
      .order('sequence', { ascending: true });

    if (tasks && tasks.length > 0) {
      console.log(`\n   Tasks (${tasks.length}) - Sequential Timeline:`);
      
      const jobStartTime = created.getTime();
      const taskTimings: Array<{ 
        type: string; 
        duration: number; 
        status: string;
        startOffset: number;
        endOffset: number;
        sequence: number;
      }> = [];
      
      for (const task of tasks) {
        const taskCreated = new Date(task.created_at);
        const taskUpdated = new Date(task.updated_at);
        const taskDuration = Math.floor((taskUpdated.getTime() - taskCreated.getTime()) / 1000);
        const startOffset = Math.floor((taskCreated.getTime() - jobStartTime) / 1000);
        const endOffset = Math.floor((taskUpdated.getTime() - jobStartTime) / 1000);
        
        const statusIcon = task.status === 'complete' ? '✅' : task.status === 'processing' ? '⏳' : task.status === 'failed' ? '❌' : '⏸️';
        console.log(`     ${statusIcon} [${task.sequence}] ${task.task_type}: ${task.status}`);
        console.log(`        Starts: +${Math.floor(startOffset / 60)}m ${startOffset % 60}s | Duration: ${Math.floor(taskDuration / 60)}m ${taskDuration % 60}s | Ends: +${Math.floor(endOffset / 60)}m ${endOffset % 60}s`);
        
        if (task.status === 'complete') {
          taskTimings.push({
            type: task.task_type,
            duration: taskDuration,
            status: task.status,
            startOffset,
            endOffset,
            sequence: task.sequence,
          });
        }
      }

      // Calculate pipeline phases with proper sequencing
      console.log(`\n   Pipeline Analysis (Sequential):`);
      const textTasks = taskTimings.filter(t => t.type === 'text_generation').sort((a, b) => a.sequence - b.sequence);
      const pdfTasks = taskTimings.filter(t => t.type === 'pdf_generation').sort((a, b) => a.sequence - b.sequence);
      const audioTasks = taskTimings.filter(t => t.type === 'audio_generation' || t.type === 'audio_mp3' || t.type === 'audio_m4a').sort((a, b) => a.sequence - b.sequence);
      const songTasks = taskTimings.filter(t => t.type === 'song_generation').sort((a, b) => a.sequence - b.sequence);

      if (textTasks.length > 0) {
        const avgText = textTasks.reduce((sum, t) => sum + t.duration, 0) / textTasks.length;
        const firstTextEnd = textTasks[0]?.endOffset || 0;
        console.log(`     📝 Text Generation: ${textTasks.length} task(s), avg ${Math.floor(avgText / 60)}m ${Math.floor(avgText % 60)}s`);
        console.log(`        First text completes at: +${Math.floor(firstTextEnd / 60)}m ${firstTextEnd % 60}s`);
      }
      if (pdfTasks.length > 0) {
        const avgPdf = pdfTasks.reduce((sum, t) => sum + t.duration, 0) / pdfTasks.length;
        const firstPdfStart = pdfTasks[0]?.startOffset || 0;
        const firstPdfEnd = pdfTasks[0]?.endOffset || 0;
        console.log(`     📄 PDF Generation: ${pdfTasks.length} task(s), avg ${Math.floor(avgPdf / 60)}m ${Math.floor(avgPdf % 60)}s`);
        console.log(`        First PDF starts at: +${Math.floor(firstPdfStart / 60)}m ${firstPdfStart % 60}s (${firstPdfStart > 0 ? `${Math.floor((firstPdfStart - (textTasks[0]?.endOffset || 0)) / 60)}m ${(firstPdfStart - (textTasks[0]?.endOffset || 0)) % 60}s after text` : 'immediately'})`);
        console.log(`        First PDF completes at: +${Math.floor(firstPdfEnd / 60)}m ${firstPdfEnd % 60}s`);
      }
      if (audioTasks.length > 0) {
        const avgAudio = audioTasks.reduce((sum, t) => sum + t.duration, 0) / audioTasks.length;
        const firstAudioStart = audioTasks[0]?.startOffset || 0;
        console.log(`     🎙️ Audio Generation: ${audioTasks.length} task(s), avg ${Math.floor(avgAudio / 60)}m ${Math.floor(avgAudio % 60)}s`);
        console.log(`        First audio starts at: +${Math.floor(firstAudioStart / 60)}m ${firstAudioStart % 60}s`);
      }
      if (songTasks.length > 0) {
        const avgSong = songTasks.reduce((sum, t) => sum + t.duration, 0) / songTasks.length;
        const firstSongStart = songTasks[0]?.startOffset || 0;
        const firstSongEnd = songTasks[0]?.endOffset || 0;
        console.log(`     🎵 Song Generation: ${songTasks.length} task(s), avg ${Math.floor(avgSong / 60)}m ${Math.floor(avgSong % 60)}s`);
        console.log(`        First song starts at: +${Math.floor(firstSongStart / 60)}m ${firstSongStart % 60}s`);
        console.log(`        First song completes at: +${Math.floor(firstSongEnd / 60)}m ${firstSongEnd % 60}s`);
        if (firstSongEnd < 120) {
          console.log(`        ⚠️  WARNING: Song completed in <2 minutes but avg is ${Math.floor(avgSong / 60)}m - possible mismatch!`);
        }
      }
    }

    console.log('\n' + '─'.repeat(60) + '\n');
  }
}

analyzePipelineTiming().catch(err => {
  console.error('❌ Fatal error:', err);
  process.exit(1);
});
