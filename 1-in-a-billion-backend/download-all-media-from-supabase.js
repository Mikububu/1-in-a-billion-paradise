#!/usr/bin/env node

/**
 * DOWNLOAD EVERYTHING FROM SUPABASE TO DESKTOP
 * 
 * This script downloads EVERYTHING from Supabase:
 * - All database tables (jobs, job_tasks, job_artifacts, etc.) as JSON
 * - All files from all storage buckets
 * 
 * Usage:
 *   node download-all-media-from-supabase.js
 * 
 * Requirements:
 *   - Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY environment variables
 *   - Or create a .env file in the backend directory
 */

const fs = require('fs');
const path = require('path');
const https = require('https');
const http = require('http');

// Set NODE_PATH to include backend node_modules
const backendPath = path.join(__dirname, '1-in-a-billion-backend');
process.env.NODE_PATH = (process.env.NODE_PATH || '') + 
  (process.env.NODE_PATH ? path.delimiter : '') + 
  path.join(backendPath, 'node_modules');
require('module')._initPaths();

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: path.join(backendPath, '.env') });

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('❌ Error: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set');
  console.error('   Set them as environment variables or in .env file');
  process.exit(1);
}

// Create Supabase client with service role (bypasses RLS)
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

// Get desktop path
const getDesktopPath = () => {
  const homeDir = process.env.HOME || process.env.USERPROFILE || '';
  if (process.platform === 'darwin') {
    return path.join(homeDir, 'Desktop');
  } else if (process.platform === 'win32') {
    return path.join(homeDir, 'Desktop');
  } else {
    return path.join(homeDir, 'Desktop');
  }
};

// Download file from URL
const downloadFile = async (url, filePath) => {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(filePath);
    const protocol = url.startsWith('https') ? https : http;
    
    protocol.get(url, (response) => {
      if (response.statusCode === 301 || response.statusCode === 302) {
        // Handle redirects
        return downloadFile(response.headers.location, filePath).then(resolve).catch(reject);
      }
      
      if (response.statusCode !== 200) {
        file.close();
        if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath);
        }
        reject(new Error(`Failed to download: ${response.statusCode} ${response.statusMessage}`));
        return;
      }
      
      response.pipe(file);
      file.on('finish', () => {
        file.close();
        resolve();
      });
    }).on('error', (err) => {
      file.close();
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
      reject(err);
    });
  });
};

// Get signed URL from Supabase storage
const getSignedUrl = async (bucket, filePath, expiresIn = 3600) => {
  const { data, error } = await supabase.storage
    .from(bucket)
    .createSignedUrl(filePath, expiresIn);
  
  if (error) {
    throw new Error(`Failed to create signed URL: ${error.message}`);
  }
  
  return data.signedUrl;
};

// List all files in a bucket
const listBucketFiles = async (bucket, folder = '') => {
  const { data, error } = await supabase.storage
    .from(bucket)
    .list(folder, {
      limit: 1000,
      offset: 0,
      sortBy: { column: 'name', order: 'asc' },
    });

  if (error) {
    console.warn(`⚠️  Error listing bucket ${bucket}/${folder}:`, error.message);
    return [];
  }

  const files = [];
  
  for (const item of data || []) {
    const itemPath = folder ? `${folder}/${item.name}` : item.name;
    
    if (item.id === null) {
      // It's a folder, recurse
      const subFiles = await listBucketFiles(bucket, itemPath);
      files.push(...subFiles);
    } else {
      // It's a file
      files.push(itemPath);
    }
  }
  
  return files;
};

// Export database table to JSON
const exportTable = async (tableName) => {
  console.log(`  📊 Exporting table: ${tableName}...`);
  const { data, error } = await supabase
    .from(tableName)
    .select('*');
  
  if (error) {
    console.warn(`  ⚠️  Error exporting ${tableName}:`, error.message);
    return [];
  }
  
  return data || [];
};

// Main function
const main = async () => {
  console.log('🚀 Starting complete download of EVERYTHING from Supabase...\n');

  // Create output folder on desktop
  const desktopPath = getDesktopPath();
  const outputFolder = path.join(desktopPath, `Supabase_Complete_${new Date().toISOString().split('T')[0]}`);
  
  // Create folder structure
  const dbFolder = path.join(outputFolder, 'Database');
  const storageFolder = path.join(outputFolder, 'Storage');
  
  [outputFolder, dbFolder, storageFolder].forEach(folder => {
    if (!fs.existsSync(folder)) {
      fs.mkdirSync(folder, { recursive: true });
    }
  });

  console.log(`📁 Output folder: ${outputFolder}\n`);

  // ============================================================================
  // PART 1: EXPORT ALL DATABASE TABLES
  // ============================================================================
  console.log('📊 PART 1: Exporting all database tables...\n');
  
  const tables = ['jobs', 'job_tasks', 'job_artifacts'];
  const dbExports = {};
  
  for (const table of tables) {
    try {
      const data = await exportTable(table);
      dbExports[table] = data;
      console.log(`  ✅ ${table}: ${data.length} rows`);
      
      // Save to JSON file
      const jsonPath = path.join(dbFolder, `${table}.json`);
      fs.writeFileSync(jsonPath, JSON.stringify(data, null, 2));
    } catch (error) {
      console.error(`  ❌ Error exporting ${table}:`, error.message);
    }
  }
  
  // Create database summary
  const dbSummary = `Database Export Summary

Date: ${new Date().toLocaleString()}

Tables exported:
${tables.map(t => `  - ${t}: ${dbExports[t]?.length || 0} rows`).join('\n')}

All tables exported as JSON files in this folder.
`;
  fs.writeFileSync(path.join(dbFolder, 'README.txt'), dbSummary);
  
  console.log(`\n✅ Database export complete!\n`);

  // ============================================================================
  // PART 2: DOWNLOAD ALL FILES FROM ALL STORAGE BUCKETS
  // ============================================================================
  console.log('📦 PART 2: Downloading all files from storage buckets...\n');
  
  let totalFilesDownloaded = 0;
  let totalFilesFailed = 0;
  const allErrors = [];
  
  // List all buckets
  const { data: buckets, error: bucketsError } = await supabase.storage.listBuckets();
  
  if (bucketsError) {
    console.error('❌ Error listing buckets:', bucketsError);
  } else {
    console.log(`✅ Found ${buckets.length} storage buckets\n`);
    
    for (const bucket of buckets || []) {
      console.log(`📁 Processing bucket: ${bucket.name}`);
      
      const bucketFolder = path.join(storageFolder, bucket.name);
      if (!fs.existsSync(bucketFolder)) {
        fs.mkdirSync(bucketFolder, { recursive: true });
      }
      
      // List all files in bucket
      const files = await listBucketFiles(bucket.name);
      console.log(`  Found ${files.length} files`);
      
      let bucketDownloaded = 0;
      let bucketFailed = 0;
      
      // Download each file
      for (const filePath of files) {
        try {
          const signedUrl = await getSignedUrl(bucket.name, filePath);
          
          // Create directory structure
          const fileDir = path.dirname(filePath);
          const fullDir = fileDir !== '.' ? path.join(bucketFolder, fileDir) : bucketFolder;
          if (!fs.existsSync(fullDir)) {
            fs.mkdirSync(fullDir, { recursive: true });
          }
          
          const fileName = path.basename(filePath) || `file_${Date.now()}`;
          const localPath = path.join(fullDir, fileName);
          
          await downloadFile(signedUrl, localPath);
          bucketDownloaded++;
          totalFilesDownloaded++;
          process.stdout.write('.');
        } catch (error) {
          bucketFailed++;
          totalFilesFailed++;
          allErrors.push(`${bucket.name}/${filePath}: ${error.message}`);
          process.stdout.write('F');
        }
      }
      
      console.log(`\n  ✅ ${bucket.name}: ${bucketDownloaded} downloaded, ${bucketFailed} failed\n`);
    }
    
    // Create storage summary
    const storageSummary = `Storage Download Summary

Date: ${new Date().toLocaleString()}

Buckets processed: ${buckets.length}
Total files downloaded: ${totalFilesDownloaded}
Total files failed: ${totalFilesFailed}

${allErrors.length > 0 ? `\nErrors:\n${allErrors.slice(0, 50).join('\n')}${allErrors.length > 50 ? `\n... and ${allErrors.length - 50} more errors` : ''}` : 'All files downloaded successfully!'}
`;
    fs.writeFileSync(path.join(storageFolder, 'README.txt'), storageSummary);
    
    console.log(`✅ Storage download complete!`);
    console.log(`   Downloaded: ${totalFilesDownloaded} files`);
    console.log(`   Failed: ${totalFilesFailed} files\n`);
  }

  // ============================================================================
  // FINAL SUMMARY
  // ============================================================================
  const finalSummary = `COMPLETE SUPABASE DOWNLOAD SUMMARY

Date: ${new Date().toLocaleString()}

DATABASE EXPORTS:
${tables.map(t => `  - ${t}: ${dbExports[t]?.length || 0} rows`).join('\n')}

STORAGE:
  Buckets: ${buckets?.length || 0}
  Files downloaded: ${totalFilesDownloaded || 0}
  Files failed: ${totalFilesFailed || 0}

All data saved to: ${outputFolder}

Database exports: ${dbFolder}
Storage files: ${storageFolder}
`;

  fs.writeFileSync(path.join(outputFolder, 'COMPLETE_SUMMARY.txt'), finalSummary);

  console.log('✅✅✅ COMPLETE DOWNLOAD FINISHED! ✅✅✅');
  console.log(`📁 Everything saved to: ${outputFolder}`);
  console.log(`\n📊 Database: ${tables.length} tables exported`);
  console.log(`📦 Storage: ${buckets?.length || 0} buckets processed`);
};

// Run
main().catch((error) => {
  console.error('❌ Fatal error:', error);
  process.exit(1);
});
