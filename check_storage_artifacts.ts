import { createSupabaseServiceClient } from './src/services/supabaseClient';
import { config } from 'dotenv';
import { join } from 'path';

config({ path: join(__dirname, '.env') });

const supabase = createSupabaseServiceClient();

if (!supabase) {
  console.error('❌ Supabase not configured');
  process.exit(1);
}

async function checkStorageArtifacts() {
  console.log('🔍 Checking Supabase Storage artifacts for failed audio tasks...\n');

  // Get a failed audio task
  const { data: failedTask, error: taskError } = await supabase
    .from('job_tasks')
    .select('*')
    .eq('task_type', 'audio_generation')
    .eq('status', 'failed')
    .order('created_at', { ascending: false })
    .limit(1)
    .single();

  if (taskError || !failedTask) {
    console.error('❌ No failed audio tasks found:', taskError?.message);
    return;
  }

  console.log(`📋 Found failed task: ${failedTask.id}`);
  console.log(`   Job ID: ${failedTask.job_id}`);
  console.log(`   Error: ${failedTask.error}`);
  
  const input = failedTask.input as any;
  const textArtifactPath = input?.textArtifactPath;
  
  if (!textArtifactPath) {
    console.log('\n❌ No textArtifactPath in task input!');
    console.log('   Input:', JSON.stringify(input, null, 2));
    return;
  }

  console.log(`\n📁 Text Artifact Path: ${textArtifactPath}`);

  // Try to download the file
  console.log('\n🔍 Attempting to download from storage...');
  try {
    const { data, error } = await supabase.storage
      .from('job-artifacts')
      .download(textArtifactPath);

    if (error) {
      console.log(`❌ Download error: ${error.message}`);
      console.log(`   Error code: ${error.statusCode || 'N/A'}`);
      console.log(`   Error details:`, JSON.stringify(error, null, 2));
    } else if (!data) {
      console.log(`❌ Download returned no data`);
    } else {
      const text = Buffer.from(await data.arrayBuffer()).toString('utf-8');
      console.log(`✅ File exists and downloaded successfully!`);
      console.log(`   Size: ${text.length} characters`);
      console.log(`   First 200 chars: ${text.substring(0, 200)}...`);
    }
  } catch (err: any) {
    console.error(`❌ Exception during download:`, err.message);
    console.error(`   Stack:`, err.stack);
  }

  // Check if file exists by listing the directory
  console.log('\n🔍 Checking if file exists by listing directory...');
  try {
    const pathParts = textArtifactPath.split('/');
    const directory = pathParts.slice(0, -1).join('/');
    const fileName = pathParts[pathParts.length - 1];
    
    console.log(`   Directory: ${directory}`);
    console.log(`   File name: ${fileName}`);

    const { data: files, error: listError } = await supabase.storage
      .from('job-artifacts')
      .list(directory, {
        limit: 100,
        offset: 0,
      });

    if (listError) {
      console.log(`❌ List error: ${listError.message}`);
      console.log(`   Error code: ${listError.statusCode || 'N/A'}`);
    } else if (!files || files.length === 0) {
      console.log(`⚠️  Directory is empty or doesn't exist`);
    } else {
      console.log(`✅ Directory exists with ${files.length} files`);
      const matchingFile = files.find(f => f.name === fileName);
      if (matchingFile) {
        console.log(`✅ File found in directory listing!`);
        console.log(`   Name: ${matchingFile.name}`);
        console.log(`   Size: ${matchingFile.metadata?.size || 'unknown'} bytes`);
        console.log(`   Created: ${matchingFile.created_at}`);
      } else {
        console.log(`❌ File NOT found in directory listing`);
        console.log(`   Files in directory:`, files.map(f => f.name).join(', '));
      }
    }
  } catch (err: any) {
    console.error(`❌ Exception during list:`, err.message);
  }

  // Check the source task (text generation) to see if it completed
  console.log('\n🔍 Checking source text generation task...');
  const sourceTaskId = input?.sourceTaskId;
  if (sourceTaskId) {
    const { data: sourceTask, error: sourceError } = await supabase
      .from('job_tasks')
      .select('*')
      .eq('id', sourceTaskId)
      .single();

    if (sourceError) {
      console.log(`⚠️  Could not find source task: ${sourceError.message}`);
    } else if (sourceTask) {
      console.log(`✅ Source task found: ${sourceTask.id}`);
      console.log(`   Status: ${sourceTask.status}`);
      console.log(`   Completed: ${sourceTask.completed_at || 'Not completed'}`);
      
      // Check if source task has artifacts
      const { data: artifacts } = await supabase
        .from('job_artifacts')
        .select('*')
        .eq('task_id', sourceTaskId)
        .eq('artifact_type', 'text');

      if (artifacts && artifacts.length > 0) {
        console.log(`✅ Source task has ${artifacts.length} text artifact(s)`);
        for (const artifact of artifacts) {
          console.log(`   - Storage path: ${artifact.storage_path}`);
          console.log(`   - Created: ${artifact.created_at}`);
        }
      } else {
        console.log(`❌ Source task has NO text artifacts!`);
      }
    }
  } else {
    console.log(`⚠️  No sourceTaskId in input`);
  }
}

checkStorageArtifacts().catch(err => {
  console.error('❌ Fatal error:', err);
  process.exit(1);
});
