/**
 * Check and fix song task creation for jobs
 * This script verifies if song tasks exist and creates them if missing
 */

import { createClient } from '@supabase/supabase-js';
import { env } from './src/config/env';

const supabaseUrl = env.SUPABASE_URL!;
const supabaseKey = env.SUPABASE_SERVICE_ROLE_KEY!;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkAndFixSongTasks(jobId: string) {
  console.log(`🔍 Checking job ${jobId}...`);

  // Get job details
  const { data: job, error: jobErr } = await supabase
    .from('jobs')
    .select('*, params')
    .eq('id', jobId)
    .single();

  if (jobErr || !job) {
    console.error('❌ Job not found:', jobErr?.message);
    return;
  }

  console.log(`✅ Job found: ${job.type} for ${(job.params as any)?.person1?.name || 'Unknown'}`);

  // Get all tasks
  const { data: tasks, error: tasksErr } = await supabase
    .from('job_tasks')
    .select('*')
    .eq('job_id', jobId)
    .order('sequence', { ascending: true });

  if (tasksErr) {
    console.error('❌ Error fetching tasks:', tasksErr.message);
    return;
  }

  console.log(`\n📋 Tasks (${tasks?.length || 0}):`);
  (tasks || []).forEach(t => {
    console.log(`  ${t.task_type} (seq ${t.sequence}): ${t.status}`);
  });

  // Check text tasks
  const textTasks = (tasks || []).filter(t => t.task_type === 'text_generation');
  const completeTextTasks = textTasks.filter(t => t.status === 'complete');
  const songTasks = (tasks || []).filter(t => t.task_type === 'song_generation');

  console.log(`\n📊 Summary:`);
  console.log(`  Text tasks: ${textTasks.length} (${completeTextTasks.length} complete)`);
  console.log(`  Song tasks: ${songTasks.length}`);

  // If all text tasks are complete but no song tasks exist, create them
  if (completeTextTasks.length === textTasks.length && textTasks.length > 0 && songTasks.length === 0) {
    console.log(`\n⚠️  All text tasks complete but no song tasks found. Creating song tasks...`);

    const person1Name = (job.params as any)?.person1?.name || 'User';

    for (const textTask of completeTextTasks) {
      const input = textTask.input as any;
      const docNum = input?.docNum || 1;
      const docType = input?.docType || 'individual';
      const system = input?.system || null;

      console.log(`  Creating song task for doc ${docNum} (${system || 'verdict'})...`);

      const { data: songTask, error: songErr } = await supabase
        .from('job_tasks')
        .insert({
          job_id: jobId,
          task_type: 'song_generation',
          status: 'pending',
          sequence: textTask.sequence + 300,
          input: {
            docNum,
            docType,
            system,
            sourceTaskId: textTask.id,
            personName: person1Name,
          },
          attempts: 0,
          max_attempts: 3,
          heartbeat_timeout_seconds: 1800, // 30 minutes
        })
        .select()
        .single();

      if (songErr) {
        console.error(`  ❌ Failed to create song task: ${songErr.message}`);
      } else {
        console.log(`  ✅ Created song task: ${songTask.id}`);
      }
    }
  } else if (songTasks.length > 0) {
    console.log(`\n✅ Song tasks already exist (${songTasks.length})`);
    songTasks.forEach(st => {
      console.log(`  Song task ${st.id}: ${st.status} (seq ${st.sequence})`);
    });
  } else {
    console.log(`\n⏳ Waiting for text tasks to complete...`);
  }
}

// Check Michael's job
const michaelJobId = '5949528b-c445-48f3-a877-709b91ad8e7e';
checkAndFixSongTasks(michaelJobId).catch(console.error);
