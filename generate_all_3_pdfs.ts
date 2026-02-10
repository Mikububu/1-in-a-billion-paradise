/**
 * Generate 3 PDFs: Michael solo, Akasha solo, and Couple
 */

import * as fs from 'fs';
import * as path from 'path';
import 'dotenv/config';
import { createSupabaseServiceClient } from './src/services/supabaseClient';
import { generateChapterPDF } from './src/services/pdf/pdfGenerator';

const supabase = createSupabaseServiceClient()!;

async function main() {
  const desktopPath = '/Users/michaelperinwogenburg/Desktop';
  const michaelUserId = 'e34061de-755c-4b5e-9b0d-a6c7aa8bddc2';
  
  // Portrait URLs
  const michaelUrl = 'https://qdfikbgwuauertfmkmzk.supabase.co/storage/v1/object/public/profile-images/e34061de-755c-4b5e-9b0d-a6c7aa8bddc2/self/claymation.png';
  const akashaUrl = 'https://qdfikbgwuauertfmkmzk.supabase.co/storage/v1/object/public/profile-images/e34061de-755c-4b5e-9b0d-a6c7aa8bddc2/restored-akasha-1768533420531/claymation.png';
  
  const { data: coupleData } = await supabase
    .from('couple_claymations')
    .select('couple_image_url')
    .eq('user_id', michaelUserId)
    .order('updated_at', { ascending: false })
    .limit(1)
    .single();
  
  const coupleUrl = coupleData?.couple_image_url;
  
  console.log('📸 Using portraits:');
  console.log('   Michael:', michaelUrl);
  console.log('   Akasha:', akashaUrl);
  console.log('   Couple:', coupleUrl);
  
  // Fetch job
  const { data: jobs } = await supabase
    .from('jobs')
    .select('*')
    .eq('user_id', michaelUserId)
    .order('created_at', { ascending: false });
  
  const akashaJob = jobs?.find((j: any) => {
    const person1Name = j.params?.person1?.name || '';
    const person2Name = j.params?.person2?.name || '';
    return person1Name.toLowerCase().includes('akasha') || person2Name.toLowerCase().includes('akasha');
  });
  
  if (!akashaJob) {
    console.error('❌ Could not find job');
    return;
  }
  
  const job = akashaJob;
  console.log(`\n📋 Found job: ${job.id}`);
  
  // Fetch tasks
  const { data: tasks } = await supabase
    .from('job_tasks')
    .select('*')
    .eq('job_id', job.id);
  
  const vedicTasks = tasks?.filter((t: any) => 
    t.task_type === 'text_generation' && t.output?.system === 'vedic'
  );
  
  if (!vedicTasks || vedicTasks.length === 0) {
    console.error('❌ No Vedic readings found');
    return;
  }
  
  console.log(`📄 Found ${vedicTasks.length} Vedic reading tasks\n`);
  
  // Download reading content from first task
  const vedicTask = vedicTasks[0];
  let readingContent = '';
  
  if (vedicTask.output?.textArtifactPath) {
    const { data: downloadData } = await supabase.storage
      .from('job-artifacts')
      .download(vedicTask.output.textArtifactPath);
    
    if (downloadData) {
      readingContent = await downloadData.text();
    }
  }
  
  console.log(`📝 Reading content: ${readingContent.length} characters\n`);
  
  if (!readingContent) {
    console.error('❌ No reading content found');
    return;
  }
  
  // Generate 3 PDFs
  console.log('═'.repeat(60));
  console.log('PDF 1: Michael Solo');
  console.log('═'.repeat(60) + '\n');
  
  const michaelPdf = await generateChapterPDF(
    1,
    {
      title: 'Vedic Astrology (Jyotish) - Michael',
      system: 'vedic',
      person1Reading: readingContent,
    },
    {
      name: 'Michael',
      birthDate: job.params?.person1?.birthDate || 'Unknown',
      portraitUrl: michaelUrl,
    }
  );
  
  const michaelPdfPath = path.join(desktopPath, 'Michael_Vedic_Reading_Linoleum.pdf');
  fs.copyFileSync(michaelPdf.filePath, michaelPdfPath);
  console.log(`✅ Saved: ${michaelPdfPath} (${michaelPdf.pageCount} pages)\n`);
  
  console.log('═'.repeat(60));
  console.log('PDF 2: Akasha Solo');
  console.log('═'.repeat(60) + '\n');
  
  const akashaPdf = await generateChapterPDF(
    1,
    {
      title: 'Vedic Astrology (Jyotish) - Akasha',
      system: 'vedic',
      person1Reading: readingContent,
    },
    {
      name: 'Akasha',
      birthDate: job.params?.person2?.birthDate || 'Unknown',
      portraitUrl: akashaUrl,
    }
  );
  
  const akashaPdfPath = path.join(desktopPath, 'Akasha_Vedic_Reading_Linoleum.pdf');
  fs.copyFileSync(akashaPdf.filePath, akashaPdfPath);
  console.log(`✅ Saved: ${akashaPdfPath} (${akashaPdf.pageCount} pages)\n`);
  
  console.log('═'.repeat(60));
  console.log('PDF 3: Michael & Akasha Couple');
  console.log('═'.repeat(60) + '\n');
  
  const couplePdf = await generateChapterPDF(
    1,
    {
      title: 'Vedic Astrology (Jyotish) - Michael & Akasha',
      system: 'vedic',
      person1Reading: readingContent,
    },
    {
      name: 'Michael',
      birthDate: job.params?.person1?.birthDate || 'Unknown',
      portraitUrl: michaelUrl,
    },
    {
      name: 'Akasha',
      birthDate: job.params?.person2?.birthDate || 'Unknown',
      portraitUrl: akashaUrl,
    },
    coupleUrl || undefined
  );
  
  const couplePdfPath = path.join(desktopPath, 'Michael_Akasha_Couple_Vedic_Reading_Linoleum.pdf');
  fs.copyFileSync(couplePdf.filePath, couplePdfPath);
  console.log(`✅ Saved: ${couplePdfPath} (${couplePdf.pageCount} pages)\n`);
  
  console.log('\n✨ Done! All 3 PDFs generated:');
  console.log('   1. Michael_Vedic_Reading_Linoleum.pdf');
  console.log('   2. Akasha_Vedic_Reading_Linoleum.pdf');
  console.log('   3. Michael_Akasha_Couple_Vedic_Reading_Linoleum.pdf');
}

main().catch(console.error);
