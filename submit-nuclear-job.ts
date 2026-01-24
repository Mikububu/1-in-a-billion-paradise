import { config } from 'dotenv';
config();

async function submitNuclearJob() {
  const baseUrl = 'https://1-in-a-billion-backend.fly.dev';
  
  // Get Akasha & Anand data
  const person1 = "Akasha";
  const person2 = "Anand";
  
  const jobPayload = {
    readingType: 'nuclear',
    person1Name: person1,
    person2Name: person2,
    systems: ['western', 'vedic', 'human_design', 'gene_keys', 'kabbalah', 'verdict'],
    voiceId: 'david', // Use default voice
    skipSong: true, // Skip song generation
  };

  console.log('🚀 Submitting Nuclear Job...');
  console.log('📋 Payload:', JSON.stringify(jobPayload, null, 2));
  
  const response = await fetch(`${baseUrl}/api/jobs/v2/start`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(jobPayload),
  });

  const result = await response.json();
  
  if (!response.ok) {
    console.error('❌ Job submission failed:', result);
    process.exit(1);
  }

  console.log('✅ Nuclear Job Created!');
  console.log(`🆔 Job ID: ${result.jobId}`);
  console.log(`⏰ Created at: ${new Date().toISOString()}`);
  console.log(`\n📊 Track progress: https://1-in-a-billion-backend.fly.dev/api/jobs/${result.jobId}`);
  
  return result.jobId;
}

submitNuclearJob().catch(console.error);
