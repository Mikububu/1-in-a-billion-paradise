import { config } from 'dotenv';
import { resolve } from 'path';
config({ path: resolve(__dirname, '.env') });

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkJobs() {
  console.log('🔍 Checking Supabase for jobs...\n');
  
  const { data: jobs, error } = await supabase
    .from('jobs')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(20);

  if (error) {
    console.error('❌ Error:', error);
    return;
  }

  if (!jobs || jobs.length === 0) {
    console.log('❌ NO JOBS FOUND IN DATABASE');
    return;
  }

  console.log(`Found ${jobs.length} recent jobs:\n`);
  
  for (const job of jobs) {
    const personName = job.params?.person1?.name || 'Unknown';
    const created = new Date(job.created_at).toLocaleString();
    console.log(`📋 ${job.id.slice(0, 8)}... | ${job.type} | ${job.status}`);
    console.log(`   Person: ${personName} | Created: ${created}`);
    
    // Check tasks
    const { data: tasks } = await supabase
      .from('job_tasks')
      .select('task_type, status')
      .eq('job_id', job.id);
    
    if (tasks && tasks.length > 0) {
      const summary = tasks.reduce((acc: any, t: any) => {
        acc[t.status] = (acc[t.status] || 0) + 1;
        return acc;
      }, {});
      console.log(`   Tasks: ${JSON.stringify(summary)}`);
    } else {
      console.log(`   ⚠️ NO TASKS`);
    }
    console.log('');
  }
}

checkJobs().then(() => process.exit(0)).catch((e) => {
  console.error(e);
  process.exit(1);
});
