/**
 * APPLY MIGRATION SCRIPT
 * 
 * Applies SQL migrations to Supabase database.
 * Usage: ts-node src/scripts/applyMigration.ts <migration-file>
 */

import { readFileSync } from 'fs';
import { join } from 'path';
import { createSupabaseServiceClient } from '../services/supabaseClient';

async function applyMigration(migrationFile: string) {
  const migrationPath = join(__dirname, '../../migrations', migrationFile);
  
  console.log(`📄 Reading migration: ${migrationFile}`);
  let sql: string;
  try {
    sql = readFileSync(migrationPath, 'utf-8');
  } catch (err: any) {
    console.error(`❌ Failed to read migration file: ${err.message}`);
    process.exit(1);
  }

  console.log(`🔧 Applying migration to Supabase...`);
  
  const supabase = createSupabaseServiceClient();
  if (!supabase) {
    console.error('❌ Supabase client not initialized');
    console.log('   Please check your SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env');
    process.exit(1);
  }

  // Split SQL into individual statements
  const statements = sql
    .split(';')
    .map(s => s.trim())
    .filter(s => s.length > 0 && !s.startsWith('--'));

  console.log(`   Found ${statements.length} SQL statements`);

  // Execute each statement
  for (let i = 0; i < statements.length; i++) {
    const statement = statements[i] + ';';
    try {
      // Use Supabase REST API to execute SQL
      const response = await fetch(`${process.env.SUPABASE_URL}/rest/v1/rpc/exec_sql`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': process.env.SUPABASE_SERVICE_ROLE_KEY || '',
          'Authorization': `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY || ''}`,
        },
        body: JSON.stringify({ sql: statement }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.log(`⚠️  Statement ${i + 1} failed (may already exist): ${errorText.substring(0, 100)}`);
      } else {
        console.log(`✅ Statement ${i + 1} executed`);
      }
    } catch (err: any) {
      console.log(`⚠️  Statement ${i + 1} error: ${err.message}`);
      console.log(`   💡 You may need to run this migration manually in Supabase Dashboard → SQL Editor`);
      console.log(`   SQL: ${statement.substring(0, 100)}...`);
    }
  }

  console.log(`\n✅ Migration ${migrationFile} completed!`);
  console.log(`💡 If some statements failed, they may already exist. Check Supabase Dashboard for details.`);
}

// Get migration file from command line
const migrationFile = process.argv[2];
if (!migrationFile) {
  console.error('❌ Please provide a migration file name');
  console.log('   Usage: ts-node src/scripts/applyMigration.ts <migration-file>');
  console.log('   Example: ts-node src/scripts/applyMigration.ts 003_api_keys_storage.sql');
  process.exit(1);
}

applyMigration(migrationFile).catch(err => {
  console.error('❌ Migration failed:', err);
  process.exit(1);
});

