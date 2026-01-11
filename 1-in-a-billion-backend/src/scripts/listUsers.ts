import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function listUsers() {
  // Get all people from library_people
  const { data: people, error } = await supabase
    .from('library_people')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error:', error);
    return;
  }

  console.log('\n=== All Profiles in library_people ===\n');
  console.log(`Total: ${people?.length || 0} profiles\n`);
  
  // Separate users (is_user=true) from partners
  const users = people?.filter((p: any) => p.is_user) || [];
  const partners = people?.filter((p: any) => !p.is_user) || [];
  
  console.log('--- APP USERS (signed up accounts) ---');
  users.forEach((u: any) => {
    console.log(`  ${u.name || 'No name'}`);
    console.log(`    Email: ${u.email || 'N/A'}`);
    console.log(`    User ID: ${u.user_id || 'N/A'}`);
    console.log(`    Created: ${u.created_at}`);
    console.log('');
  });
  
  console.log(`\n--- PARTNERS (${partners.length} people added by users) ---`);
  partners.slice(0, 10).forEach((p: any) => {
    console.log(`  ${p.name || 'No name'} (created: ${p.created_at?.split('T')[0]})`);
  });
  if (partners.length > 10) {
    console.log(`  ... and ${partners.length - 10} more`);
  }
}

listUsers();
