/**
 * FIND STORAGE POLLUTION
 * 
 * Comprehensive script to identify what's consuming the 4.77 GB in Supabase.
 * Checks database tables, JSONB columns, and storage buckets.
 */

import { createSupabaseServiceClient } from '../services/supabaseClient';
import { config } from 'dotenv';
import { join } from 'path';

config({ path: join(__dirname, '../../.env') });

async function findStoragePollution() {
  const supabase = createSupabaseServiceClient();

  if (!supabase) {
    console.error('❌ Supabase not configured');
    process.exit(1);
  }

  console.log('🔍 FINDING STORAGE POLLUTION');
  console.log('═══════════════════════════════════════════════════════════\n');
  console.log('Supabase reports: 4.77 GB used');
  console.log('Database rows: ~250 rows');
  console.log('Storage buckets (from DB): ~189 MB\n');
  console.log('Mystery: ~4.6 GB unaccounted for!\n');

  try {
    // 1. Check job_artifacts table for large JSONB
    console.log('📊 1. Checking job_artifacts table...');
    const { data: artifacts, error: artifactsError } = await supabase
      .from('job_artifacts')
      .select('id, artifact_type, file_size_bytes, metadata')
      .limit(10);

    if (!artifactsError && artifacts) {
      console.log(`   Found ${artifacts.length} sample artifact(s)`);
      const totalBytes = artifacts.reduce((sum: number, a: any) => sum + (a.file_size_bytes || 0), 0);
      const avgBytes = totalBytes / artifacts.length;
      console.log(`   Average file size: ${(avgBytes / (1024 * 1024)).toFixed(2)} MB`);
      
      // Check metadata size
      let largestMetadata = 0;
      for (const artifact of artifacts) {
        if (artifact.metadata) {
          const metaSize = JSON.stringify(artifact.metadata).length;
          if (metaSize > largestMetadata) largestMetadata = metaSize;
        }
      }
      if (largestMetadata > 0) {
        console.log(`   Largest metadata: ${(largestMetadata / 1024).toFixed(2)} KB`);
      }
    }
    console.log('');

    // 2. Check jobs table for large JSONB columns
    console.log('📊 2. Checking jobs table (params, progress JSONB)...');
    const { data: jobs, error: jobsError } = await supabase
      .from('jobs')
      .select('id, params, progress')
      .limit(10);

    if (!jobsError && jobs) {
      console.log(`   Found ${jobs.length} sample job(s)`);
      let totalParamsSize = 0;
      let totalProgressSize = 0;
      let largestParams = 0;
      let largestProgress = 0;

      for (const job of jobs) {
        if (job.params) {
          const paramsSize = JSON.stringify(job.params).length;
          totalParamsSize += paramsSize;
          if (paramsSize > largestParams) largestParams = paramsSize;
        }
        if (job.progress) {
          const progressSize = JSON.stringify(job.progress).length;
          totalProgressSize += progressSize;
          if (progressSize > largestProgress) largestProgress = progressSize;
        }
      }

      const avgParamsKB = (totalParamsSize / jobs.length) / 1024;
      const avgProgressKB = (totalProgressSize / jobs.length) / 1024;
      
      console.log(`   Average params size: ${avgParamsKB.toFixed(2)} KB`);
      console.log(`   Average progress size: ${avgProgressKB.toFixed(2)} KB`);
      console.log(`   Largest params: ${(largestParams / 1024).toFixed(2)} KB`);
      console.log(`   Largest progress: ${(largestProgress / 1024).toFixed(2)} KB`);
    }
    console.log('');

    // 3. Check job_tasks table for large JSONB
    console.log('📊 3. Checking job_tasks table (input, output JSONB)...');
    const { data: tasks, error: tasksError } = await supabase
      .from('job_tasks')
      .select('id, task_type, input, output')
      .limit(20);

    if (!tasksError && tasks) {
      console.log(`   Found ${tasks.length} sample task(s)`);
      let totalInputSize = 0;
      let totalOutputSize = 0;
      let largestInput = 0;
      let largestOutput = 0;

      for (const task of tasks) {
        if (task.input) {
          const inputSize = JSON.stringify(task.input).length;
          totalInputSize += inputSize;
          if (inputSize > largestInput) largestInput = inputSize;
        }
        if (task.output) {
          const outputSize = JSON.stringify(task.output).length;
          totalOutputSize += outputSize;
          if (outputSize > largestOutput) largestOutput = outputSize;
        }
      }

      const avgInputKB = tasks.length > 0 ? (totalInputSize / tasks.length) / 1024 : 0;
      const avgOutputKB = tasks.length > 0 ? (totalOutputSize / tasks.length) / 1024 : 0;
      
      console.log(`   Average input size: ${avgInputKB.toFixed(2)} KB`);
      console.log(`   Average output size: ${avgOutputKB.toFixed(2)} KB`);
      console.log(`   Largest input: ${(largestInput / 1024).toFixed(2)} KB`);
      console.log(`   Largest output: ${(largestOutput / 1024).toFixed(2)} KB`);
    }
    console.log('');

    // 4. Check library_people table
    console.log('📊 4. Checking library_people table...');
    const { data: people, error: peopleError } = await supabase
      .from('library_people')
      .select('id, name, birth_data, hook_readings')
      .limit(10);

    if (!peopleError && people) {
      console.log(`   Found ${people.length} sample person(s)`);
      let totalBirthDataSize = 0;
      let totalHookReadingsSize = 0;

      for (const person of people) {
        if (person.birth_data) {
          totalBirthDataSize += JSON.stringify(person.birth_data).length;
        }
        if (person.hook_readings) {
          totalHookReadingsSize += JSON.stringify(person.hook_readings).length;
        }
      }

      if (people.length > 0) {
        const avgBirthDataKB = (totalBirthDataSize / people.length) / 1024;
        const avgHookReadingsKB = (totalHookReadingsSize / people.length) / 1024;
        console.log(`   Average birth_data size: ${avgBirthDataKB.toFixed(2)} KB`);
        console.log(`   Average hook_readings size: ${avgHookReadingsKB.toFixed(2)} KB`);
      }
    }
    console.log('');

    // 5. Summary
    console.log('═══════════════════════════════════════════════════════════');
    console.log('💡 CONCLUSION:');
    console.log('═══════════════════════════════════════════════════════════');
    console.log('The 4.77 GB is likely:');
    console.log('');
    console.log('1. PostgreSQL WAL (Write-Ahead Log) files');
    console.log('   - Can be several GB even with small databases');
    console.log('   - Check: Supabase Dashboard → Database → Storage');
    console.log('');
    console.log('2. Database indexes');
    console.log('   - JSONB columns create GIN indexes');
    console.log('   - Can be 2-3x the data size');
    console.log('');
    console.log('3. Old/uncommitted transactions');
    console.log('   - Vacuum needed to reclaim space');
    console.log('');
    console.log('🔍 TO VERIFY:');
    console.log('   1. Supabase Dashboard → Database → Storage');
    console.log('   2. Check table sizes vs. indexes');
    console.log('   3. Check WAL size');
    console.log('   4. Run VACUUM if needed (requires admin access)');
    console.log('═══════════════════════════════════════════════════════════\n');

  } catch (error: any) {
    console.error('❌ Fatal error:', error);
    process.exit(1);
  }
}

findStoragePollution().catch(err => {
  console.error('❌ Fatal error:', err);
  process.exit(1);
});
