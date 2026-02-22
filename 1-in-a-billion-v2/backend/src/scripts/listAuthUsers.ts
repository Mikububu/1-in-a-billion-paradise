import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function listAuthUsers() {
  // Get all users from Supabase Auth
  const { data, error } = await supabase.auth.admin.listUsers();

  if (error) {
    console.error('Error:', error);
    return;
  }

  console.log('\n=== All Signed Up Users (Supabase Auth) ===\n');
  console.log(`Total: ${data.users?.length || 0} users\n`);
  
  data.users?.forEach((u: any) => {
    console.log(`📧 ${u.email}`);
    console.log(`   User ID: ${u.id}`);
    console.log(`   Name: ${u.user_metadata?.full_name || u.user_metadata?.name || 'N/A'}`);
    console.log(`   Provider: ${u.app_metadata?.provider || 'email'}`);
    console.log(`   Created: ${u.created_at}`);
    console.log(`   Last Sign In: ${u.last_sign_in_at || 'Never'}`);
    console.log('');
  });
}

listAuthUsers();
