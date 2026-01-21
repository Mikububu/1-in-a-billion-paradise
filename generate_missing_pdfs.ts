import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function generateMissingPDFs() {
  const jobId = 'fd3af2d1-d93a-48d3-a918-685db893dd7a';
  
  console.log('🔄 Generating missing Person 2 PDFs...\n');
  
  // Get the 5 person2 text artifacts
  const { data: textArtifacts, error } = await supabase
    .from('job_artifacts')
    .select('*')
    .eq('job_id', jobId)
    .eq('artifact_type', 'text')
    .contains('metadata', { docType: 'person2' });
  
  if (error) {
    console.error('❌ Error fetching text artifacts:', error);
    return;
  }
  
  console.log(`Found ${textArtifacts?.length || 0} person2 text artifacts\n`);
  
  if (!textArtifacts || textArtifacts.length === 0) {
    console.log('❌ No person2 text artifacts found!');
    return;
  }
  
  // Create PDF tasks for each
  for (const textArtifact of textArtifacts) {
    const meta = textArtifact.metadata || {};
    const docNum = meta.docNum;
    const system = meta.system;
    
    console.log(`📄 Creating PDF task for Doc ${docNum}: ${system} - person2`);
    
    try {
      const { error: insertError } = await supabase
        .from('job_tasks')
        .insert({
          job_id: jobId,
          task_type: 'pdf_generation',
          status: 'pending',
          sequence: 100 + docNum,
          input: {
            textArtifactPath: textArtifact.storage_path,
            title: meta.title || `${system} - Person 2`,
            docNum: docNum,
            docType: 'person2',
            system: system,
            sourceTaskId: textArtifact.task_id,
          },
          attempts: 0,
          max_attempts: 3,
          heartbeat_timeout_seconds: 300,
        });
      
      if (insertError) {
        console.error(`   ❌ Error: ${insertError.message}`);
      } else {
        console.log(`   ✅ Task created`);
      }
    } catch (err: any) {
      console.error(`   ❌ Error: ${err.message}`);
    }
  }
  
  console.log('\n✨ Missing PDF tasks created! PDF worker will process them now.');
}

generateMissingPDFs().catch(console.error);
