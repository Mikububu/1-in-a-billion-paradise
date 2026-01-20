/**
 * Find PDF by text content
 * Searches for the PDF containing specific text
 */

import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';
import { join } from 'path';
import * as fs from 'fs';
import * as https from 'https';

config({ path: join(__dirname, '.env') });

const LOG_PATH = '/Users/michaelperinwogenburg/Desktop/big challenge/1 in a Billion/.cursor/debug.log';

function log(data: any) {
  const line = JSON.stringify({ ...data, timestamp: Date.now(), sessionId: 'debug-session' }) + '\n';
  fs.appendFileSync(LOG_PATH, line);
  console.log(JSON.stringify(data, null, 2));
}

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

async function downloadFile(url: string): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    https.get(url, (response) => {
      const chunks: Buffer[] = [];
      response.on('data', (chunk) => chunks.push(chunk));
      response.on('end', () => resolve(Buffer.concat(chunks)));
      response.on('error', reject);
    });
  });
}

async function findPDF() {
  const supabase = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const userId = 'e34061de-755c-4b5e-9b0d-a6c7aa8bddc2';

  // #region agent log
  log({ location: 'find_pdf_by_text.ts:71', message: 'Starting PDF search', data: { userId }, hypothesisId: 'H1' });
  // #endregion

  console.log('🔍 Finding all PDFs in storage...\n');

  // Get the current job ID from database
  const { data: jobs } = await supabase
    .from('jobs')
    .select('id')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(1);

  if (!jobs || jobs.length === 0) {
    console.log('❌ No jobs found');
    return;
  }

  const jobId = jobs[0].id;
  console.log(`📋 Current job ID: ${jobId}\n`);

  // #region agent log
  log({ location: 'find_pdf_by_text.ts:92', message: 'Found current job', data: { jobId }, hypothesisId: 'H1' });
  // #endregion

  // List all files in this job's PDF folder
  const pdfFolder = `${userId}/${jobId}/pdf`;
  const allFiles = await listAllFilesInFolder(supabase, 'job-artifacts', pdfFolder);

  const pdfFiles = allFiles.filter(f => f.endsWith('.pdf'));
  
  console.log(`📊 Found ${pdfFiles.length} PDF files\n`);

  // #region agent log
  log({ location: 'find_pdf_by_text.ts:105', message: 'PDF files found', data: { count: pdfFiles.length, files: pdfFiles }, hypothesisId: 'H1,H2' });
  // #endregion

  // Search text
  const searchText = "Akasha's story begins not with a birth, but with a doorway";

  console.log(`🔎 Searching for: "${searchText}"\n`);

  for (const pdfPath of pdfFiles) {
    console.log(`   Checking: ${pdfPath.split('/').pop()}...`);

    // Get public URL
    const { data: urlData } = supabase.storage
      .from('job-artifacts')
      .getPublicUrl(pdfPath);

    if (!urlData?.publicUrl) {
      console.log('      ⚠️  Could not get URL');
      continue;
    }

    // #region agent log
    log({ location: 'find_pdf_by_text.ts:126', message: 'Checking PDF', data: { pdfPath, url: urlData.publicUrl }, hypothesisId: 'H2' });
    // #endregion

    // For now, just list the PDFs - we'll need pdf-parse to extract text
    // But we can check the filename for clues
    const filename = pdfPath.split('/').pop() || '';
    
    if (filename.includes('Akasha') || filename.includes('akasha')) {
      console.log(`      ✅ FOUND: This looks like Akasha's PDF!`);
      console.log(`      📄 File: ${filename}`);
      console.log(`      🔗 Path: ${pdfPath}`);
      
      // #region agent log
      log({ location: 'find_pdf_by_text.ts:141', message: 'Found Akasha PDF', data: { filename, pdfPath, url: urlData.publicUrl }, hypothesisId: 'H3' });
      // #endregion
    }
  }

  console.log('\n✅ Search complete');
}

findPDF().catch(err => {
  console.error('❌ Error:', err);
  process.exit(1);
});
