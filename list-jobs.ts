import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';
config();

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function listJobs() {
  const { data: jobs } = await supabase
    .from('jobs')
    .select('id, type, status, created_at, metadata')
    .order('created_at', { ascending: false })
    .limit(10);

  console.log('\n📋 Recent 10 jobs:\n');
  jobs?.forEach((j, i) => {
    const meta = j.metadata as any;
    const names = meta?.person1?.name && meta?.person2?.name 
      ? `${meta.person1.name} & ${meta.person2.name}`
      : 'Unknown';
    console.log(`${i + 1}. ${j.id}`);
    console.log(`   Type: ${j.type}, Status: ${j.status}`);
    console.log(`   Names: ${names}`);
    console.log(`   Created: ${j.created_at}\n`);
  });
}

listJobs().catch(console.error);
