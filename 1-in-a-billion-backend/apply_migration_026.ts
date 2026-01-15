import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL || 'https://jyjsfjulwnkogqsvivkp.supabase.co';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseKey) {
  console.error('❌ SUPABASE_SERVICE_ROLE_KEY not found in .env');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function applyMigration() {
  console.log('📦 Applying migration 026_add_cost_tracking.sql...\n');
  
  // Execute each statement individually
  const statements = [
    // Add cost_data to job_tasks
    `ALTER TABLE job_tasks ADD COLUMN IF NOT EXISTS cost_data JSONB DEFAULT '{}'`,
    
    // Add total_cost_usd to jobs
    'ALTER TABLE jobs ADD COLUMN IF NOT EXISTS total_cost_usd NUMERIC(10, 6) DEFAULT 0',
    
    // Add cost_breakdown to jobs
    `ALTER TABLE jobs ADD COLUMN IF NOT EXISTS cost_breakdown JSONB DEFAULT '{}'`,
    
    // Create cost_logs table
    `CREATE TABLE IF NOT EXISTS cost_logs (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      job_id UUID REFERENCES jobs(id) ON DELETE CASCADE,
      task_id UUID REFERENCES job_tasks(id) ON DELETE SET NULL,
      provider TEXT NOT NULL,
      model TEXT,
      input_tokens INTEGER DEFAULT 0,
      output_tokens INTEGER DEFAULT 0,
      execution_time_ms INTEGER DEFAULT 0,
      cost_usd NUMERIC(10, 6) NOT NULL DEFAULT 0,
      label TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )`,
    
    // Create indexes
    'CREATE INDEX IF NOT EXISTS idx_cost_logs_job_id ON cost_logs(job_id)',
    'CREATE INDEX IF NOT EXISTS idx_cost_logs_provider ON cost_logs(provider)',
    'CREATE INDEX IF NOT EXISTS idx_cost_logs_created_at ON cost_logs(created_at DESC)',
    
    // Enable RLS
    'ALTER TABLE cost_logs ENABLE ROW LEVEL SECURITY',
    
    // Grant permissions
    'GRANT SELECT ON cost_logs TO authenticated',
    'GRANT ALL ON cost_logs TO service_role',
  ];
  
  for (let i = 0; i < statements.length; i++) {
    const stmt = statements[i];
    const preview = stmt.replace(/\s+/g, ' ').substring(0, 60);
    console.log(`  [${i+1}/${statements.length}] ${preview}...`);
    
    try {
      // Try using the exec_sql RPC function
      const { error } = await supabase.rpc('exec_sql', { sql: stmt });
      if (error) {
        console.log(`    ⚠️ ${error.message?.substring(0, 50)}`);
      } else {
        console.log('    ✅ Done');
      }
    } catch (e: any) {
      console.log(`    ⚠️ ${e.message?.substring(0, 50) || 'Unknown error'}`);
    }
  }
  
  // Test if table exists by querying it
  console.log('\n🔍 Verifying cost_logs table...');
  const { data, error } = await supabase.from('cost_logs').select('*').limit(1);
  
  if (!error) {
    console.log('✅ SUCCESS! cost_logs table exists and is accessible!');
    console.log(`   Current rows: ${data?.length || 0}`);
  } else if (error.code === '42P01') {
    console.log('\n❌ Table does not exist yet.');
    console.log('\n📋 Please run this SQL in Supabase SQL Editor:\n');
    console.log('-----------------------------------------------');
    statements.forEach((s) => console.log(`${s};\n`));
    console.log('-----------------------------------------------');
  } else {
    console.log(`⚠️ Table check result: ${error.message}`);
  }
}

applyMigration().catch(console.error);
