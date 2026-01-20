/**
 * Generate 3 CORRECT PDFs: Michael solo, Akasha solo, and Couple overlay
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
  
  const job = jobs?.find((j: any) => {
    const person1Name = j.params?.person1?.name || '';
    const person2Name = j.params?.person2?.name || '';
    return person1Name.toLowerCase().includes('akasha') || person2Name.toLowerCase().includes('akasha');
  });
  
  if (!job) {
    console.error('❌ Could not find job');
    return;
  }
  
  console.log(`\n📋 Found job: ${job.id}`);
  console.log(`   Person 1: ${job.params?.person1?.name}`);
  console.log(`   Person 2: ${job.params?.person2?.name}`);
  
  // Fetch ALL vedic text generation tasks
  const { data: tasks } = await supabase
    .from('job_tasks')
    .select('*')
    .eq('job_id', job.id)
    .eq('task_type', 'text_generation');
  
  const vedicTasks = tasks?.filter((t: any) => 
    t.output?.system === 'vedic'
  );
  
  if (!vedicTasks || vedicTasks.length === 0) {
    console.error('❌ No Vedic readings found');
    return;
  }
  
  console.log(`\n📄 Found ${vedicTasks.length} Vedic text tasks`);
  
  // Identify tasks by docType
  const person1Task = vedicTasks.find((t: any) => t.output?.docType === 'person1');
  const person2Task = vedicTasks.find((t: any) => t.output?.docType === 'person2');
  const overlayTask = vedicTasks.find((t: any) => t.output?.docType === 'overlay');
  
  console.log('\nTask breakdown:');
  console.log(`   person1 (${job.params?.person1?.name}): ${person1Task ? person1Task.id : 'NOT FOUND'}`);
  console.log(`   person2 (${job.params?.person2?.name}): ${person2Task ? person2Task.id : 'NOT FOUND'}`);
  console.log(`   overlay: ${overlayTask ? overlayTask.id : 'NOT FOUND'}`);
  
  // Download reading contents
  const downloadReading = async (task: any): Promise<string> => {
    if (!task?.output?.textArtifactPath) {
      console.error('No textArtifactPath for task:', task?.id);
      return '';
    }
    
    const { data: downloadData } = await supabase.storage
      .from('job-artifacts')
      .download(task.output.textArtifactPath);
    
    if (!downloadData) return '';
    return await downloadData.text();
  };
  
  const person1Content = person1Task ? await downloadReading(person1Task) : '';
  const person2Content = person2Task ? await downloadReading(person2Task) : '';
  const overlayContent = overlayTask ? await downloadReading(overlayTask) : '';
  
  console.log('\n📝 Reading content lengths:');
  console.log(`   Person 1 (${job.params?.person1?.name}): ${person1Content.length} chars`);
  console.log(`   Person 2 (${job.params?.person2?.name}): ${person2Content.length} chars`);
  console.log(`   Overlay: ${overlayContent.length} chars`);
  
  if (!person1Content || !person2Content) {
    console.error('❌ Missing required reading content');
    return;
  }
  
  // Determine who is Michael and who is Akasha
  const person1IsMichael = job.params?.person1?.name?.toLowerCase().includes('michael');
  const michaelContent = person1IsMichael ? person1Content : person2Content;
  const akashaContent = person1IsMichael ? person2Content : person1Content;
  
  console.log('\n✅ Correctly mapped:');
  console.log(`   Michael: ${michaelContent.length} chars`);
  console.log(`   Akasha: ${akashaContent.length} chars`);
  
  // Generate 3 PDFs
  console.log('\n' + '═'.repeat(60));
  console.log('PDF 1: Michael Solo');
  console.log('═'.repeat(60));
  
  const michaelPdf = await generateChapterPDF(
    1,
    {
      title: 'Vedic Astrology (Jyotish) - Michael',
      system: 'vedic',
      person1Reading: michaelContent,
    },
    {
      name: 'Michael',
      birthDate: job.params?.person1?.birthDate || job.params?.person2?.birthDate || 'Unknown',
      portraitUrl: michaelUrl,
    }
  );
  
  const michaelPdfPath = path.join(desktopPath, 'Michael_Vedic_Reading_Linoleum.pdf');
  fs.copyFileSync(michaelPdf.filePath, michaelPdfPath);
  console.log(`✅ Saved: ${michaelPdfPath} (${michaelPdf.pageCount} pages)\n`);
  
  console.log('═'.repeat(60));
  console.log('PDF 2: Akasha Solo');
  console.log('═'.repeat(60));
  
  const akashaPdf = await generateChapterPDF(
    1,
    {
      title: 'Vedic Astrology (Jyotish) - Akasha',
      system: 'vedic',
      person1Reading: akashaContent,
    },
    {
      name: 'Akasha',
      birthDate: job.params?.person1?.birthDate || job.params?.person2?.birthDate || 'Unknown',
      portraitUrl: akashaUrl,
    }
  );
  
  const akashaPdfPath = path.join(desktopPath, 'Akasha_Vedic_Reading_Linoleum.pdf');
  fs.copyFileSync(akashaPdf.filePath, akashaPdfPath);
  console.log(`✅ Saved: ${akashaPdfPath} (${akashaPdf.pageCount} pages)\n`);
  
  console.log('═'.repeat(60));
  console.log('PDF 3: Michael & Akasha Couple (Overlay)');
  console.log('═'.repeat(60));
  
  // Use overlay if available, otherwise use person1 content as fallback
  const coupleContent = overlayContent || person1Content;
  
  const couplePdf = await generateChapterPDF(
    1,
    {
      title: 'Vedic Astrology (Jyotish) - Michael & Akasha',
      system: 'vedic',
      person1Reading: coupleContent,
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
  
  console.log('\n✨ Done! All 3 PDFs generated with CORRECT content:');
  console.log('   1. Michael_Vedic_Reading_Linoleum.pdf - Michael\'s reading');
  console.log('   2. Akasha_Vedic_Reading_Linoleum.pdf - Akasha\'s reading');
  console.log('   3. Michael_Akasha_Couple_Vedic_Reading_Linoleum.pdf - Overlay reading');
}

main().catch(console.error);
