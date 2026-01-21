import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL!;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

async function applyMigration() {
  console.log('🔄 Applying migration 030: Rename claymation to portrait\n');
  console.log('⚠️  This will modify your database schema!\n');
  
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    db: { schema: 'public' },
    auth: { persistSession: false }
  });
  
  const statements = [
    {
      name: 'Rename library_people.claymation_url to portrait_url',
      sql: 'ALTER TABLE library_people RENAME COLUMN claymation_url TO portrait_url;'
    },
    {
      name: 'Rename couple_claymations table to couple_portraits',
      sql: 'ALTER TABLE couple_claymations RENAME TO couple_portraits;'
    },
    {
      name: 'Drop old index: idx_couple_claymations_user_id',
      sql: 'DROP INDEX IF EXISTS idx_couple_claymations_user_id;'
    },
    {
      name: 'Drop old index: idx_couple_claymations_persons',
      sql: 'DROP INDEX IF EXISTS idx_couple_claymations_persons;'
    },
    {
      name: 'Create new index: idx_couple_portraits_user_id',
      sql: 'CREATE INDEX IF NOT EXISTS idx_couple_portraits_user_id ON couple_portraits(user_id);'
    },
    {
      name: 'Create new index: idx_couple_portraits_persons',
      sql: 'CREATE INDEX IF NOT EXISTS idx_couple_portraits_persons ON couple_portraits(person1_id, person2_id);'
    }
  ];
  
  console.log('📋 Will execute the following statements:\n');
  statements.forEach((stmt, i) => {
    console.log(`${i + 1}. ${stmt.name}`);
  });
  
  console.log('\n🚀 Starting migration...\n');
  
  for (const stmt of statements) {
    try {
      console.log(`▶️  ${stmt.name}...`);
      
      // Use the REST API directly
      const response = await fetch(`${SUPABASE_URL}/rest/v1/rpc/exec_sql`, {
        method: 'POST',
        headers: {
          'apikey': SUPABASE_SERVICE_ROLE_KEY,
          'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
          'Content-Type': 'application/json',
          'Prefer': 'return=minimal'
        },
        body: JSON.stringify({ query: stmt.sql })
      });
      
      if (!response.ok) {
        const error = await response.text();
        // Check if it's just "already exists" error
        if (error.includes('already exists') || error.includes('does not exist')) {
          console.log(`   ⚠️  Skipped (already applied)`);
        } else {
          throw new Error(`HTTP ${response.status}: ${error}`);
        }
      } else {
        console.log(`   ✅ Success`);
      }
      
    } catch (error: any) {
      console.error(`   ❌ Error: ${error.message}`);
      
      // If it's just a "does not exist" error, continue
      if (error.message.includes('does not exist') || error.message.includes('already exists')) {
        console.log(`   ⚠️  Continuing (likely already applied)...`);
        continue;
      }
      
      console.error('\n❌ Migration failed!');
      console.error('\n📝 Please apply manually in Supabase SQL Editor:');
      console.error('   File: migrations/030_rename_claymation_to_portrait.sql\n');
      process.exit(1);
    }
  }
  
  // Verify
  console.log('\n4️⃣ Verifying changes...');
  
  try {
    // Check if portrait_url column exists
    const { data: libraryPeople } = await supabase
      .from('library_people')
      .select('portrait_url')
      .limit(1);
    
    console.log(`   ✅ library_people.portrait_url column accessible`);
    
    // Check if couple_portraits table exists  
    const { data: couplePortraits } = await supabase
      .from('couple_portraits')
      .select('id')
      .limit(1);
    
    console.log(`   ✅ couple_portraits table accessible`);
    
    console.log('\n✨ Migration 030 completed successfully!\n');
    console.log('🔄 Please restart the backend server for changes to take effect.\n');
    
  } catch (verifyError: any) {
    console.error('\n⚠️  Verification failed:', verifyError.message);
    console.error('\n📝 You may need to apply this migration manually in Supabase SQL Editor.');
    console.error('   File: migrations/030_rename_claymation_to_portrait.sql\n');
  }
}

applyMigration().catch(console.error);
