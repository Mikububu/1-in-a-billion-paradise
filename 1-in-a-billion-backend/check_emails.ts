import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(
  process.env.SUPABASE_URL || 'https://qdfikbgwuauertfmkmzk.supabase.co',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
);

async function main() {
  // Get all self users with their auth data
  const { data: people, error } = await supabase
    .from('library_people')
    .select('*')
    .eq('is_user', true);
  
  if (error) {
    console.error('Error:', error);
    return;
  }
  
  console.log('Checking all self users and their auth emails:\n');
  
  for (const person of people || []) {
    // Get auth user email
    const { data: authUser } = await supabase.auth.admin.getUserById(person.user_id);
    
    console.log('---');
    console.log('Name:', person.name);
    console.log('Email:', authUser?.user?.email || person.email || 'N/A');
    console.log('User ID:', person.user_id);
    console.log('Birth City:', person.birth_data?.birthCity || 'N/A');
    console.log('Birth Date:', person.birth_data?.birthDate || 'N/A');
    console.log('Placements:', person.placements ? 
      `${person.placements.sunSign}/${person.placements.moonSign}/${person.placements.risingSign}` : 'N/A');
    console.log('Claymation:', person.claymation_url ? 'Yes' : 'No');
  }
}

main();
