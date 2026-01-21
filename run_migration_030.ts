import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL!;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

async function runMigration() {
  console.log('🔄 Running migration 030: Rename claymation to portrait\n');
  
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
  
  // Test 1: Check if claymation_url exists (old column)
  console.log('1️⃣ Checking current schema...');
  try {
    const { data: oldData, error: oldError } = await supabase
      .from('library_people')
      .select('claymation_url')
      .limit(1);
    
    if (!oldError) {
      console.log('   ✅ claymation_url column EXISTS (migration needed)');
      
      // Execute migration via SQL
      console.log('\n2️⃣ Executing migration SQL...');
      console.log('   ⚠️  Note: Schema changes must be done via Supabase Dashboard');
      console.log('\n   Please run the following SQL in Supabase SQL Editor:');
      console.log('   https://supabase.com/dashboard/project/qdfikbgwuauertfmkmzk/sql/new\n');
      console.log('```sql');
      console.log('ALTER TABLE library_people RENAME COLUMN claymation_url TO portrait_url;');
      console.log('ALTER TABLE couple_claymations RENAME TO couple_portraits;');
      console.log('DROP INDEX IF EXISTS idx_couple_claymations_user_id;');
      console.log('DROP INDEX IF EXISTS idx_couple_claymations_persons;');
      console.log('CREATE INDEX IF NOT EXISTS idx_couple_portraits_user_id ON couple_portraits(user_id);');
      console.log('CREATE INDEX IF NOT EXISTS idx_couple_portraits_persons ON couple_portraits(person1_id, person2_id);');
      console.log('```\n');
    }
  } catch (err) {
    console.log('   ℹ️  claymation_url column not found, checking portrait_url...');
  }
  
  // Test 2: Check if portrait_url exists (new column)
  try {
    const { data: newData, error: newError } = await supabase
      .from('library_people')
      .select('portrait_url')
      .limit(1);
    
    if (!newError) {
      console.log('   ✅ portrait_url column EXISTS (migration already applied!)');
      
      // Check couple_portraits table
      const { data: coupleData, error: coupleError } = await supabase
        .from('couple_portraits')
        .select('id')
        .limit(1);
      
      if (!coupleError) {
        console.log('   ✅ couple_portraits table EXISTS');
        console.log('\n✨ Migration already applied successfully!\n');
      } else {
        console.log('   ⚠️  couple_portraits table not found');
        console.log('\n   Please rename couple_claymations → couple_portraits manually\n');
      }
    }
  } catch (err: any) {
    if (err.message.includes('relation') && err.message.includes('does not exist')) {
      console.log('   ❌ Neither old nor new schema found');
    }
  }
}

runMigration().catch(console.error);
