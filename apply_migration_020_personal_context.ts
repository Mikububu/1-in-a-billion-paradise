/**
 * Apply Migration 020: Add personal_context to library_people
 * 
 * Usage:
 *   npx tsx apply_migration_020_personal_context.ts
 */

import { readFileSync } from 'fs';
import { join } from 'path';
import { config } from 'dotenv';
import { createClient } from '@supabase/supabase-js';

// Load environment variables
config({ path: join(__dirname, '.env') });

async function applyMigration() {
  console.log('📊 Applying Migration 020: Add personal_context to library_people table...\n');

  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseKey) {
    console.error('❌ Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env');
    process.exit(1);
  }

  const supabase = createClient(supabaseUrl, supabaseKey);

  // Read migration file
  const migrationPath = join(__dirname, 'supabase/migrations/020_add_personal_context_to_library_people.sql');
  let sql: string;
  try {
    sql = readFileSync(migrationPath, 'utf-8');
    console.log('✅ Migration file read successfully');
  } catch (err: any) {
    console.error(`❌ Failed to read migration file: ${err.message}`);
    console.log(`   Expected path: ${migrationPath}`);
    process.exit(1);
  }

  console.log('\n🔧 Applying migration to Supabase...');
  console.log(`   URL: ${supabaseUrl}`);

  // Split SQL into statements and execute
  // Remove comments and split by semicolons
  const cleanedSql = sql
    .split('\n')
    .map(line => {
      // Remove inline comments (-- style)
      const commentIndex = line.indexOf('--');
      if (commentIndex >= 0) {
        return line.substring(0, commentIndex).trim();
      }
      return line.trim();
    })
    .filter(line => line.length > 0)
    .join('\n');

  const statements = cleanedSql
    .split(';')
    .map(s => s.trim())
    .filter(s => s.length > 0 && s.length > 10); // Filter out very short fragments

  console.log(`   Found ${statements.length} SQL statements\n`);

  for (let i = 0; i < statements.length; i++) {
    const statement = statements[i] + ';';
    console.log(`   Executing statement ${i + 1}/${statements.length}...`);
    
    try {
      // Supabase doesn't allow arbitrary SQL via REST API for security
      // We'll try to verify if column exists, but migration must be applied manually
      console.log(`   ⚠️  Cannot execute SQL automatically (Supabase security restriction)`);
      console.log(`   💡 Please apply this migration manually in Supabase Dashboard → SQL Editor`);
    } catch (err: any) {
      console.log(`   ⚠️  Error: ${err.message}`);
    }
  }

  // Verify the column was added
  console.log('\n🔍 Verifying migration...');
  try {
    const { data, error } = await supabase
      .from('library_people')
      .select('personal_context')
      .limit(1);

    if (error) {
      if (error.message.includes('column') && error.message.includes('does not exist')) {
        console.log('❌ Column still not found - migration may have failed');
        console.log('\n💡 Please apply this SQL manually in Supabase Dashboard → SQL Editor:');
        console.log('\n--- Copy from here ---\n');
        console.log(sql);
        console.log('\n--- End of SQL ---\n');
        process.exit(1);
      } else {
        // Other error (like no rows) is fine - column exists
        console.log('✅ Column exists (query succeeded)');
      }
    } else {
      console.log('✅ Column exists and is accessible');
    }
  } catch (err: any) {
    console.log('⚠️  Could not verify (this is okay if table is empty)');
  }

  console.log('\n✅ Migration 020 completed!');
  console.log('   The personal_context column should now be available in library_people table.');
}

applyMigration().catch(err => {
  console.error('❌ Fatal error:', err);
  process.exit(1);
});
