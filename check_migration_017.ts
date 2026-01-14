/**
 * Check if Migration 017 (Voice Selection Fix) is deployed
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(__dirname, '.env') });

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('❌ Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

async function checkMigration() {
  console.log('🔍 Checking if Migration 017 is deployed...\n');

  try {
    // Check: Look at recent audio tasks to see if they have voiceId/audioUrl
    console.log('📊 Checking recent audio tasks for voiceId/audioUrl...\n');
    const { data: tasks, error: tasksError } = await supabase
      .from('job_tasks')
      .select('id, job_id, input, created_at')
      .eq('task_type', 'audio_generation')
      .order('created_at', { ascending: false })
      .limit(10);

    if (tasksError) {
      console.error('❌ Error checking tasks:', tasksError.message);
      process.exit(1);
    }

    console.log(`   Found ${tasks?.length || 0} recent audio tasks\n`);

    if (!tasks || tasks.length === 0) {
      console.log('⚠️  No audio tasks found yet.');
      console.log('   Create a new job to test if migration is working.\n');
      return;
    }

    console.log('   Recent audio tasks:');
    let deployedCount = 0;
    let notDeployedCount = 0;

    tasks.forEach((task, i) => {
      const input = task.input as any;
      const voiceId = input?.voiceId;
      const audioUrl = input?.audioUrl;
      const hasVoiceConfig = voiceId || audioUrl;

      console.log(`   ${i + 1}. Task ${task.id.slice(0, 8)}... (created: ${new Date(task.created_at).toLocaleDateString()})`);
      console.log(`      voiceId: ${voiceId || '❌ MISSING'}`);
      console.log(`      audioUrl: ${audioUrl ? '✅ Present' : '❌ MISSING'}`);
      console.log(`      Status: ${hasVoiceConfig ? '✅ DEPLOYED' : '❌ NOT DEPLOYED'}`);
      console.log('');

      if (hasVoiceConfig) {
        deployedCount++;
      } else {
        notDeployedCount++;
      }
    });

    // Final verdict
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    if (deployedCount > 0) {
      console.log(`✅ MIGRATION 017 IS DEPLOYED!`);
      console.log(`   ${deployedCount} of ${tasks.length} recent tasks have voiceId/audioUrl.`);
      console.log('   Voice selection is working! 🎉');
    } else if (notDeployedCount > 0) {
      console.log(`❌ MIGRATION 017 NOT DEPLOYED`);
      console.log(`   ${notDeployedCount} recent tasks are missing voiceId/audioUrl.`);
      console.log('   Please apply the migration in Supabase Dashboard.');
    }
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  } catch (error: any) {
    console.error('❌ Error checking migration:', error.message);
    process.exit(1);
  }
}

checkMigration();
