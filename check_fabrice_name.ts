/**
 * Script to check how Fabrice's name is stored
 */

import { createSupabaseServiceClient } from './src/services/supabaseClient';
import { config } from 'dotenv';
import { join } from 'path';

config({ path: join(__dirname, '.env') });

async function checkFabriceName() {
  const supabase = createSupabaseServiceClient();

  if (!supabase) {
    console.error('❌ Supabase not configured');
    process.exit(1);
  }

  console.log('🔍 Searching for "Fabrice" in library_people...');

  try {
    // Find all people with "Fabrice" in name
    const { data: people, error: peopleError } = await supabase
      .from('library_people')
      .select('user_id, client_person_id, name, is_user, created_at, updated_at')
      .ilike('name', '%Fabrice%')
      .order('created_at', { ascending: false });

    if (peopleError) {
      console.error('❌ Error searching for people:', peopleError);
      process.exit(1);
    }

    if (!people || people.length === 0) {
      console.log('❌ No people found with "Fabrice" in name');
      process.exit(1);
    }

    console.log(`\n📋 Found ${people.length} person(s) with "Fabrice":\n`);
    people.forEach((p: any, idx: number) => {
      console.log(`${idx + 1}. Name: "${p.name}"`);
      console.log(`   user_id: ${p.user_id}`);
      console.log(`   client_person_id: ${p.client_person_id}`);
      console.log(`   is_user: ${p.is_user}`);
      console.log(`   created_at: ${p.created_at}`);
      console.log(`   updated_at: ${p.updated_at}`);
      console.log('');
    });

    // Check the schema to see if there's a separate surname field
    console.log('🔍 Checking table schema...');
    const { data: schemaData, error: schemaError } = await supabase
      .rpc('exec_sql', {
        sql_query: `
          SELECT column_name, data_type 
          FROM information_schema.columns 
          WHERE table_schema = 'public' 
            AND table_name = 'library_people'
            AND (column_name LIKE '%name%' OR column_name LIKE '%surname%' OR column_name LIKE '%last%' OR column_name LIKE '%first%')
          ORDER BY column_name;
        `
      }).catch(() => ({ data: null, error: { message: 'Cannot query schema directly' } }));

    if (!schemaError && schemaData) {
      console.log('\n📋 Name-related columns in library_people:');
      schemaData.forEach((col: any) => {
        console.log(`   - ${col.column_name} (${col.data_type})`);
      });
    } else {
      // Try a different approach - just check what fields exist by looking at the data
      console.log('\n📋 Checking available fields from data...');
      if (people.length > 0) {
        const sample = people[0];
        console.log('   Available fields:', Object.keys(sample).join(', '));
      }
    }

    // Analyze the name to see if it contains multiple parts
    const fabrice = people.find((p: any) => p.name.toLowerCase().includes('fabrice'));
    if (fabrice) {
      const nameParts = fabrice.name.trim().split(/\s+/);
      console.log(`\n📝 Name analysis for "${fabrice.name}":`);
      console.log(`   - Full name: "${fabrice.name}"`);
      console.log(`   - Parts: ${nameParts.length} (${nameParts.join(', ')})`);
      if (nameParts.length > 1) {
        console.log(`   - First name: "${nameParts[0]}"`);
        console.log(`   - Last name(s): "${nameParts.slice(1).join(' ')}"`);
      }
    }

  } catch (err: any) {
    console.error('❌ Unexpected error:', err);
    process.exit(1);
  }
}

checkFabriceName().catch(console.error);
