import { createSupabaseServiceClient } from './src/services/supabaseClient';
import { config } from 'dotenv';
import { join } from 'path';

config({ path: join(__dirname, '.env') });

const supabase = createSupabaseServiceClient();

if (!supabase) {
  console.error('❌ Supabase not configured');
  process.exit(1);
}

async function checkTextArtifacts() {
  console.log('🔍 Checking text artifacts for Iya (Western, docNum 1)...\n');

  const iyaJobId = '106ac0b3-1652-47c0-b462-8bd3dbd7924b';

  // Get text artifacts for docNum 1 (Iya's Western reading)
  const { data: textArtifacts } = await supabase
    .from('job_artifacts')
    .select('*')
    .eq('job_id', iyaJobId)
    .eq('artifact_type', 'text')
    .filter('metadata->>docNum', 'eq', '1');

  console.log(`📄 Found ${textArtifacts?.length || 0} text artifact(s) for docNum 1:\n`);

  for (const artifact of textArtifacts || []) {
    console.log(`Artifact ID: ${artifact.id.substring(0, 8)}...`);
    console.log(`Metadata:`, JSON.stringify(artifact.metadata, null, 2));
    console.log(`Storage Key: ${artifact.storage_key}`);
    
    // Fetch the actual text content
    if (artifact.storage_key) {
      const { data: fileData } = await supabase.storage
        .from('job-artifacts')
        .download(artifact.storage_key);
      
      if (fileData) {
        const text = await fileData.text();
        console.log(`\nText Content (first 1000 chars):`);
        console.log(text.substring(0, 1000));
        console.log(`\n... [Total length: ${text.length} characters]\n`);
        
        // Check if the text mentions "Jonathan"
        if (text.includes('Jonathan')) {
          console.log('⚠️  WARNING: Text mentions "Jonathan" - this is WRONG for a person1 doc!');
          // Find all mentions
          const mentions = text.match(/Jonathan/g);
          console.log(`   Found ${mentions?.length} mention(s) of "Jonathan"`);
        } else {
          console.log('✅ Text does NOT mention "Jonathan" - correct for person1 doc');
        }
      }
    }
    console.log('\n' + '═'.repeat(60) + '\n');
  }
}

checkTextArtifacts().catch(err => {
  console.error('❌ Fatal error:', err);
  process.exit(1);
});
