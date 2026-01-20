/**
 * Generate PDF with existing portraits from Supabase
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
  
  // Use existing URLs from Supabase
  const michaelUrl = 'https://qdfikbgwuauertfmkmzk.supabase.co/storage/v1/object/public/profile-images/e34061de-755c-4b5e-9b0d-a6c7aa8bddc2/self/claymation.png';
  const akashaUrl = 'https://qdfikbgwuauertfmkmzk.supabase.co/storage/v1/object/public/profile-images/e34061de-755c-4b5e-9b0d-a6c7aa8bddc2/restored-akasha-1768533420531/claymation.png';
  
  // Get latest couple portrait
  const { data: coupleData } = await supabase
    .from('couple_claymations')
    .select('couple_image_url')
    .eq('user_id', michaelUserId)
    .eq('person1_id', 'self')
    .eq('person2_id', 'restored-akasha-1768533420531')
    .order('updated_at', { ascending: false })
    .limit(1)
    .single();
  
  const coupleUrl = coupleData?.couple_image_url;
  
  console.log('📸 Using portraits:');
  console.log('   Michael:', michaelUrl);
  console.log('   Akasha:', akashaUrl);
  console.log('   Couple:', coupleUrl);
  
  console.log('\n🔍 Fetching Vedic reading from database...\n');
  
  // Fetch all jobs for this user to find Akasha
  const { data: jobs } = await supabase
    .from('jobs')
    .select('*')
    .eq('user_id', michaelUserId)
    .order('created_at', { ascending: false });
  
  console.log(`📋 Found ${jobs?.length || 0} total jobs for user`);
  
  // Find job with Akasha in params
  const akashaJob = jobs?.find((j: any) => {
    const person1Name = j.params?.person1?.name || '';
    const person2Name = j.params?.person2?.name || '';
    return person1Name.toLowerCase().includes('akasha') || person2Name.toLowerCase().includes('akasha');
  });
  
  if (!akashaJob) {
    console.error('❌ Could not find Akasha job');
    return;
  }
  
  const job = akashaJob;
  console.log(`📋 Found job: ${job.id}`);
  
  // Fetch ALL tasks for this job
  const { data: tasks } = await supabase
    .from('job_tasks')
    .select('*')
    .eq('job_id', job.id);
  
  console.log(`📄 Found ${tasks?.length || 0} total tasks for job`);
  
  // Find text_generation task with system='vedic'
  const vedicTasks = tasks?.filter((t: any) => 
    t.task_type === 'text_generation' && t.output?.system === 'vedic'
  );
  
  if (!vedicTasks || vedicTasks.length === 0) {
    console.error('❌ No Vedic reading found');
    return;
  }
  
  const vedicTask = vedicTasks[0];
  console.log(`📄 Found Vedic reading task: ${vedicTask.id}`);
  
  // Get reading content
  let readingContent = '';
  
  // Check textArtifactPath first (new format)
  if (vedicTask.output?.textArtifactPath) {
    console.log(`📥 Downloading reading from storage: ${vedicTask.output.textArtifactPath}`);
    const { data: downloadData, error: downloadError } = await supabase.storage
      .from('job-artifacts')
      .download(vedicTask.output.textArtifactPath);
    
    if (downloadError || !downloadData) {
      console.error('❌ Could not download reading:', downloadError?.message);
    } else {
      readingContent = await downloadData.text();
    }
  }
  // Check result field
  else if (vedicTask.result && typeof vedicTask.result === 'string') {
    readingContent = vedicTask.result;
  }
  // Check output.content
  else if (vedicTask.output?.content && typeof vedicTask.output.content === 'string') {
    if (vedicTask.output.content.startsWith('readings/') || vedicTask.output.content.startsWith('job-')) {
      console.log(`📥 Downloading reading from storage: ${vedicTask.output.content}`);
      const { data: downloadData, error: downloadError } = await supabase.storage
        .from('job-artifacts')
        .download(vedicTask.output.content);
      
      if (downloadError || !downloadData) {
        console.error('❌ Could not download reading:', downloadError?.message);
      } else {
        readingContent = await downloadData.text();
      }
    } else {
      readingContent = vedicTask.output.content;
    }
  }
  
  console.log(`📝 Reading content: ${readingContent.length} characters`);
  
  if (!readingContent) {
    console.error('❌ No reading content found');
    console.log('Task structure:', {
      has_result: !!vedicTask.result,
      result_type: typeof vedicTask.result,
      result_length: typeof vedicTask.result === 'string' ? vedicTask.result.length : 0,
      has_output: !!vedicTask.output,
      output_content: vedicTask.output?.content?.substring(0, 100)
    });
    return;
  }
  
  // Generate PDF
  console.log(`\n📄 Generating PDF with linoleum portraits...\n`);
  
  const result = await generateChapterPDF(
    1,
    {
      title: 'Vedic Astrology (Jyotish)',
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
  
  // Move to desktop
  const desktopPdfPath = path.join(desktopPath, 'Akasha_Vedic_Reading_Linoleum.pdf');
  fs.copyFileSync(result.filePath, desktopPdfPath);
  console.log(`\n✨ Done! PDF saved to: ${desktopPdfPath}`);
  console.log(`   Pages: ${result.pageCount}`);
}

main().catch(console.error);
