/**
 * Apply Migration 018: Add System Essences to People
 * 
 * Run this manually if supabase CLI fails:
 *   npx tsx apply_migration_018_essences.ts
 */

import { supabase } from './src/config/supabase';
import * as fs from 'fs';
import * as path from 'path';

async function applyMigration() {
  console.log('📊 Applying Migration 018: Add system essences to people table...\n');

  const migrationPath = path.join(__dirname, 'supabase/migrations/018_add_system_essences_to_people.sql');
  const sql = fs.readFileSync(migrationPath, 'utf-8');

  // Split by semicolons and execute each statement
  const statements = sql
    .split(';')
    .map(s => s.trim())
    .filter(s => s.length > 0 && !s.startsWith('--'));

  for (let i = 0; i < statements.length; i++) {
    const statement = statements[i];
    console.log(`\n[${i + 1}/${statements.length}] Executing:`);
    console.log(statement.substring(0, 100) + '...');

    try {
      const { error } = await supabase.rpc('exec_sql', { sql_query: statement });
      
      if (error) {
        // Try direct query if rpc fails
        const { error: directError } = await supabase.from('_').select('*').limit(0);
        if (directError) {
          console.error(`   ❌ Error:`, error);
          console.error(`   Trying raw SQL...`);
          
          // For Supabase, we may need to use the REST API or psql directly
          // This is a fallback - you may need to run the SQL manually in Supabase dashboard
          console.warn(`   ⚠️  Cannot execute via Supabase client. Please run this SQL in Supabase SQL Editor:`);
          console.log(statement);
          continue;
        }
      }

      console.log(`   ✅ Success`);
    } catch (err: any) {
      console.error(`   ❌ Error:`, err.message);
      console.log(`\n⚠️  You may need to run this migration manually in Supabase dashboard.`);
    }
  }

  // Verify the column exists
  console.log(`\n\n🔍 Verifying essences column...`);
  const { data, error } = await supabase
    .from('people')
    .select('id, name, essences')
    .limit(1);

  if (error) {
    console.error('❌ Verification failed:', error);
    console.log('\n📋 MANUAL MIGRATION REQUIRED:');
    console.log('Please copy/paste the SQL from:');
    console.log('  supabase/migrations/018_add_system_essences_to_people.sql');
    console.log('Into your Supabase SQL Editor and run it there.');
    process.exit(1);
  }

  console.log('✅ Migration verified! Essences column exists.');
  console.log('\n🎉 Migration 018 complete!');
  process.exit(0);
}

applyMigration().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
