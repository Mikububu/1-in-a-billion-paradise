import { createSupabaseServiceClient } from './src/services/supabaseClient';
import { config } from 'dotenv';
import { join } from 'path';

config({ path: join(__dirname, '.env') });

const supabase = createSupabaseServiceClient();

if (!supabase) {
  console.error('❌ Supabase not configured');
  process.exit(1);
}

async function checkIyaJonathan() {
  console.log('🔍 Checking for Iya & Jonathan readings...\n');

  // Get ALL Iya & Jonathan jobs
  const { data: jobs } = await supabase
    .from('jobs')
    .select('*')
    .or('params->>person1Name.eq.Iya,params->person1->>name.eq.Iya')
    .order('created_at', { ascending: false });

  console.log(`📊 Found ${jobs?.length || 0} Iya jobs:\n`);

  for (const job of jobs || []) {
    const person1Name = job.params?.person1?.name || job.params?.person?.name;
    const person2Name = job.params?.person2?.name;
    
    if ((person1Name === 'Iya' && person2Name === 'Jonathan') || 
        (person1Name === 'Jonathan' && person2Name === 'Iya')) {
      
      console.log(`\n═══════════════════════════════════════════════════════════`);
      console.log(`Job ID: ${job.id}`);
      console.log(`Type: ${job.type}`);
      console.log(`Status: ${job.status}`);
      console.log(`Created: ${new Date(job.created_at).toLocaleString()}`);
      console.log(`Person 1: ${person1Name}`);
      console.log(`Person 2: ${person2Name}`);
      console.log(`Systems: ${(job.params?.systems || []).join(', ')}`);
      
      // Check if this is NEW (after fix at 9:45 PM = 21:45)
      const createdTime = new Date(job.created_at);
      const fixTime = new Date('2026-01-13T21:45:00');
      const isAfterFix = createdTime > fixTime;
      
      console.log(`\n${isAfterFix ? '✅ CREATED AFTER FIX' : '⚠️  CREATED BEFORE FIX'}`);
      
      if (isAfterFix) {
        // Get Vedic person1 text artifact
        const { data: textArtifacts } = await supabase
          .from('job_artifacts')
          .select('*')
          .eq('job_id', job.id)
          .eq('artifact_type', 'text')
          .filter('metadata->>system', 'eq', 'vedic')
          .filter('metadata->>docType', 'eq', 'person1');

        console.log(`\n📄 Vedic person1 artifacts: ${textArtifacts?.length || 0}`);

        for (const artifact of textArtifacts || []) {
          console.log(`\n  Artifact ID: ${artifact.id.substring(0, 8)}...`);
          console.log(`  DocNum: ${artifact.metadata?.docNum}`);
          
          const key = artifact.storage_key || artifact.storage_path;
          if (key) {
            try {
              const { data: fileData } = await supabase.storage
                .from('job-artifacts')
                .download(key);
              
              if (fileData) {
                const text = await fileData.text();
                console.log(`  Text length: ${text.length} characters`);
                
                // Check if person1 text mentions person2
                const mentions = text.match(/Jonathan/g);
                if (mentions) {
                  console.log(`\n  ❌ BUG STILL EXISTS: Iya's person1 text mentions "Jonathan" ${mentions.length} times!`);
                  
                  // Show first mention
                  const index = text.indexOf('Jonathan');
                  const snippet = text.substring(Math.max(0, index - 100), Math.min(text.length, index + 150));
                  console.log(`\n  Snippet: "...${snippet}..."`);
                } else {
                  console.log(`\n  ✅ FIX VERIFIED: Iya's person1 text does NOT mention "Jonathan"!`);
                }
              }
            } catch (err: any) {
              console.log(`  ⚠️  Could not load text: ${err.message}`);
            }
          }
        }
      }
    }
  }
}

checkIyaJonathan().catch(err => {
  console.error('❌ Fatal error:', err);
  process.exit(1);
});
