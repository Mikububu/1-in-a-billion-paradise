/**
 * CHECK MISSING AUDIO
 * 
 * Finds recent jobs and checks which audio tasks are missing
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

  console.log('🔍 CHECKING MISSING AUDIO FOR RECENT JOBS\n');

  // Get user ID from auth schema
  const { data: authUsers, error: userError } = await supabase.auth.admin.listUsers();

  if (userError || !authUsers) {
    console.error('❌ Failed to list users:', userError);
    process.exit(1);
  }

  const user = authUsers.users.find((u: any) => u.email === 'michael@forbidden-yoga.com');
  if (!user) {
    console.error('❌ User not found');
    process.exit(1);
  }

  const userId = user.id;

  // Get recent 5 jobs
  const { data: jobs, error: jobsError } = await supabase
    .from('jobs')
    .select('id, type, params, created_at')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(5);

  if (jobsError || !jobs) {
    console.error('❌ Failed to fetch jobs');
    process.exit(1);
  }

  for (const job of jobs) {
    const p1Name = job.params?.person1?.name || 'Unknown';
    const p2Name = job.params?.person2?.name;
    const jobName = p2Name ? `${p1Name} + ${p2Name}` : p1Name;

    console.log(`\n📋 Job: ${jobName} (${job.type})`);
    console.log(`   ID: ${job.id}`);
    console.log(`   Created: ${new Date(job.created_at).toLocaleString()}`);

    // Get tasks for this job
    const { data: tasks, error: tasksError } = await supabase
      .from('job_tasks')
      .select('id, task_type, status, input, result_data, error_message')
      .eq('job_id', job.id)
      .order('sequence', { ascending: true });

    if (tasksError || !tasks) {
      console.log('   ❌ Failed to fetch tasks');
      continue;
    }

    const textTasks = tasks.filter((t: any) => t.task_type === 'text_generation');
    const audioTasks = tasks.filter((t: any) => t.task_type === 'audio_generation');
    const pdfTasks = tasks.filter((t: any) => t.task_type === 'pdf_generation');

    console.log(`\n   📝 Text tasks: ${textTasks.length} total`);
    console.log(`      ✅ Complete: ${textTasks.filter((t: any) => t.status === 'complete').length}`);
    console.log(`      ❌ Failed: ${textTasks.filter((t: any) => t.status === 'failed').length}`);
    console.log(`      ⏳ Pending: ${textTasks.filter((t: any) => t.status === 'pending').length}`);

    console.log(`\n   🎵 Audio tasks: ${audioTasks.length} total`);
    console.log(`      ✅ Complete: ${audioTasks.filter((t: any) => t.status === 'complete').length}`);
    console.log(`      ❌ Failed: ${audioTasks.filter((t: any) => t.status === 'failed').length}`);
    console.log(`      ⏳ Pending: ${audioTasks.filter((t: any) => t.status === 'pending').length}`);

    console.log(`\n   📄 PDF tasks: ${pdfTasks.length} total`);
    console.log(`      ✅ Complete: ${pdfTasks.filter((t: any) => t.status === 'complete').length}`);
    console.log(`      ❌ Failed: ${pdfTasks.filter((t: any) => t.status === 'failed').length}`);
    console.log(`      ⏳ Pending: ${pdfTasks.filter((t: any) => t.status === 'pending').length}`);

    // Show failed/pending audio tasks details
    const problemAudio = audioTasks.filter((t: any) => t.status !== 'complete');
    if (problemAudio.length > 0) {
      console.log(`\n   🔍 Audio tasks NOT complete:`);
      for (const task of problemAudio) {
        const docType = task.input?.docType || 'unknown';
        const system = task.input?.system || 'unknown';
        console.log(`      - Task ${task.id.substring(0, 8)}: ${docType} / ${system} → ${task.status}`);
        if (task.error_message) {
          console.log(`        Error: ${task.error_message}`);
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
