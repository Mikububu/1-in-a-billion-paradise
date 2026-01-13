/**
 * Quick check of current jobs in pipeline
 */

import { createSupabaseServiceClient } from './src/services/supabaseClient';
import { config } from 'dotenv';
import { join } from 'path';

config({ path: join(__dirname, '.env') });

async function checkCurrentJobs() {
  const supabase = createSupabaseServiceClient();

  if (!supabase) {
    console.error('❌ Supabase not configured');
    process.exit(1);
  }

  const { data: jobs, error } = await supabase
    .from('jobs')
    .select('id, status, params, type, created_at, progress')
    .in('status', ['queued', 'processing', 'complete', 'error'])
    .order('created_at', { ascending: false })
    .limit(10);

  if (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }

  console.log('📊 Current Jobs in Pipeline:\n');

  if (!jobs || jobs.length === 0) {
    console.log('   No active jobs found');
    return;
  }

  jobs.forEach((job: any) => {
    const p1 = job.params?.person1?.name || 'Unknown';
    const p2 = job.params?.person2?.name;
    const name = p2 ? `${p1} & ${p2}` : p1;
    const systems = job.params?.systems || [];
    const systemList = Array.isArray(systems) ? systems.join(', ') : 'Unknown';
    
    const statusEmoji = {
      'queued': '⏳',
      'processing': '🔄',
      'complete': '✅',
      'error': '❌',
    }[job.status] || '❓';

    console.log(`${statusEmoji} ${name}`);
    console.log(`   ID: ${job.id.slice(0, 8)}... | Status: ${job.status} | Type: ${job.type}`);
    console.log(`   Systems: ${systemList}`);
    if (job.progress?.percent) {
      console.log(`   Progress: ${job.progress.percent}% - ${job.progress.phase || 'N/A'}`);
    }
    console.log(`   Created: ${new Date(job.created_at).toLocaleString()}`);
    console.log('');
  });
}

checkCurrentJobs().catch(console.error);
