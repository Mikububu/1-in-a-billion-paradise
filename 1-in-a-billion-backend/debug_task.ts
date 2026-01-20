import 'dotenv/config';
import { createSupabaseServiceClient } from './src/services/supabaseClient';

const supabase = createSupabaseServiceClient()!;

async function main() {
  const { data: task } = await supabase
    .from('job_tasks')
    .select('*')
    .eq('id', '2cf81ad4-6618-440e-8a4e-329d01d0c7ce')
    .single();
  
  console.log('Full task:', JSON.stringify(task, null, 2));
}

main();
