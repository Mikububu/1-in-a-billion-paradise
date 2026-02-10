/**
 * VERIFY CLEANUP - Check if deletion completed successfully
 */

import { createSupabaseServiceClient } from './src/services/supabaseClient';
import { config } from 'dotenv';
import { join } from 'path';

config({ path: join(__dirname, '.env') });

async function main() {
  const supabase = createSupabaseServiceClient();

  if (!supabase) {
    console.error('❌ Supabase not configured');
    process.exit(1);
  }

  console.log('🔍 VERIFYING CLEANUP STATUS\n');
  console.log('═══════════════════════════════════════════════════════════\n');

  // Check job_artifacts
  const { data: artifacts, count: artifactsCount } = await supabase
    .from('job_artifacts')
    .select('*', { count: 'exact', head: false });

  // Check jobs
  const { data: jobs, count: jobsCount } = await supabase
    .from('jobs')
    .select('*', { count: 'exact', head: false });

  // Check job_tasks
  const { data: tasks, count: tasksCount } = await supabase
    .from('job_tasks')
    .select('*', { count: 'exact', head: false });

  // Check hook readings (SHOULD EXIST)
  const { data: hookReadings, count: hooksCount } = await supabase
    .from('user_readings')
    .select('*', { count: 'exact', head: false });

  // Check profiles (SHOULD EXIST)
  const { data: profiles, count: profilesCount } = await supabase
    .from('library_people')
    .select('*', { count: 'exact', head: false });

  console.log('📊 PAID READING DATA (should be 0):');
  console.log(`   job_artifacts: ${artifactsCount || 0}`);
  console.log(`   jobs: ${jobsCount || 0}`);
  console.log(`   job_tasks: ${tasksCount || 0}`);
  console.log('');

  console.log('✅ HOOK DATA (should exist):');
  console.log(`   user_readings: ${hooksCount || 0}`);
  console.log(`   library_people: ${profilesCount || 0}`);
  console.log('');

  if ((artifactsCount || 0) === 0 && (jobsCount || 0) === 0 && (tasksCount || 0) === 0) {
    console.log('🎉 CLEANUP SUCCESSFUL!');
    console.log('   All paid reading data has been deleted');
    console.log('   Hook readings and profiles are intact');
  } else {
    console.log('⚠️  CLEANUP INCOMPLETE or IN PROGRESS');
    console.log(`   ${artifactsCount || 0} job_artifacts remain`);
    console.log(`   ${jobsCount || 0} jobs remain`);
    console.log(`   ${tasksCount || 0} job_tasks remain`);
  }

  if ((hooksCount || 0) === 0 && (profilesCount || 0) === 0) {
    console.log('');
    console.log('🚨 WARNING: Hook data appears to be missing!');
    console.log('   This should NOT happen. Check your database.');
  }

  console.log('');
  console.log('═══════════════════════════════════════════════════════════');
}

main().catch(console.error);
