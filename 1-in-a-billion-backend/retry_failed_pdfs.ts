import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function retryFailedPDFs() {
  const jobId = 'fd3af2d1-d93a-48d3-a918-685db893dd7a';
  
  console.log('🔄 Retrying failed Person 2 PDF tasks...\n');
  
  // Get failed PDF tasks
  const { data: failedTasks } = await supabase
    .from('job_tasks')
    .select('id, sequence, input')
    .eq('job_id', jobId)
    .eq('task_type', 'pdf_generation')
    .eq('status', 'failed');
  
  if (!failedTasks || failedTasks.length === 0) {
    console.log('✅ No failed PDF tasks found!');
    return;
  }
  
  console.log(`Found ${failedTasks.length} failed PDF tasks\n`);
  
  for (const task of failedTasks) {
    const inp = task.input || {};
    console.log(`📄 Retrying Doc ${inp.docNum}: ${inp.system} - ${inp.docType}`);
    
    const { error } = await supabase
      .from('job_tasks')
      .update({
        status: 'pending',
        attempts: 0,
        error: null,
        worker_id: null,
        claimed_at: null,
        completed_at: null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', task.id);
    
    if (error) {
      console.log(`   ❌ Error: ${error.message}`);
    } else {
      console.log(`   ✅ Reset to pending`);
    }
  }
  
  console.log('\n✨ Failed tasks reset! PDF worker will retry them now.');
}

retryFailedPDFs().catch(console.error);
