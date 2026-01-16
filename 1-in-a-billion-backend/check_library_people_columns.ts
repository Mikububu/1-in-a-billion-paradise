import 'dotenv/config';
import { createSupabaseServiceClient } from './src/services/supabaseClient';

async function main() {
  const supabase = createSupabaseServiceClient();
  if (!supabase) {
    throw new Error('Supabase not configured');
  }

  console.log('📊 Checking library_people table structure...\n');

  // Get one record to see columns
  const { data, error } = await supabase
    .from('library_people')
    .select('*')
    .eq('user_id', 'e34061de-755c-4b5e-9b0d-a6c7aa8bddc2')
    .eq('is_user', true)
    .single();

  if (error) {
    console.error('❌ Query failed:', error);
    return;
  }

  console.log('Current columns:');
  console.log(Object.keys(data || {}).join(', '));
  console.log('\n📋 Missing columns need to be added:\n');
  
  const hasClayUrl = data && 'claymation_url' in data;
  const hasOrigUrl = data && 'original_photo_url' in data;
  
  if (!hasClayUrl) console.log('❌ claymation_url - MISSING');
  else console.log('✅ claymation_url - EXISTS');
  
  if (!hasOrigUrl) console.log('❌ original_photo_url - MISSING');
  else console.log('✅ original_photo_url - EXISTS');
  
  if (!hasClayUrl || !hasOrigUrl) {
    console.log('\n🔧 Run this SQL in Supabase SQL Editor:');
    console.log('\nALTER TABLE library_people ADD COLUMN IF NOT EXISTS claymation_url TEXT;');
    console.log('ALTER TABLE library_people ADD COLUMN IF NOT EXISTS original_photo_url TEXT;');
  } else {
    console.log('\n✅ All columns exist!');
  }
}

main().catch(console.error);
