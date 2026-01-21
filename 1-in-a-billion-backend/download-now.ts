import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';
import * as fs from 'fs';
import * as path from 'path';
config();

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function downloadAll() {
  const { data: jobs } = await supabase.from('jobs').select('*').order('created_at', { ascending: false }).limit(1);
  const job = jobs?.[0];
  
  const meta = job?.metadata as any;
  const folderName = `${meta?.person1?.name}_${meta?.person2?.name}`;
  const outputDir = path.join(process.env.HOME!, 'Desktop', 'output', folderName);
  
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  // Get PDFs and audio
  const { data: artifacts } = await supabase
    .from('job_artifacts')
    .select('*')
    .eq('job_id', job!.id)
    .in('artifact_type', ['pdf', 'audio_mp3', 'audio_m4a']);

  console.log(`\n📥 Downloading ${artifacts?.length || 0} artifacts to: ${outputDir}\n`);

  let downloaded = 0;
  for (const artifact of artifacts || []) {
    const filename = artifact.storage_path.split('/').pop();
    const localPath = path.join(outputDir, filename);

    if (fs.existsSync(localPath)) {
      continue; // Skip if already exists
    }

    try {
      const { data, error } = await supabase.storage
        .from('job-artifacts')
        .download(artifact.storage_path);

      if (error || !data) {
        console.log(`❌ Failed: ${filename}`);
        continue;
      }

      const buffer = Buffer.from(await data.arrayBuffer());
      fs.writeFileSync(localPath, buffer);
      downloaded++;
      console.log(`✅ ${filename} (${(buffer.length / 1024).toFixed(1)} KB)`);
    } catch (err: any) {
      console.log(`❌ ${filename}: ${err.message}`);
    }
  }

  console.log(`\n✅ Downloaded ${downloaded} files!`);
  console.log(`📁 Folder: ${outputDir}`);
}

downloadAll().catch(console.error);
