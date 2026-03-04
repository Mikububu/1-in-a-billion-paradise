import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config();

const Math = global.Math;

const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

async function run() {
  const jobId = '1073415e-2a3c-438c-ad43-a441142a2041';
  
  const { data: jobInfo, error } = await supabase.from('jobs').select('*').eq('id', jobId).single();
  if (error) {
    console.error('Job query error:', error);
    return;
  }
  
  console.log('--- JOB PARAMS ---');
  console.log(JSON.stringify(jobInfo.params, null, 2));
  
  console.log('\n--- TEXT ARTIFACTS ---');
  const userId = jobInfo.user_id;
  const { data: files } = await supabase.storage.from('job-artifacts').list(`${userId}/${jobId}/text`, { limit: 10 });
  
  if (files && files.length > 0) {
    for (const f of files) {
      if (f.name.endsWith('.txt')) {
        console.log(`\nContents of ${f.name}:`);
        const { data: fileData } = await supabase.storage.from('job-artifacts').download(`${userId}/${jobId}/text/${f.name}`);
        if (fileData) {
          const text = await fileData.text();
          console.log(text.substring(0, 1000) + '\n...\n' + text.substring(text.length - 1000));
        }
      }
    }
  } else {
    console.log('No text files found.');
  }

}

run();
