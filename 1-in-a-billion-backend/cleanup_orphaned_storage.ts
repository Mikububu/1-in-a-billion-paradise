/**
 * CLEANUP ORPHANED STORAGE
 * 
 * Deletes job folders from storage that have no corresponding database record.
 * This fixes the bug where old PDFs persist after database wipes.
 */

import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';
import { join } from 'path';

config({ path: join(__dirname, '.env') });

async function listAllFilesInFolder(
  supabase: any,
  bucketName: string,
  folderPath: string
): Promise<string[]> {
  const allFiles: string[] = [];
  
  const { data: files, error } = await supabase.storage
    .from(bucketName)
    .list(folderPath, { limit: 1000 });

  if (error || !files) return allFiles;

  for (const file of files) {
    const fullPath = `${folderPath}/${file.name}`;
    
    if (file.id === null) {
      // Folder - recurse
      const subFiles = await listAllFilesInFolder(supabase, bucketName, fullPath);
      allFiles.push(...subFiles);
    } else {
      // File
      allFiles.push(fullPath);
    }
  }

  return allFiles;
}

async function cleanup() {
  const supabase = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const userId = 'e34061de-755c-4b5e-9b0d-a6c7aa8bddc2';

  console.log('🔍 Finding orphaned job folders...\n');

  // Get job IDs from storage
  const { data: storageList } = await supabase.storage
    .from('job-artifacts')
    .list(userId, { limit: 1000 });
  
  const storageJobIds = (storageList || []).map((f: any) => f.name).filter((n: string) => n.length > 10);

  // Get job IDs from database
  const { data: dbJobs } = await supabase
    .from('jobs')
    .select('id')
    .eq('user_id', userId);
  
  const dbJobIds = (dbJobs || []).map((j: any) => j.id);

  // Find orphaned
  const orphaned = storageJobIds.filter((id: string) => !dbJobIds.includes(id));

  console.log(`📊 Summary:`);
  console.log(`   Storage folders: ${storageJobIds.length}`);
  console.log(`   Database jobs: ${dbJobIds.length}`);
  console.log(`   Orphaned (to delete): ${orphaned.length}\n`);

  if (orphaned.length === 0) {
    console.log('✅ No orphaned folders found!');
    return;
  }

  console.log(`🗑️  Deleting ${orphaned.length} orphaned job folders...\n`);

  let totalDeleted = 0;

  for (const jobId of orphaned) {
    const folderPath = `${userId}/${jobId}`;
    console.log(`   Processing: ${jobId}...`);

    // List all files in this job folder
    const files = await listAllFilesInFolder(supabase, 'job-artifacts', folderPath);
    
    if (files.length === 0) {
      console.log(`      (empty folder)`);
      continue;
    }

    console.log(`      Found ${files.length} files, deleting...`);

    // Delete in batches
    const batchSize = 100;
    for (let i = 0; i < files.length; i += batchSize) {
      const batch = files.slice(i, i + batchSize);
      const { error } = await supabase.storage.from('job-artifacts').remove(batch);
      
      if (error) {
        console.log(`      ❌ Error deleting batch: ${error.message}`);
      } else {
        totalDeleted += batch.length;
        console.log(`      ✅ Deleted ${batch.length} files`);
      }
    }
  }

  console.log(`\n✅ Cleanup complete! Deleted ${totalDeleted} files from ${orphaned.length} orphaned folders.`);
}

cleanup().catch(err => {
  console.error('❌ Error:', err);
  process.exit(1);
});
