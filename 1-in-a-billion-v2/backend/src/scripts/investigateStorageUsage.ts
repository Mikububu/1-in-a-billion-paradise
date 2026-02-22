/**
 * INVESTIGATE STORAGE USAGE - DETAILED ANALYSIS
 * 
 * Detailed analysis to find what's consuming storage space.
 * 
 * Usage:
 *   npx ts-node src/scripts/investigateStorageUsage.ts
 */

import { createSupabaseServiceClient } from '../services/supabaseClient';
import { config } from 'dotenv';
import { join } from 'path';
import path from 'path';

config({ path: join(__dirname, '../../.env') });

async function investigateStorageUsage() {
  const supabase = createSupabaseServiceClient();

  if (!supabase) {
    console.error('❌ Supabase not configured');
    process.exit(1);
  }

  console.log('🔍 INVESTIGATING STORAGE USAGE');
  console.log('═══════════════════════════════════════════════════════════\n');

  try {
    // 1. Get all artifacts with sizes
    console.log('📊 1. Analyzing artifacts from database...');
    const { data: artifacts, error } = await supabase
      .from('job_artifacts')
      .select('id, job_id, artifact_type, storage_path, bucket_name, file_size_bytes, created_at')
      .not('storage_path', 'is', null);

    if (error) {
      console.error('❌ Error:', error);
      throw error;
    }

    if (!artifacts || artifacts.length === 0) {
      console.log('   No artifacts found');
      return;
    }

    console.log(`   Found ${artifacts.length} artifact(s) in database\n`);

    // Group by type
    const byType: Record<string, { count: number; totalBytes: number; items: any[] }> = {};
    for (const artifact of artifacts) {
      const type = artifact.artifact_type || 'unknown';
      const size = artifact.file_size_bytes || 0;
      
      if (!byType[type]) {
        byType[type] = { count: 0, totalBytes: 0, items: [] };
      }
      
      byType[type].count++;
      byType[type].totalBytes += size;
      byType[type].items.push(artifact);
    }

    console.log('📋 Storage usage by artifact type:');
    console.log('─────────────────────────────────────────────────────────────');
    
    let totalBytes = 0;
    const sorted = Object.entries(byType).sort((a, b) => b[1].totalBytes - a[1].totalBytes);
    
    for (const [type, stats] of sorted) {
      const totalMB = stats.totalBytes / (1024 * 1024);
      const totalGB = totalMB / 1024;
      const avgSizeMB = stats.totalBytes > 0 ? (stats.totalBytes / stats.count) / (1024 * 1024) : 0;
      totalBytes += stats.totalBytes;
      
      console.log(`${type.padEnd(20)} | ${stats.count.toString().padStart(6)} files | ${totalMB.toFixed(2).padStart(10)} MB (${totalGB.toFixed(2)} GB) | Avg: ${avgSizeMB.toFixed(2)} MB`);
      
      // Show largest files for this type
      const largest = [...stats.items]
        .sort((a, b) => (b.file_size_bytes || 0) - (a.file_size_bytes || 0))
        .slice(0, 5);
      
      if (largest.length > 0) {
        console.log(`   Top 5 largest:`);
        for (const item of largest) {
          const sizeMB = (item.file_size_bytes || 0) / (1024 * 1024);
          console.log(`     - ${path.basename(item.storage_path)}: ${sizeMB.toFixed(2)} MB (job: ${item.job_id})`);
        }
      }
      console.log('');
    }
    
    const totalMB = totalBytes / (1024 * 1024);
    const totalGB = totalMB / 1024;
    console.log('─────────────────────────────────────────────────────────────');
    console.log(`TOTAL                  | ${artifacts.length.toString().padStart(6)} files | ${totalMB.toFixed(2).padStart(10)} MB (${totalGB.toFixed(2)} GB)`);

    // 2. Check for duplicates
    console.log('\n📋 2. Checking for duplicate files...');
    const pathCounts: Record<string, number> = {};
    for (const artifact of artifacts) {
      const artifactPath = artifact.storage_path;
      pathCounts[artifactPath] = (pathCounts[artifactPath] || 0) + 1;
    }
    
    const duplicates = Object.entries(pathCounts).filter(([_path, count]) => count > 1);
    if (duplicates.length > 0) {
      console.log(`   ⚠️  Found ${duplicates.length} duplicate storage path(s):`);
      for (const [path, count] of duplicates.slice(0, 10)) {
        console.log(`     - ${path} (${count} times)`);
      }
      if (duplicates.length > 10) {
        console.log(`     ... and ${duplicates.length - 10} more`);
      }
    } else {
      console.log('   ✅ No duplicates found');
    }

    // 3. Check by job
    console.log('\n📋 3. Analyzing by job...');
    const { data: jobs, error: jobsError } = await supabase
      .from('jobs')
      .select('id, user_id, params, created_at')
      .in('id', [...new Set(artifacts.map((a: any) => a.job_id))]);

    if (!jobsError && jobs) {
      const byJob: Record<string, { count: number; totalBytes: number }> = {};
      for (const artifact of artifacts) {
        const jobId = artifact.job_id;
        if (!byJob[jobId]) {
          byJob[jobId] = { count: 0, totalBytes: 0 };
        }
        byJob[jobId].count++;
        byJob[jobId].totalBytes += artifact.file_size_bytes || 0;
      }

      const topJobs = Object.entries(byJob)
        .sort((a, b) => b[1].totalBytes - a[1].totalBytes)
        .slice(0, 10);

      console.log(`   Top 10 jobs by storage usage:`);
      for (const [jobId, stats] of topJobs) {
        const job = jobs.find((j: any) => j.id === jobId);
        const totalMB = stats.totalBytes / (1024 * 1024);
        const user = job?.user_id || 'unknown';
        console.log(`     - Job ${jobId.substring(0, 8)}... (user: ${user.substring(0, 8)}...): ${stats.count} files, ${totalMB.toFixed(2)} MB`);
      }
    }

    // 4. Check storage buckets directly
    console.log('\n📋 4. Checking storage buckets...');
    const buckets = ['job-artifacts', 'vedic-artifacts', 'library', 'voice-samples'];
    
    for (const bucketName of buckets) {
      try {
        const { data: files, error: listError } = await supabase.storage
          .from(bucketName)
          .list('', {
            limit: 1000,
            sortBy: { column: 'name', order: 'asc' }
          });

        if (listError) {
          console.log(`   ⚠️  ${bucketName}: Error listing - ${listError.message}`);
        } else {
          console.log(`   ✅ ${bucketName}: ${files?.length || 0} top-level items`);
        }
      } catch (err: any) {
        console.log(`   ⚠️  ${bucketName}: Error - ${err.message}`);
      }
    }

    console.log('\n═══════════════════════════════════════════════════════════\n');

  } catch (error: any) {
    console.error('❌ Fatal error:', error);
    process.exit(1);
  }
}

// Run the script
investigateStorageUsage().catch(err => {
  console.error('❌ Fatal error:', err);
  process.exit(1);
});
