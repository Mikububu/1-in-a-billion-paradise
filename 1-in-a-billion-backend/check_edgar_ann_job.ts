import { createSupabaseServiceClient } from './src/services/supabaseClient';

async function checkJobs() {
  const supabase = createSupabaseServiceClient();
  if (!supabase) {
    console.error('No Supabase client');
    return;
  }

  // Find recent jobs (including non-Edgar/Ann to see what's happening)
  const { data: allJobs, error } = await supabase
    .from('jobs')
    .select('id, status, type, created_at, params, progress')
    .order('created_at', { ascending: false })
    .limit(5);
  
  console.log(`\n=== ALL RECENT JOBS (${allJobs?.length || 0}) ===\n`);
  for (const job of allJobs || []) {
    const params = job.params as any;
    const p1Name = params?.person1?.name || params?.person?.name || 'Unknown';
    const p2Name = params?.person2?.name || '';
    console.log(`${job.id.substring(0, 8)}... | ${job.status} | ${job.type} | ${p1Name}${p2Name ? ' & ' + p2Name : ''}`);
  }
  
  const jobs = allJobs;

  if (error) {
    console.error('Error:', error);
    return;
  }

  // Filter for Edgar/Ann jobs
  const edgarAnnJobs = jobs?.filter(job => {
    const params = job.params as any;
    const p1Name = params?.person1?.name || params?.person?.name || '';
    const p2Name = params?.person2?.name || '';
    return p1Name.includes('Edgar') || p1Name.includes('Ann') || 
           p2Name.includes('Edgar') || p2Name.includes('Ann');
  }) || [];

  console.log(`Found ${edgarAnnJobs.length} Edgar/Ann jobs:\n`);
  
  for (const job of edgarAnnJobs) {
    console.log(`Job ${job.id}:`);
    console.log(`  Status: ${job.status}`);
    console.log(`  Type: ${job.type}`);
    console.log(`  Created: ${job.created_at}`);
    console.log(`  Progress: ${JSON.stringify(job.progress, null, 2)}`);
    
    // Check tasks - get one PDF and one audio task to inspect
    const { data: tasks, error: tasksError } = await supabase
      .from('job_tasks')
      .select('*')
      .eq('job_id', job.id)
      .in('task_type', ['pdf_generation', 'audio_generation'])
      .order('created_at', { ascending: false })
      .limit(5);
    
    if (tasksError) {
      console.log(`  Tasks query error: ${tasksError.message}`);
    }
    
    console.log(`  Tasks (${tasks?.length || 0}):`);
    for (const task of tasks || []) {
      console.log(`\n    Task ${task.id.substring(0, 8)}...`);
      console.log(`      Type: ${task.task_type}`);
      console.log(`      Status: ${task.status}`);
      console.log(`      Result: ${JSON.stringify(task.result || {}, null, 2).substring(0, 200)}`);
      if (task.error) {
        console.log(`      Error: ${task.error}`);
      }
    }
    
    // Check artifacts in database
    const { data: artifacts } = await supabase
      .from('job_artifacts')
      .select('type, storage_path, created_at')
      .eq('job_id', job.id);
    
    console.log(`  Artifacts in DB (${artifacts?.length || 0}):`);
    for (const artifact of artifacts || []) {
      console.log(`    - ${artifact.type}: ${artifact.storage_path ? '✅' : '❌'}`);
    }
    
    // Check storage directly
    const { data: storageFiles } = await supabase.storage
      .from('job-artifacts')
      .list(`${job.id}`, { limit: 100 });
    
    console.log(`  Files in Storage (${storageFiles?.length || 0}):`);
    if (storageFiles && storageFiles.length > 0) {
      const byType: Record<string, number> = {};
      for (const file of storageFiles) {
        const type = file.name.split('/')[0] || 'unknown';
        byType[type] = (byType[type] || 0) + 1;
      }
      for (const [type, count] of Object.entries(byType)) {
        console.log(`    - ${type}: ${count} files`);
      }
    }
    
    console.log('');
  }
}

checkJobs().catch(console.error);
