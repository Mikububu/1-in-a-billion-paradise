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
  console.log('🔍 Checking ALL text artifacts for Iya job...\n');

  const iyaJobId = '106ac0b3-1652-47c0-b462-8bd3dbd7924b';

  // Get ALL text artifacts
  const { data: textArtifacts } = await supabase
    .from('job_artifacts')
    .select('*')
    .eq('job_id', iyaJobId)
    .eq('artifact_type', 'text')
    .order('created_at', { ascending: true });

  console.log(`📄 Found ${textArtifacts?.length || 0} text artifacts:\n`);

  for (const artifact of textArtifacts || []) {
    console.log(`\nArtifact ID: ${artifact.id.substring(0, 8)}...`);
    console.log(`DocNum: ${artifact.metadata?.docNum}, DocType: ${artifact.metadata?.docType}, System: ${artifact.metadata?.system}`);
    console.log(`Storage Key: ${artifact.storage_key || 'NONE'}`);
    console.log(`Storage Path: ${artifact.storage_path || 'NONE'}`);
    
    // Try to fetch using storage_path if storage_key doesn't exist
    const key = artifact.storage_key || artifact.storage_path;
    
    if (key) {
      try {
        const { data: fileData, error } = await supabase.storage
          .from('job-artifacts')
          .download(key);
        
        if (error) {
          console.log(`❌ Error downloading: ${error.message}`);
        } else if (fileData) {
          const text = await fileData.text();
          console.log(`✅ Downloaded ${text.length} characters`);
          
          // Check if text mentions Jonathan
          if (text.includes('Jonathan')) {
            const mentions = text.match(/Jonathan/g);
            console.log(`⚠️  TEXT MENTIONS "Jonathan" ${mentions?.length} time(s) - WRONG for ${artifact.metadata?.docType}!`);
            
            // Show a snippet with context
            const index = text.indexOf('Jonathan');
            const snippet = text.substring(Math.max(0, index - 100), Math.min(text.length, index + 150));
            console.log(`\nSnippet: "...${snippet}..."`);
          } else {
            console.log(`✅ Text does NOT mention "Jonathan" - correct for ${artifact.metadata?.docType}`);
          }
        }
      } catch (err: any) {
        console.log(`❌ Exception: ${err.message}`);
      }
    }
    
    console.log('─'.repeat(60));
  }
}

checkTextArtifacts().catch(err => {
  console.error('❌ Fatal error:', err);
  process.exit(1);
});
