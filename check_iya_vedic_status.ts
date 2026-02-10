import { createSupabaseServiceClient } from './src/services/supabaseClient';
import { config } from 'dotenv';
import { join } from 'path';

config({ path: join(__dirname, '.env') });

const supabase = createSupabaseServiceClient();
const jobId = 'd78099b3-0cc0-49e9-ae30-70168180125b';

async function checkStatus() {
  console.log('🔍 Checking Iya & Jonathan Vedic synastry status...\n');
  
  const { data: job } = await supabase.from('jobs').select('*').eq('id', jobId).single();
  console.log(`Status: ${job?.status}`);
  console.log(`Progress: ${JSON.stringify(job?.progress)}\n`);
  
  const { data: artifacts } = await supabase.from('job_artifacts').select('*').eq('job_id', jobId).eq('artifact_type', 'text');
  console.log(`Text artifacts: ${artifacts?.length || 0}`);
  
  for (const a of artifacts || []) {
    console.log(`\n  Doc ${a.metadata?.docNum}: ${a.metadata?.docType} (${a.metadata?.system})`);
    
    const key = a.storage_key || a.storage_path;
    if (key) {
      const { data: fileData } = await supabase.storage.from('job-artifacts').download(key);
      if (fileData) {
        const text = await fileData.text();
        console.log(`  Length: ${text.length} chars`);
        
        // Check for mentions
        if (a.metadata?.docType === 'person1') {
          const mentions = text.match(/Jonathan/g);
          if (mentions) {
            console.log(`  ❌ Iya's doc mentions "Jonathan" ${mentions.length} times - BUG STILL EXISTS`);
          } else {
            console.log(`  ✅ Iya's doc does NOT mention "Jonathan" - FIX VERIFIED`);
          }
        } else if (a.metadata?.docType === 'person2') {
          const mentions = text.match(/Iya/g);
          if (mentions) {
            console.log(`  ❌ Jonathan's doc mentions "Iya" ${mentions.length} times - BUG STILL EXISTS`);
          } else {
            console.log(`  ✅ Jonathan's doc does NOT mention "Iya" - FIX VERIFIED`);
          }
        } else if (a.metadata?.docType === 'overlay') {
          const iyaMentions = text.match(/Iya/g);
          const jonMentions = text.match(/Jonathan/g);
          console.log(`  ✅ Overlay mentions Iya ${iyaMentions?.length || 0}x, Jonathan ${jonMentions?.length || 0}x (correct)`);
        }
      }
    }
  }
}

checkStatus().catch(console.error);
