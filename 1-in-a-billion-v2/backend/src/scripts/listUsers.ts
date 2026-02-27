import 'dotenv/config';
import { createSupabaseServiceClient } from '../services/supabaseClient';

async function main() {
  const serviceClient = createSupabaseServiceClient();
  const { data, error } = await serviceClient.auth.admin.listUsers();
  console.log("Users:", data?.users?.length);
  if (error) console.error(error);
}
main();
