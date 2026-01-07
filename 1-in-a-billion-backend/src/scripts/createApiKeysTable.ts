/**
 * CREATE API KEYS TABLE
 * 
 * Creates the api_keys table in Supabase if it doesn't exist.
 * Run this script to set up the table for API key storage.
 */

import { createSupabaseServiceClient } from '../services/supabaseClient';

const CREATE_TABLE_SQL = `
-- Create table for storing API keys and tokens
CREATE TABLE IF NOT EXISTS api_keys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  service TEXT NOT NULL UNIQUE,
  key_name TEXT,
  token TEXT NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create function to get API key
CREATE OR REPLACE FUNCTION get_api_key(p_service TEXT)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN (SELECT token FROM api_keys WHERE service = p_service LIMIT 1);
END;
$$;

-- Grant access to service_role
GRANT SELECT ON api_keys TO service_role;
GRANT EXECUTE ON FUNCTION get_api_key TO service_role;

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_api_keys_service ON api_keys(service);
`;

async function createTable() {
  console.log('🔧 Creating api_keys table in Supabase...');
  
  try {
    const supabase = createSupabaseServiceClient();
    if (!supabase) {
      console.error('❌ Supabase client not initialized');
      console.log('   Please check your SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env');
      process.exit(1);
    }

    // Execute the SQL
    const { error } = await supabase.rpc('exec_sql', { sql: CREATE_TABLE_SQL });
    
    if (error) {
      // Try direct SQL execution via REST API
      console.log('⚠️  RPC method failed, trying direct SQL...');
      const response = await fetch(`${process.env.SUPABASE_URL}/rest/v1/rpc/exec_sql`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': process.env.SUPABASE_SERVICE_ROLE_KEY || '',
          'Authorization': `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY || ''}`,
        },
        body: JSON.stringify({ sql: CREATE_TABLE_SQL }),
      });

      if (!response.ok) {
        console.log('⚠️  Direct SQL also failed. Please run the migration manually:');
        console.log('\n' + CREATE_TABLE_SQL);
        console.log('\n💡 You can run this SQL in Supabase Dashboard → SQL Editor');
        process.exit(1);
      }
    }

    console.log('✅ api_keys table created successfully!');
    console.log('\n💡 Next steps:');
    console.log('   1. Add your API keys to the api_keys table');
    console.log('   2. Example: INSERT INTO api_keys (service, token, description) VALUES (\'deepseek\', \'your-key\', \'DeepSeek API\');');
    
  } catch (err: any) {
    console.error('❌ Error creating table:', err.message);
    console.log('\n💡 Please run this SQL manually in Supabase Dashboard → SQL Editor:');
    console.log('\n' + CREATE_TABLE_SQL);
    process.exit(1);
  }
}

createTable();

