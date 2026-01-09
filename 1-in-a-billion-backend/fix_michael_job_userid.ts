/**
 * Fix: Set user_id for Michael's Vedic job
 * Job ID: 5949528b-c445-48f3-a877-709b91ad8e7e
 * User ID: 0c47c27f-b280-41e1-80be-3b2676c067d5
 */

import { createClient } from '@supabase/supabase-js';
import { env } from './src/config/env';

const supabaseUrl = env.SUPABASE_URL!;
const supabaseKey = env.SUPABASE_SERVICE_ROLE_KEY!;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function fixJobUserId() {
  const jobId = '5949528b-c445-48f3-a877-709b91ad8e7e';
  const userId = '0c47c27f-b280-41e1-80be-3b2676c067d5';

  console.log(`🔧 Updating job ${jobId} with user_id ${userId}...`);

  const { data, error } = await supabase
    .from('jobs')
    .update({ user_id: userId })
    .eq('id', jobId)
    .select();

  if (error) {
    console.error('❌ Error updating job:', error);
    process.exit(1);
  }

  if (!data || data.length === 0) {
    console.error('❌ Job not found');
    process.exit(1);
  }

  console.log('✅ Job updated successfully!');
  console.log('Job details:', JSON.stringify(data[0], null, 2));
}

fixJobUserId().catch(console.error);
