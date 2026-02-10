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
  console.log('🔍 Checking Supabase for jobs and song tasks...\n');
  
  const { data: jobs, error } = await supabase
    .from('jobs')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(5);

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
    
    // Check tasks with details
    const { data: tasks } = await supabase
      .from('job_tasks')
      .select('*')
      .eq('job_id', job.id)
      .order('created_at', { ascending: true });
    
    if (tasks && tasks.length > 0) {
      const summary = tasks.reduce((acc: any, t: any) => {
        acc[t.status] = (acc[t.status] || 0) + 1;
        return acc;
      }, {});
      console.log(`   Tasks: ${JSON.stringify(summary)}`);
      
      // Show song tasks specifically
      const songTasks = tasks.filter((t: any) => t.task_type === 'song_generation');
      if (songTasks.length > 0) {
        console.log(`   🎵 Song tasks:`);
        for (const st of songTasks) {
          console.log(`      - ${st.status} | claimed: ${st.claimed_at ? 'YES' : 'NO'} | completed: ${st.completed_at ? 'YES' : 'NO'}`);
          if (st.error) {
            console.log(`        ERROR: ${st.error.substring(0, 100)}`);
          }
          
          // Check for song artifacts
          const { data: artifacts } = await supabase
            .from('job_artifacts')
            .select('*')
            .eq('task_id', st.id)
            .eq('artifact_type', 'audio_song');
          
          if (artifacts && artifacts.length > 0) {
            console.log(`        ✅ Artifact exists: ${artifacts[0].public_url ? 'HAS URL' : 'NO URL'}`);
            if (artifacts[0].metadata?.error) {
              console.log(`        ⚠️ Error artifact: ${artifacts[0].metadata.errorMessage}`);
            }
          } else {
            console.log(`        ❌ No artifact yet`);
          }
        }
      }
    } else {
      console.log(`   ⚠️ NO TASKS`);
    }
    console.log('');
  }
  
  // Check MiniMax key
  console.log('\n🔑 Checking MiniMax API key...');
  const { data: keyData } = await supabase
    .from('api_keys')
    .select('*')
    .eq('provider', 'minimax')
    .single();
  
  if (!keyData) {
    console.log('❌ MiniMax API key NOT found');
  } else {
    console.log(`✅ MiniMax key exists: ${keyData.token?.substring(0, 20)}...`);
  }
}

checkJobs().then(() => process.exit(0)).catch((e) => {
  console.error(e);
  process.exit(1);
});
