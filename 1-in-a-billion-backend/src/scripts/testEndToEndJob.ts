/**
 * END-TO-END JOB TEST
 * 
 * Creates a real job and tests the complete pipeline:
 * 1. Create job via API
 * 2. Process job through queue
 * 3. Verify results
 */

import { createSupabaseServiceClient } from '../services/supabaseClient';
import { jobQueueV2 } from '../services/jobQueueV2';
import { env } from '../config/env';

async function createTestJob() {
  console.log('\n📝 Creating Test Job...');
  
  const supabase = createSupabaseServiceClient();
  if (!supabase) {
    throw new Error('Supabase client not initialized');
  }

  // Test person data
  const person1 = {
    name: 'Test Person',
    birthDate: '1990-01-01',
    birthTime: '12:00',
    timezone: 'UTC',
    latitude: 40.7128,
    longitude: -74.0060,
    userId: 'test-user-id',
  };

  const person2 = {
    name: 'Test Partner',
    birthDate: '1992-06-15',
    birthTime: '14:30',
    timezone: 'UTC',
    latitude: 34.0522,
    longitude: -118.2437,
    userId: 'test-user-id',
  };

  // Create a simple "extended" job (single person reading)
  const { data: job, error } = await supabase
    .from('jobs')
    .insert({
      type: 'extended',
      status: 'pending',
      params: {
        person1,
        relationshipIntensity: 5,
        systems: ['western'],
        style: 'production',
      },
      user_id: 'test-user-id',
    })
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to create job: ${error.message}`);
  }

  console.log(`  ✅ Job created: ${job.id}`);
  return job;
}

async function waitForJobCompletion(jobId: string, maxWaitSeconds = 120) {
  console.log(`\n⏳ Waiting for job ${jobId} to complete (max ${maxWaitSeconds}s)...`);
  
  const startTime = Date.now();
  const supabase = createSupabaseServiceClient();
  if (!supabase) {
    throw new Error('Supabase client not initialized');
  }

  while (Date.now() - startTime < maxWaitSeconds * 1000) {
    const { data: job, error } = await supabase
      .from('jobs')
      .select('status, progress, results')
      .eq('id', jobId)
      .single();

    if (error) {
      throw new Error(`Failed to fetch job: ${error.message}`);
    }

    if (job.status === 'completed') {
      console.log(`  ✅ Job completed!`);
      return job;
    }

    if (job.status === 'failed') {
      throw new Error(`Job failed: ${JSON.stringify(job.results)}`);
    }

    // Show progress
    if (job.progress) {
      const percent = job.progress.percent || 0;
      const phase = job.progress.phase || 'unknown';
      process.stdout.write(`\r  📊 Progress: ${percent}% (${phase})`);
    }

    await new Promise(resolve => setTimeout(resolve, 2000)); // Check every 2 seconds
  }

  throw new Error(`Job did not complete within ${maxWaitSeconds} seconds`);
}

async function verifyJobResults(job: any) {
  console.log('\n🔍 Verifying Job Results...');

  if (!job.results) {
    throw new Error('Job has no results');
  }

  if (job.results.fullText && job.results.fullText.length > 0) {
    console.log(`  ✅ Full text generated: ${job.results.fullText.length} characters`);
  } else {
    throw new Error('Job has no fullText');
  }

  if (job.results.chapters && job.results.chapters.length > 0) {
    console.log(`  ✅ Chapters generated: ${job.results.chapters.length}`);
    job.results.chapters.forEach((chapter: any, i: number) => {
      console.log(`     - Chapter ${i + 1}: ${chapter.name || 'Untitled'} (${chapter.text?.length || 0} chars)`);
    });
  } else {
    console.log('  ⚠️  No chapters found (may be normal for extended jobs)');
  }

  return true;
}

async function cleanupTestJob(jobId: string) {
  console.log(`\n🧹 Cleaning up test job ${jobId}...`);
  
  const supabase = createSupabaseServiceClient();
  if (!supabase) {
    return;
  }

  // Delete job and related artifacts
  await supabase.from('jobs').delete().eq('id', jobId);
  console.log('  ✅ Test job cleaned up');
}

async function runEndToEndTest() {
  console.log('🧪 End-to-End Job Test');
  console.log('═══════════════════════════════════════════');
  console.log('⚠️  This test creates a real job and processes it.');
  console.log('⚠️  Make sure the backend server is running!');
  console.log('');

  let jobId: string | null = null;

  try {
    // Create test job
    const job = await createTestJob();
    jobId = job.id;

    // Wait for completion (this requires the backend worker to be running)
    const completedJob = await waitForJobCompletion(job.id, 180);

    // Verify results
    await verifyJobResults(completedJob);

    console.log('\n✅ End-to-End Test PASSED!');
    console.log('   The complete pipeline is working correctly.');
    
    // Cleanup
    await cleanupTestJob(job.id);

  } catch (err: any) {
    console.error(`\n❌ End-to-End Test FAILED: ${err.message}`);
    
    if (jobId) {
      console.log(`\n💡 Note: Test job ${jobId} may still be in the queue.`);
      console.log('   You may need to clean it up manually or wait for it to complete.');
    }
    
    process.exit(1);
  }
}

// Check if backend is running
async function checkBackendRunning() {
  try {
    const axios = (await import('axios')).default;
    const port = env.PORT || 3000;
    const response = await axios.get(`http://localhost:${port}/health`, {
      timeout: 5000,
    });
    return response.status === 200;
  } catch {
    return false;
  }
}

async function main() {
  const backendRunning = await checkBackendRunning();
  
  if (!backendRunning) {
    console.log('⚠️  Backend server is not running!');
    console.log('   Please start it with: npm run dev');
    console.log('   Then run this test again.');
    process.exit(1);
  }

  await runEndToEndTest();
}

main().catch(err => {
  console.error('❌ Test failed:', err);
  process.exit(1);
});

