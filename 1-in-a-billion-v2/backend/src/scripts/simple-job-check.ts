/**
 * SIMPLE JOB CHECK - No auth.admin, just direct query
 */

import { createSupabaseServiceClient } from '../services/supabaseClient';
import { config } from 'dotenv';
import { join } from 'path';

config({ path: join(__dirname, '../../.env') });

async function main() {
  const supabase = createSupabaseServiceClient();
  if (!supabase) {
    console.error('❌ Supabase not configured');
    process.exit(1);
  }

  console.log('🔍 CHECKING RECENT JOBS\n');

  // Get recent 3 jobs directly
  const { data: jobs, error: jobsError } = await supabase
    .from('jobs')
    .select('id, type, params, created_at')
    .order('created_at', { ascending: false })
    .limit(3);

  if (jobsError) {
    console.error('❌ Failed to fetch jobs:', jobsError);
    process.exit(1);
  }

  if (!jobs || jobs.length === 0) {
    console.log('No jobs found');
    process.exit(0);
  }

  for (const job of jobs) {
    const p1Name = job.params?.person1?.name || 'Unknown';
    const p2Name = job.params?.person2?.name;
    const jobName = p2Name ? `${p1Name} + ${p2Name}` : p1Name;

    console.log(`\n📋 ${jobName} (${job.type})`);
    console.log(`   ID: ${job.id}`);
    console.log(`   Created: ${new Date(job.created_at).toLocaleString()}`);

    // Get tasks
    const { data: tasks } = await supabase
      .from('job_tasks')
      .select('id, task_type, status, input, error_message')
      .eq('job_id', job.id)
      .order('sequence', { ascending: true });

    if (!tasks) continue;

    const textTasks = tasks.filter((t: any) => t.task_type === 'text_generation');
    const audioTasks = tasks.filter((t: any) => t.task_type === 'audio_generation');

    console.log(`   📝 Text: ${textTasks.filter((t: any) => t.status === 'complete').length}/${textTasks.length} complete`);
    console.log(`   🎵 Audio: ${audioTasks.filter((t: any) => t.status === 'complete').length}/${audioTasks.length} complete`);

    // Show problem audio
    const problemAudio = audioTasks.filter((t: any) => t.status !== 'complete');
    if (problemAudio.length > 0) {
      console.log(`\n   ⚠️  Missing audio:`);
      for (const task of problemAudio) {
        const docType = task.input?.docType || '?';
        const system = task.input?.system || '?';
        console.log(`      - ${docType} / ${system} → ${task.status}`);
        if (task.error_message) {
          console.log(`        ${task.error_message.substring(0, 100)}`);
        }
      }
    }
  }

  console.log('\n✅ Done\n');
}

main().catch(err => {
  console.error('❌ Script failed:', err);
  process.exit(1);
});
