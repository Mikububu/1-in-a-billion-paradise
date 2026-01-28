import { createSupabaseServiceClient } from './src/services/supabaseClient';
import { config } from 'dotenv';
import { join } from 'path';

config({ path: join(__dirname, '.env') });

const supabase = createSupabaseServiceClient();

if (!supabase) {
  console.error('❌ Supabase not configured');
  process.exit(1);
}

async function checkRecentReadings() {
  console.log('🔍 Checking most recent readings (after fix deployment)...\n');

  // Get jobs created in the last 30 minutes
  const thirtyMinutesAgo = new Date(Date.now() - 30 * 60 * 1000).toISOString();

  const { data: recentJobs } = await supabase
    .from('jobs')
    .select('*')
    .gte('created_at', thirtyMinutesAgo)
    .order('created_at', { ascending: false })
    .limit(10);

  console.log(`📊 Found ${recentJobs?.length || 0} recent jobs:\n`);

  for (const job of recentJobs || []) {
    console.log(`\n═══════════════════════════════════════════════════════════`);
    console.log(`Job ID: ${job.id.substring(0, 8)}...`);
    console.log(`Type: ${job.type}`);
    console.log(`Status: ${job.status}`);
    console.log(`Created: ${new Date(job.created_at).toLocaleTimeString()}`);
    console.log(`Person: ${job.params?.person?.name || job.params?.person1?.name || 'Unknown'}`);
    if (job.params?.person2?.name) {
      console.log(`Person 2: ${job.params.person2.name}`);
    }
    console.log(`Systems: ${(job.params?.systems || []).join(', ')}`);

    // Get text artifacts for this job
    const { data: textArtifacts } = await supabase
      .from('job_artifacts')
      .select('*')
      .eq('job_id', job.id)
      .eq('artifact_type', 'text');

    console.log(`\n📄 Text artifacts: ${textArtifacts?.length || 0}`);

    for (const artifact of textArtifacts || []) {
      const docType = artifact.metadata?.docType;
      const system = artifact.metadata?.system;
      const docNum = artifact.metadata?.docNum;
      
      console.log(`\n  Doc ${docNum} (${docType}, ${system}):`);

      // Try to fetch text content
      const key = artifact.storage_key || artifact.storage_path;
      if (key) {
        try {
          const { data: fileData } = await supabase.storage
            .from('job-artifacts')
            .download(key);
          
          if (fileData) {
            const text = await fileData.text();
            console.log(`    ✅ Text loaded: ${text.length} characters`);
            
            // Check for cross-contamination
            const personName = job.params?.person?.name || job.params?.person1?.name;
            const person2Name = job.params?.person2?.name;
            
            if (docType === 'person1' && person2Name) {
              const mentions = text.match(new RegExp(person2Name, 'g'));
              if (mentions) {
                console.log(`    ❌ BUG STILL EXISTS: person1 text mentions "${person2Name}" ${mentions.length} times!`);
              } else {
                console.log(`    ✅ FIX VERIFIED: person1 text does NOT mention "${person2Name}"`);
              }
            } else if (docType === 'person2' && personName) {
              const mentions = text.match(new RegExp(personName, 'g'));
              if (mentions) {
                console.log(`    ❌ BUG STILL EXISTS: person2 text mentions "${personName}" ${mentions.length} times!`);
              } else {
                console.log(`    ✅ FIX VERIFIED: person2 text does NOT mention "${personName}"`);
              }
            } else if (docType === 'individual') {
              console.log(`    ℹ️  Individual reading (no cross-contamination check needed)`);
            }
          }
        } catch (err: any) {
          console.log(`    ⚠️  Could not load text: ${err.message}`);
        }
      }
    }
  }
}

checkRecentReadings().catch(err => {
  console.error('❌ Fatal error:', err);
  process.exit(1);
});
