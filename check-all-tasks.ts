import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';
config();

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function checkAllTasks() {
  const { data: jobs } = await supabase.from('jobs').select('id').order('created_at', { ascending: false }).limit(1);
  const jobId = jobs?.[0]?.id;

  const { data: tasks } = await supabase
    .from('job_tasks')
    .select('task_type, status')
    .eq('job_id', jobId);

  const summary: any = {};
  tasks?.forEach(t => {
    const key = `${t.task_type}_${t.status}`;
    summary[key] = (summary[key] || 0) + 1;
  });

  console.log('\n📋 Task breakdown:\n');
  Object.entries(summary).sort().forEach(([key, count]) => {
    console.log(`  ${key}: ${count}`);
  });
  
  console.log(`\n📊 Total: ${tasks?.length} tasks`);
}

checkAllTasks().catch(console.error);
