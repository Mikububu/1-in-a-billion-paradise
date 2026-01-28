import 'dotenv/config';
import { createSupabaseServiceClient } from './src/services/supabaseClient';

async function main() {
  const supabase = createSupabaseServiceClient();
  if (!supabase) {
    throw new Error('Supabase not configured');
  }

  console.log('🔧 Applying claymation migration...\n');

  const sql = `
    ALTER TABLE library_people ADD COLUMN IF NOT EXISTS claymation_url TEXT;
    ALTER TABLE library_people ADD COLUMN IF NOT EXISTS original_photo_url TEXT;
  `;

  const { error } = await supabase.rpc('exec_sql', { sql_query: sql });

  if (error) {
    console.error('❌ Migration failed:', error.message);
    console.log('\n📋 Please run this SQL manually in Supabase SQL Editor:\n');
    console.log('ALTER TABLE library_people ADD COLUMN IF NOT EXISTS claymation_url TEXT;');
    console.log('ALTER TABLE library_people ADD COLUMN IF NOT EXISTS original_photo_url TEXT;');
    return;
  }

  console.log('✅ Migration applied successfully!');
}

main().catch(console.error);
