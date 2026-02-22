/**
 * Apply Migration 014 - Parallel Post-Text Tasks
 * 
 * This script applies the migration using direct Postgres connection.
 */

import { readFileSync } from 'fs';
import { join } from 'path';
import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';

// Load environment variables
config({ path: join(__dirname, '../../.env') });

async function applyMigration014() {
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseKey) {
    console.error('❌ Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env');
    process.exit(1);
  }

  console.log('📄 Reading migration 014...');
  const migrationPath = join(__dirname, '../../migrations/014_parallel_post_text_tasks.sql');
  const sql = readFileSync(migrationPath, 'utf-8');

  console.log('🔧 Applying migration to Supabase...');
  console.log('   URL:', supabaseUrl);

  const supabase = createClient(supabaseUrl, supabaseKey);

  // Execute the SQL directly
  try {
    const { data, error } = await supabase.rpc('exec', { sql });
    
    if (error) {
      console.error('❌ Migration failed:', error);
      console.log('\n💡 Please apply this SQL manually in Supabase Dashboard → SQL Editor:');
      console.log('\n--- Copy from here ---\n');
      console.log(sql);
      console.log('\n--- End of SQL ---\n');
      process.exit(1);
    }

    console.log('✅ Migration applied successfully!');
  } catch (err: any) {
    console.error('❌ Error applying migration:', err.message);
    console.log('\n💡 Please apply this SQL manually in Supabase Dashboard → SQL Editor:');
    console.log('\n--- Copy from here ---\n');
    console.log(sql);
    console.log('\n--- End of SQL ---\n');
    process.exit(1);
  }
}

applyMigration014().catch(err => {
  console.error('❌ Fatal error:', err);
  process.exit(1);
});
