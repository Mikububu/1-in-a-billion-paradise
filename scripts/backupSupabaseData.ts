/**
 * SUPABASE DATA BACKUP SCRIPT
 * 
 * Creates a complete backup of all critical data to local disk.
 * Run this manually or schedule with cron.
 * 
 * Usage:
 *   npx tsx scripts/backupSupabaseData.ts
 * 
 * Output:
 *   ~/Desktop/1-IN-A-BILLION-BACKUPS/BACKUP_YYYYMMDD_HHMMSS/
 *   ├── people.json              (all user profiles)
 *   ├── jobs.json                (all jobs)
 *   ├── job_tasks.json           (all tasks)
 *   ├── job_artifacts.json       (artifact metadata)
 *   ├── api_keys.json            (encrypted keys)
 *   ├── profiles.json            (auth profiles)
 *   └── backup_metadata.json     (backup info)
 */

import { supabase } from '../src/config/supabase';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

const BACKUP_ROOT = path.join(os.homedir(), 'Desktop', '1-IN-A-BILLION-BACKUPS');

async function createBackup() {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').split('T').join('_').split('.')[0];
  const backupDir = path.join(BACKUP_ROOT, `BACKUP_${timestamp}`);

  console.log(`\n🔒 Starting Supabase Data Backup...`);
  console.log(`📁 Backup directory: ${backupDir}\n`);

  // Create backup directory
  if (!fs.existsSync(BACKUP_ROOT)) {
    fs.mkdirSync(BACKUP_ROOT, { recursive: true });
  }
  fs.mkdirSync(backupDir, { recursive: true });

  const stats: any = {
    timestamp: new Date().toISOString(),
    tables: {},
  };

  // Define tables to backup
  const tables = [
    'people',
    'jobs',
    'job_tasks',
    'job_artifacts',
    'api_keys',
    'profiles',
    'library_people',
    'vedic_profiles',
    'jyotish_profiles',
  ];

  for (const table of tables) {
    try {
      console.log(`📊 Backing up table: ${table}...`);
      
      const { data, error, count } = await supabase
        .from(table)
        .select('*', { count: 'exact' });

      if (error) {
        console.error(`   ❌ Error: ${error.message}`);
        stats.tables[table] = { error: error.message };
        continue;
      }

      const filePath = path.join(backupDir, `${table}.json`);
      fs.writeFileSync(filePath, JSON.stringify(data, null, 2));

      const rowCount = count || data?.length || 0;
      console.log(`   ✅ Backed up ${rowCount} rows`);
      stats.tables[table] = { rows: rowCount, file: `${table}.json` };

    } catch (err: any) {
      console.error(`   ❌ Error: ${err.message}`);
      stats.tables[table] = { error: err.message };
    }
  }

  // Backup storage file list (metadata only, not actual files)
  console.log(`\n📦 Backing up storage file list...`);
  try {
    const { data: storageFiles, error: storageError } = await supabase.storage
      .from('job-artifacts')
      .list('', { limit: 10000 });

    if (!storageError && storageFiles) {
      const filePath = path.join(backupDir, 'storage_file_list.json');
      fs.writeFileSync(filePath, JSON.stringify(storageFiles, null, 2));
      console.log(`   ✅ Backed up ${storageFiles.length} file references`);
      stats.storageFiles = storageFiles.length;
    }
  } catch (err: any) {
    console.error(`   ❌ Error: ${err.message}`);
  }

  // Save backup metadata
  const metadataPath = path.join(backupDir, 'backup_metadata.json');
  fs.writeFileSync(metadataPath, JSON.stringify(stats, null, 2));

  // Create README
  const readmePath = path.join(backupDir, 'README.txt');
  fs.writeFileSync(readmePath, `
SUPABASE DATA BACKUP
====================

Backup Date: ${new Date().toLocaleString()}
Backup Location: ${backupDir}

Contents:
${Object.entries(stats.tables).map(([table, info]: [string, any]) => 
  `  - ${table}.json: ${info.rows || 0} rows`
).join('\n')}

To Restore:
1. Import JSON files to Supabase via SQL Editor or Dashboard
2. For storage files, use scripts/downloadCompleteMedia.ts to download actual files

Note: This backup contains database data only. 
Storage files (MP3s, PDFs) are NOT downloaded to save space.
Use downloadCompleteMedia.ts to backup storage files if needed.

Supabase Project: https://qdfikbgwuauertfmkmzk.supabase.co
`);

  console.log(`\n✅ Backup complete!`);
  console.log(`📁 Location: ${backupDir}`);
  console.log(`\n💡 To backup storage files (MP3s/PDFs), run:`);
  console.log(`   npx tsx scripts/downloadCompleteMedia.ts\n`);
}

createBackup().catch(err => {
  console.error('\n❌ Backup failed:', err);
  process.exit(1);
});
