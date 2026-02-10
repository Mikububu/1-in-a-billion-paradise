import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';
config();

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function createNuclearJob() {
  // Get people
  const { data: people } = await supabase
    .from('people')
    .select('*')
    .in('name', ['Akasha', 'Anand']);

  if (!people || people.length < 2) {
    console.error('❌ Could not find both people');
    process.exit(1);
  }

  const person1 = people.find((p: any) => p.name === 'Akasha');
  const person2 = people.find((p: any) => p.name === 'Anand');

  console.log(`✅ Found: ${person1.name} & ${person2.name}`);
  
  // Submit via API
  const payload = {
    type: 'nuclear_v2',
    person1: {
      name: person1.name,
      birthDate: person1.birth_date,
      birthTime: person1.birth_time,
      birthCity: person1.birth_city,
      birthLat: person1.birth_lat,
      birthLon: person1.birth_lon,
    },
    person2: {
      name: person2.name,
      birthDate: person2.birth_date,
      birthTime: person2.birth_time,
      birthCity: person2.birth_city,
      birthLat: person2.birth_lat,
      birthLon: person2.birth_lon,
    },
    systems: ['western', 'vedic', 'human_design', 'gene_keys', 'kabbalah', 'verdict'],
    voiceId: 'david',
    skipSong: true,
  };

  console.log('\n🚀 Creating Nuclear Job via API...');
  const startTime = Date.now();
  
  const response = await fetch('https://1-in-a-billion-backend.fly.dev/api/jobs/v2/start', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  const result = await response.json();

  if (!response.ok) {
    console.error('❌ Failed:', JSON.stringify(result, null, 2));
    process.exit(1);
  }

  console.log(`\n✅ Job Created!`);
  console.log(`🆔 Job ID: ${result.jobId}`);
  console.log(`⏱️  Start Time: ${new Date().toISOString()}`);
  console.log(`📁 Output: ~/Desktop/output/Akasha_Anand/`);
  console.log(`\n📊 Monitor: tail -f /tmp/auto-download.log`);
}

createNuclearJob().catch(console.error);
