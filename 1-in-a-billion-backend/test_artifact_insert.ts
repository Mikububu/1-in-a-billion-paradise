import { createSupabaseServiceClient } from './src/services/supabaseClient';

async function testArtifactInsert() {
  const supabase = createSupabaseServiceClient();
  if (!supabase) {
    console.error('No Supabase client');
    return;
  }

  // Use the Edgar/Ann job ID we found earlier
  const jobId = '0f242dc8-ee70-4144-a569-405156042264';
  
  // Check job user_id
  const { data: job } = await supabase
    .from('jobs')
    .select('id, user_id, type, status')
    .eq('id', jobId)
    .single();
  
  console.log(`Job user_id: ${job?.user_id || 'NULL'}`);
  
  const { data: tasks, error: tasksError } = await supabase
    .from('job_tasks')
    .select('id, job_id, task_type, status, output')
    .eq('job_id', jobId)
    .order('created_at', { ascending: false });
  
  if (tasksError) {
    console.error('Error fetching tasks:', tasksError);
    return;
  }
  
  console.log(`Found ${tasks?.length || 0} tasks for job ${jobId.substring(0, 8)}...:`);
  const byType: Record<string, number> = {};
  for (const t of tasks || []) {
    const key = `${t.task_type}:${t.status}`;
    byType[key] = (byType[key] || 0) + 1;
  }
  for (const [key, count] of Object.entries(byType)) {
    console.log(`  ${key}: ${count}`);
  }
  
  const task = tasks?.find(t => (t.task_type === 'pdf_generation' || t.task_type.includes('pdf')) && t.status === 'complete') || tasks?.find(t => t.status === 'complete');

  if (!task) {
    console.log('No completed PDF task found');
    return;
  }

  console.log(`Testing artifact insert for task ${task.id}`);
  console.log(`Task output: ${JSON.stringify(task.output, null, 2)}`);

  // Try to insert a test artifact
  const testArtifact = {
    job_id: task.job_id,
    task_id: task.id,
    artifact_type: 'pdf' as const,
    storage_path: `test/${task.job_id}/pdf/test.pdf`,
    bucket_name: 'job-artifacts',
    content_type: 'application/pdf',
    file_size_bytes: 1000,
    metadata: { test: true },
  };

  const { data, error } = await supabase
    .from('job_artifacts')
    .insert(testArtifact)
    .select()
    .single();

  if (error) {
    if (error.code === '23505') {
      console.log('✅ Artifact already exists (this is good!)');
      
      // Check if it actually exists
      const { data: existing } = await supabase
        .from('job_artifacts')
        .select('*')
        .eq('job_id', task.job_id)
        .eq('task_id', task.id)
        .eq('artifact_type', 'pdf')
        .single();
      
      if (existing) {
        console.log('✅ Found existing artifact:', {
          id: existing.id,
          storage_path: existing.storage_path,
          created_at: existing.created_at,
        });
      } else {
        console.log('❌ Artifact not found in DB (constraint exists but row missing?)');
      }
    } else {
      console.error('❌ Artifact insert failed:', error);
    }
  } else {
    console.log('✅ Artifact insert succeeded:', data);
    
    // Clean up
    await supabase.from('job_artifacts').delete().eq('id', data.id);
    console.log('🧹 Test artifact cleaned up');
  }
  
  // Check ALL artifacts for this job
  const { data: allArtifacts } = await supabase
    .from('job_artifacts')
    .select('*')
    .eq('job_id', jobId);
  
  console.log(`\n📦 Total artifacts for job: ${allArtifacts?.length || 0}`);
  const artifactByType: Record<string, number> = {};
  for (const a of allArtifacts || []) {
    artifactByType[a.artifact_type] = (artifactByType[a.artifact_type] || 0) + 1;
  }
  for (const [type, count] of Object.entries(artifactByType)) {
    console.log(`  ${type}: ${count}`);
  }
  
  // Check PDF artifact metadata
  const pdfArtifacts = allArtifacts?.filter(a => a.artifact_type === 'pdf').slice(0, 3) || [];
  console.log(`\n📄 Sample PDF artifacts (first 3):`);
  for (const a of pdfArtifacts) {
    console.log(`  - ${a.storage_path}`);
    console.log(`    Metadata: ${JSON.stringify(a.metadata, null, 2).substring(0, 200)}`);
  }
  
  // Check audio artifact metadata  
  const audioArtifacts = allArtifacts?.filter(a => a.artifact_type === 'audio_mp3').slice(0, 3) || [];
  console.log(`\n🎵 Sample audio artifacts (first 3):`);
  for (const a of audioArtifacts) {
    console.log(`  - ${a.storage_path}`);
    console.log(`    Metadata: ${JSON.stringify(a.metadata, null, 2).substring(0, 200)}`);
  }
  
  // Check for docNum 6 specifically (what the frontend is looking for)
  const doc6Artifacts = allArtifacts?.filter(a => a.metadata?.docNum === 6) || [];
  console.log(`\n🔍 Artifacts with docNum 6: ${doc6Artifacts.length}`);
  for (const a of doc6Artifacts) {
    console.log(`  - ${a.artifact_type}: ${a.storage_path}`);
    console.log(`    Metadata: ${JSON.stringify(a.metadata, null, 2)}`);
  }
  
  // Check all docNums
  const docNums = new Set<number>();
  for (const a of allArtifacts || []) {
    if (a.metadata?.docNum !== undefined) {
      docNums.add(Number(a.metadata.docNum));
    }
  }
  console.log(`\n📊 All docNums in artifacts: ${Array.from(docNums).sort((a, b) => a - b).join(', ')}`);
}

testArtifactInsert().catch(console.error);
