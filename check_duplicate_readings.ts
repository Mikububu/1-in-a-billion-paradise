import 'dotenv/config';
import { createSupabaseServiceClient } from './src/services/supabaseClient';

async function main() {
  const supabase = createSupabaseServiceClient();
  if (!supabase) {
    throw new Error('Supabase not configured');
  }

  console.log('🔍 Checking for duplicate readings...\n');

  // Get all jobs
  const { data: jobs, error: jobsError } = await supabase
    .from('jobs')
    .select('id, params, created_at, status')
    .order('created_at', { ascending: false });

  if (jobsError) {
    console.error('❌ Error fetching jobs:', jobsError);
    return;
  }

  console.log(`Found ${jobs?.length || 0} total jobs\n`);

  // Group by person + system to find duplicates
  const jobGroups = new Map<string, any[]>();

  for (const job of jobs || []) {
    const params = job.params || {};
    const person1Name = params.person1?.name || 'Unknown';
    const person2Name = params.person2?.name || '';
    const systems = (params.systems || []).sort().join(',');
    const type = params.type || 'unknown';
    
    // Create a unique key for this reading
    const key = `${person1Name}::${person2Name}::${systems}::${type}`;
    
    if (!jobGroups.has(key)) {
      jobGroups.set(key, []);
    }
    jobGroups.get(key)!.push(job);
  }

  // Find duplicates
  let duplicateCount = 0;
  const duplicates: any[] = [];

  for (const [key, jobList] of jobGroups.entries()) {
    if (jobList.length > 1) {
      duplicateCount++;
      duplicates.push({ key, count: jobList.length, jobs: jobList });
    }
  }

  if (duplicateCount === 0) {
    console.log('✅ No duplicate readings found!');
  } else {
    console.log(`⚠️  Found ${duplicateCount} duplicate reading groups:\n`);
    
    for (const dup of duplicates.slice(0, 10)) { // Show first 10
      const [person1, person2, systems, type] = dup.key.split('::');
      console.log(`📚 ${person1}${person2 ? ` & ${person2}` : ''} - ${systems || 'no system'} (${type})`);
      console.log(`   ${dup.count} jobs found:`);
      
      for (const job of dup.jobs) {
        const date = new Date(job.created_at).toLocaleString();
        console.log(`   - Job ${job.id.slice(0, 8)} - ${job.status} - ${date}`);
      }
      console.log('');
    }
    
    if (duplicates.length > 10) {
      console.log(`... and ${duplicates.length - 10} more duplicate groups\n`);
    }
  }

  // Summary by person
  console.log('📊 Readings per person:');
  const personReadings = new Map<string, number>();
  
  for (const job of jobs || []) {
    const params = job.params || {};
    const person1Name = params.person1?.name || 'Unknown';
    const person2Name = params.person2?.name || '';
    const key = person2Name ? `${person1Name} & ${person2Name}` : person1Name;
    
    personReadings.set(key, (personReadings.get(key) || 0) + 1);
  }

  // Sort by count descending
  const sorted = Array.from(personReadings.entries()).sort((a, b) => b[1] - a[1]);
  
  for (const [person, count] of sorted.slice(0, 15)) {
    console.log(`   ${person}: ${count} reading${count > 1 ? 's' : ''}`);
  }
}

main().catch(console.error);
