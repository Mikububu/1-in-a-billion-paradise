/**
 * Check if personal_context column exists in library_people table
 */

import { createSupabaseServiceClient } from './src/services/supabaseClient';
import { config } from 'dotenv';
import { join } from 'path';

config({ path: join(__dirname, '.env') });

const supabase = createSupabaseServiceClient();

if (!supabase) {
  console.error('❌ Supabase not configured');
  process.exit(1);
}

async function checkColumn() {
  console.log('🔍 Checking if personal_context column exists...\n');

  // Method 1: Try to query the column directly
  try {
    const { data, error } = await supabase
      .from('library_people')
      .select('personal_context')
      .limit(1);

    if (error) {
      if (error.code === 'PGRST204') {
        console.log('❌ Schema Cache Issue Detected!');
        console.log('   Error: Column not found in schema cache');
        console.log('   Code: PGRST204');
        console.log('\n💡 SOLUTION: Refresh Supabase Schema Cache');
        console.log('   1. Go to Supabase Dashboard → Settings → API');
        console.log('   2. Click "Refresh Schema Cache" button');
        console.log('   3. Wait 10-30 seconds for cache to refresh');
        console.log('   4. Try again');
        console.log('\n   OR: The column might actually not exist - check Supabase Dashboard → Table Editor');
      } else {
        console.log('❌ Error:', error.message);
        console.log('   Code:', error.code);
      }
    } else {
      console.log('✅ Column exists and is accessible!');
      console.log('   The schema cache is up to date.');
      if (data && data.length > 0) {
        console.log(`   Sample: ${data[0].personal_context ? 'Has data' : 'Empty'}`);
      }
    }
  } catch (err: any) {
    console.error('❌ Fatal error:', err.message);
  }

  // Method 2: Check via information_schema (if we can access it)
  console.log('\n🔍 Checking via information_schema...');
  try {
    const { data: columns, error: schemaError } = await supabase
      .rpc('exec_sql', {
        sql: `SELECT column_name, data_type 
              FROM information_schema.columns 
              WHERE table_name = 'library_people' 
              AND column_name = 'personal_context'`
      });

    if (schemaError) {
      console.log('   ⚠️  Cannot check via information_schema (this is normal)');
    } else {
      if (columns && columns.length > 0) {
        console.log('   ✅ Column exists in database schema');
      } else {
        console.log('   ❌ Column does NOT exist in database');
        console.log('   You need to run the migration SQL');
      }
    }
  } catch (err: any) {
    console.log('   ⚠️  Cannot check via information_schema');
  }
}

checkColumn().catch(err => {
  console.error('❌ Fatal error:', err);
  process.exit(1);
});
