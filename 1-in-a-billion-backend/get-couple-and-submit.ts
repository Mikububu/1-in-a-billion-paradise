import { config } from 'dotenv';
import { supabase } from './src/services/supabase';
config();

async function submitJobForCouple() {
  // Get Akasha & Anand from database
  const { data: people, error } = await supabase
    .from('people')
    .select('*')
    .in('name', ['Akasha', 'Anand']);

  if (error || !people || people.length !== 2) {
    console.error('❌ Could not find both people:', error);
    process.exit(1);
  }

  const akasha = people.find(p => p.name === 'Akasha')!;
  const anand = people.find(p => p.name === 'Anand')!;

  console.log(`✅ Found: ${akasha.name} & ${anand.name}`);

  const jobPayload = {
    type: 'nuclear_v2',
    person1: {
      name: akasha.name,
      birthDate: akasha.birth_date,
      birthTime: akasha.birth_time,
      birthCity: akasha.birth_city,
      birthLat: akasha.birth_lat,
      birthLon: akasha.birth_lon,
    },
    person2: {
      name: anand.name,
      birthDate: anand.birth_date,
      birthTime: anand.birth_time,
      birthCity: anand.birth_city,
      birthLat: anand.birth_lat,
      birthLon: anand.birth_lon,
    },
    systems: ['western', 'vedic', 'human_design', 'gene_keys', 'kabbalah', 'verdict'],
    voiceId: 'david',
    skipSong: true,
  };

  console.log('\n🚀 Submitting Nuclear Job...');
  const startTime = Date.now();

  const response = await fetch('https://1-in-a-billion-backend.fly.dev/api/jobs/v2/start', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(jobPayload),
  });

  const result = await response.json();

  if (!response.ok) {
    console.error('❌ Job submission failed:', result);
    process.exit(1);
  }

  console.log(`\n✅ Nuclear Job Created!`);
  console.log(`🆔 Job ID: ${result.jobId}`);
  console.log(`⏰ Started: ${new Date().toISOString()}`);
  console.log(`\n📊 Monitor: tail -f /tmp/auto-download.log`);
  
  return result.jobId;
}

submitJobForCouple().catch(console.error);
