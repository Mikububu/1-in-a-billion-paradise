import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import fetch from 'node-fetch';
dotenv.config();

const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
const userId = 'e34061de-755c-4b5e-9b0d-a6c7aa8bddc2';
const BACKEND_URL = 'https://1-in-a-billion-backend.fly.dev';

async function createAprilJobs() {
  console.log('🚀 Creating 5 reading jobs for April...\n');
  
  // Get April's data
  const { data: april } = await supabase
    .from('library_people')
    .select('*')
    .eq('user_id', userId)
    .ilike('name', '%april%')
    .single();
  
  if (!april || !april.birth_data?.birthDate) {
    console.log('❌ April not found or missing birth data');
    return;
  }
  
  const systems = [
    'western_astrology',
    'vedic_astrology', 
    'human_design',
    'gene_keys',
    'enneagram'
  ];
  
  const jobIds: string[] = [];
  
  for (let i = 0; i < 5; i++) {
    const system = systems[i];
    console.log(`\n📋 Creating job ${i + 1}/5: ${system}`);
    
    try {
      const response = await fetch(`${BACKEND_URL}/api/jobs/v2/start`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          type: 'couple_reading',
          person1: {
            name: april.name,
            birthDate: april.birth_data.birthDate,
            birthTime: april.birth_data.birthTime,
            birthCity: april.birth_data.birthCity,
            timezone: april.birth_data.timezone,
            latitude: april.birth_data.latitude,
            longitude: april.birth_data.longitude,
          },
          person2: {
            name: april.name,
            birthDate: april.birth_data.birthDate,
            birthTime: april.birth_data.birthTime,
            birthCity: april.birth_data.birthCity,
            timezone: april.birth_data.timezone,
            latitude: april.birth_data.latitude,
            longitude: april.birth_data.longitude,
          },
          readingSystem: system,
          relationshipMode: 'sensual',
          relationshipIntensity: 5,
          primaryLanguage: 'en',
          userId: userId,
        }),
      });
      
      const result: any = await response.json();
      
      if (result.success && result.jobId) {
        jobIds.push(result.jobId);
        console.log(`   ✅ Job created: ${result.jobId}`);
      } else {
        console.log(`   ❌ Failed:`, result.error || 'Unknown error');
      }
      
      // Small delay between requests
      await new Promise(resolve => setTimeout(resolve, 500));
      
    } catch (error: any) {
      console.log(`   ❌ Error:`, error.message);
    }
  }
  
  console.log(`\n\n📊 SUMMARY:`);
  console.log(`   Created: ${jobIds.length}/5 jobs`);
  console.log(`   Job IDs:`);
  jobIds.forEach((id, i) => console.log(`     ${i + 1}. ${id}`));
  
  // Save job IDs for monitoring
  return jobIds;
}

createAprilJobs().then(jobIds => {
  if (jobIds && jobIds.length > 0) {
    console.log('\n\n💾 Saving job IDs to april_jobs.json...');
    require('fs').writeFileSync(
      './april_jobs.json',
      JSON.stringify({ jobIds, timestamp: new Date().toISOString() }, null, 2)
    );
    console.log('✅ Saved!');
  }
});
