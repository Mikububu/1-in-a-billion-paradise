/**
 * Replace existing portraits with new linoleum versions in Supabase
 * and generate a PDF with the new images
 */

import * as fs from 'fs';
import * as path from 'path';
import 'dotenv/config';
import { createSupabaseServiceClient } from './src/services/supabaseClient';
import { generateChapterPDF } from './src/services/pdf/pdfGenerator';

const supabase = createSupabaseServiceClient()!;

async function uploadPortrait(localPath: string, storagePath: string): Promise<string | null> {
  console.log(`📤 Uploading ${localPath} to ${storagePath}...`);
  
  const fileBuffer = fs.readFileSync(localPath);
  
  const { error: uploadError } = await supabase.storage
    .from('profile-images')
    .upload(storagePath, fileBuffer, {
      contentType: 'image/png',
      upsert: true,
    });
  
  if (uploadError) {
    console.error(`❌ Upload error:`, uploadError.message);
    return null;
  }
  
  const { data: urlData } = supabase.storage
    .from('profile-images')
    .getPublicUrl(storagePath);
  
  console.log(`✅ Uploaded: ${urlData.publicUrl}`);
  return urlData.publicUrl;
}

async function uploadCouplePortrait(localPath: string): Promise<string | null> {
  console.log(`📤 Uploading couple portrait ${localPath}...`);
  
  const fileBuffer = fs.readFileSync(localPath);
  const fileName = `couple-self-restored-akasha-1768533420531-${Date.now()}.png`;
  
  const { error: uploadError } = await supabase.storage
    .from('couple-claymations')
    .upload(fileName, fileBuffer, {
      contentType: 'image/png',
      upsert: true,
    });
  
  if (uploadError) {
    console.error(`❌ Upload error:`, uploadError.message);
    return null;
  }
  
  const { data: urlData } = supabase.storage
    .from('couple-claymations')
    .getPublicUrl(fileName);
  
  console.log(`✅ Uploaded: ${urlData.publicUrl}`);
  return urlData.publicUrl;
}

async function main() {
  const desktopPath = '/Users/michaelperinwogenburg/Desktop';
  const michaelUserId = 'e34061de-755c-4b5e-9b0d-a6c7aa8bddc2';
  
  console.log('🚀 Step 1: Upload new linoleum portraits to Supabase\n');
  
  // Upload Michael's portrait
  const michaelUrl = await uploadPortrait(
    path.join(desktopPath, 'Michael_e34061de_linoleum.png'),
    `${michaelUserId}/self/claymation.png`
  );
  
  // Upload Akasha's portrait
  const akashaUrl = await uploadPortrait(
    path.join(desktopPath, 'Akasha_linoleum.png'),
    `${michaelUserId}/restored-akasha-1768533420531/claymation.png`
  );
  
  // Upload couple portrait
  const coupleUrl = await uploadCouplePortrait(
    path.join(desktopPath, 'Michael_Akasha_couple_linoleum.png')
  );
  
  if (!michaelUrl || !akashaUrl) {
    console.error('❌ Failed to upload portraits');
    return;
  }
  
  console.log('\n✅ All portraits uploaded successfully!\n');
  
  // Update database records
  console.log('📝 Step 2: Update database records\n');
  
  // Update Michael's record
  const { error: michaelError } = await supabase
    .from('library_people')
    .update({ claymation_url: michaelUrl, updated_at: new Date().toISOString() })
    .eq('user_id', michaelUserId)
    .eq('is_user', true);
  
  if (michaelError) {
    console.error('⚠️ Could not update Michael record:', michaelError.message);
  } else {
    console.log('✅ Updated Michael record');
  }
  
  // Update Akasha's record
  const { error: akashaError } = await supabase
    .from('library_people')
    .update({ claymation_url: akashaUrl, updated_at: new Date().toISOString() })
    .eq('user_id', michaelUserId)
    .eq('client_person_id', 'restored-akasha-1768533420531');
  
  if (akashaError) {
    console.error('⚠️ Could not update Akasha record:', akashaError.message);
  } else {
    console.log('✅ Updated Akasha record');
  }
  
  // Update couple_claymations table if it exists
  if (coupleUrl) {
    const { error: coupleError } = await supabase
      .from('couple_claymations')
      .upsert({
        user_id: michaelUserId,
        person1_id: 'self',
        person2_id: 'restored-akasha-1768533420531',
        couple_image_url: coupleUrl,
        updated_at: new Date().toISOString()
      }, {
        onConflict: 'user_id,person1_id,person2_id'
      });
    
    if (coupleError) {
      console.error('⚠️ Could not update couple record:', coupleError.message);
    } else {
      console.log('✅ Updated couple record');
    }
  }
  
  console.log('\n🎨 Step 3: Generate PDF with new portraits\n');
  
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
    console.log('Available jobs:', jobs?.map((j: any) => ({
      id: j.id,
      person1: j.params?.person1?.name,
      person2: j.params?.person2?.name
    })));
    return;
  }
  
  const job = akashaJob;
  console.log(`📋 Found job: ${job.id}`);
  
  // Fetch ALL tasks for this job to see what's there
  const { data: tasks } = await supabase
    .from('job_tasks')
    .select('*')
    .eq('job_id', job.id);
  
  console.log(`📄 Found ${tasks?.length || 0} total tasks for job`);
  
  // Find text_generation task with system='vedic' (most recent one)
  const vedicTasks = tasks?.filter((t: any) => 
    t.task_type === 'text_generation' && t.output?.system === 'vedic'
  );
  
  if (!vedicTasks || vedicTasks.length === 0) {
    console.error('❌ No Vedic reading found');
    return;
  }
  
  // Use the most recent one (first in array since we ordered by created_at desc in jobs query)
  const vedicTask = vedicTasks[0];
  console.log(`📄 Found Vedic reading task: ${vedicTask.id}`);
  
  // Get reading content - check multiple possible locations
  let readingContent = '';
  
  // First check if content is directly in output
  if (vedicTask.output?.content && typeof vedicTask.output.content === 'string') {
    if (vedicTask.output.content.startsWith('readings/') || vedicTask.output.content.startsWith('job-')) {
      // It's a storage path
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
      // Direct content
      readingContent = vedicTask.output.content;
    }
  }
  
  // If still empty, check result field
  if (!readingContent && vedicTask.result) {
    readingContent = vedicTask.result;
  }
  
  // If still empty, list what we have
  if (!readingContent) {
    console.log('⚠️ Task output structure:', JSON.stringify(vedicTask.output, null, 2));
    console.log('⚠️ Task result:', typeof vedicTask.result);
  }
  
  console.log(`📝 Reading content: ${readingContent.length} characters`);
  
  // Generate PDF using generateChapterPDF
  console.log(`\n📄 Generating PDF with new linoleum portraits...`);
  
  const result = await generateChapterPDF(
    1, // chapter number
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
}

main().catch(console.error);
