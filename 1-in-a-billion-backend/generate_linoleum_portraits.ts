/**
 * Generate new linoleum-style portraits for Michael and Akasha
 * from their original photos stored in Supabase
 */

import { GoogleGenAI } from '@google/genai';
import * as fs from 'fs';
import * as path from 'path';
import sharp from 'sharp';
import 'dotenv/config';
import { createSupabaseServiceClient } from './src/services/supabaseClient';

const supabase = createSupabaseServiceClient()!;

// Fetch Google API key from Supabase
async function getGoogleApiKey(): Promise<string> {
  const { data, error } = await supabase
    .from('api_keys')
    .select('token')
    .eq('service', 'google_ai_studio')
    .single();
  
  if (error || !data?.token) {
    throw new Error('Could not fetch Google AI Studio API key from Supabase');
  }
  return data.token;
}

const LINOLEUM_PROMPT = `High-contrast Linoleum analog handcrafted style. Bold black strokes on textured off-white paper. Smooth, hand-carved edges and negative space. Minimalist palette (mostly black/white with a single accent color like red). 2D graphic illustration. Isolated on white. Extreme close-up zoomed in, subject fills entire frame edge to edge, no empty margins or white space around subject.`;

async function fetchOriginalImage(userId: string, personId: string = 'self'): Promise<Buffer | null> {
  const storagePath = `${userId}/${personId}/original.jpg`;
  console.log(`📥 Fetching original image: ${storagePath}`);
  
  const { data, error } = await supabase.storage
    .from('profile-images')
    .download(storagePath);
  
  if (error || !data) {
    console.log(`⚠️ Could not fetch ${storagePath}: ${error?.message}`);
    return null;
  }
  
  const arrayBuffer = await data.arrayBuffer();
  return Buffer.from(arrayBuffer);
}

async function generateLinoleumPortrait(imageBuffer: Buffer, name: string, googleApiKey: string): Promise<Buffer | null> {
  console.log(`🎨 Generating linoleum portrait for ${name}...`);
  console.log(`   Using API key: ${googleApiKey?.slice(0, 10)}...`);
  
  const ai = new GoogleGenAI({ apiKey: googleApiKey });
  
  const base64Data = imageBuffer.toString('base64');
  
  // Build parts array (matching working aiPortraitService.ts)
  const parts: any[] = [
    {
      inlineData: {
        data: base64Data,
        mimeType: 'image/jpeg'
      }
    },
    { text: LINOLEUM_PROMPT }
  ];
  
  const response = await ai.models.generateContent({
    model: 'gemini-2.5-flash-image',
    contents: { parts },
    config: {
      imageConfig: {
        aspectRatio: "1:1"
      }
    }
  });
  
  // Extract image from response
  let generatedImageB64: string | undefined;
  if (response.candidates?.[0]?.content?.parts) {
    for (const part of response.candidates[0].content.parts) {
      if ((part as any).inlineData?.data) {
        generatedImageB64 = (part as any).inlineData.data;
        break;
      }
    }
  }
  
  if (!generatedImageB64) {
    console.error(`❌ No image generated for ${name}`);
    console.log('Response:', JSON.stringify(response, null, 2).slice(0, 500));
    return null;
  }
  
  // Post-process: auto-crop white space, then resize to square
  const rawBuffer = Buffer.from(generatedImageB64, 'base64');
  
  // First trim white/off-white background (threshold 240 to catch off-white)
  const trimmedBuffer = await sharp(rawBuffer)
    .trim({ threshold: 30 })  // Trim pixels similar to white/off-white
    .toBuffer();
  
  // Then resize to 1024x1024 square
  const processedBuffer = await sharp(trimmedBuffer)
    .resize(1024, 1024, { fit: 'cover', position: 'attention' })
    .png()
    .toBuffer();
  
  console.log(`✅ Generated linoleum portrait for ${name} (auto-cropped)`);
  return processedBuffer;
}

async function main() {
  const desktopPath = '/Users/michaelperinwogenburg/Desktop';
  
  // Get Google API key from Supabase
  console.log('🔑 Fetching Google AI Studio API key...');
  const googleApiKey = await getGoogleApiKey();
  console.log(`✅ Got API key: ${googleApiKey.slice(0, 10)}...`);
  
  // Find Michael and Akasha in library_people
  console.log('🔍 Looking for Michael and Akasha in database...');
  
  const { data: people, error } = await supabase
    .from('library_people')
    .select('user_id, client_person_id, name, is_user, original_photo_url')
    .or('name.ilike.%Michael%,name.ilike.%Akasha%');
  
  if (error) {
    console.error('❌ Database error:', error.message);
    return;
  }
  
  console.log(`📋 Found ${people?.length || 0} matching people:`);
  people?.forEach(p => {
    console.log(`   - ${p.name} (user_id: ${p.user_id}, is_user: ${p.is_user})`);
  });
  
  // Process all found people
  const targets: Array<{ name: string; userId: string; personId: string }> = [];
  
  for (const person of people || []) {
    const personId = person.is_user ? 'self' : person.client_person_id;
    // Create unique name if multiple people with same name
    const existingWithSameName = targets.filter(t => t.name === person.name).length;
    const displayName = existingWithSameName > 0 
      ? `${person.name}_${person.user_id.slice(0, 8)}`
      : person.name;
    
    targets.push({
      name: displayName,
      userId: person.user_id,
      personId
    });
  }
  
  // Generate portraits
  for (const target of targets) {
    console.log(`\n${'═'.repeat(60)}`);
    console.log(`Processing: ${target.name}`);
    console.log(`${'═'.repeat(60)}`);
    
    const originalBuffer = await fetchOriginalImage(target.userId, target.personId);
    
    if (!originalBuffer) {
      console.log(`⚠️ No original image found for ${target.name}, skipping...`);
      continue;
    }
    
    console.log(`📸 Original image size: ${originalBuffer.length} bytes`);
    
    const linoleumBuffer = await generateLinoleumPortrait(originalBuffer, target.name, googleApiKey);
    
    if (linoleumBuffer) {
      const outputPath = path.join(desktopPath, `${target.name.replace(/\s+/g, '_')}_linoleum.png`);
      fs.writeFileSync(outputPath, linoleumBuffer);
      console.log(`💾 Saved to: ${outputPath}`);
    }
  }
  
  // Generate couple portrait using the already-generated linoleum portraits
  console.log(`\n${'═'.repeat(60)}`);
  console.log(`Processing: Couple Portrait (Michael + Akasha)`);
  console.log(`${'═'.repeat(60)}`);
  
  const michaelTarget = targets.find(t => t.name.includes('Michael') && t.userId === 'e34061de-755c-4b5e-9b0d-a6c7aa8bddc2');
  const akashaTarget = targets.find(t => t.name.includes('Akasha'));
  
  if (michaelTarget && akashaTarget) {
    // Use the already-generated linoleum portraits instead of original photos
    const michaelLinoleumPath = path.join(desktopPath, 'Michael_e34061de_linoleum.png');
    const akashaLinoleumPath = path.join(desktopPath, 'Akasha_linoleum.png');
    
    if (fs.existsSync(michaelLinoleumPath) && fs.existsSync(akashaLinoleumPath)) {
      console.log(`📸 Using generated linoleum portraits as inputs`);
      const michaelLinoleum = fs.readFileSync(michaelLinoleumPath);
      const akashaLinoleum = fs.readFileSync(akashaLinoleumPath);
      
      const coupleBuffer = await generateCouplePortrait(michaelLinoleum, akashaLinoleum, 'Michael + Akasha', googleApiKey);
      
      if (coupleBuffer) {
        const outputPath = path.join(desktopPath, 'Michael_Akasha_couple_linoleum.png');
        fs.writeFileSync(outputPath, coupleBuffer);
        console.log(`💾 Saved to: ${outputPath}`);
      }
    } else {
      console.log(`⚠️ Could not find generated linoleum portraits for couple composition`);
    }
  }
  
  console.log('\n✨ Done!');
}

async function generateCouplePortrait(image1Buffer: Buffer, image2Buffer: Buffer, name: string, googleApiKey: string): Promise<Buffer | null> {
  console.log(`🎨 Generating couple linoleum portrait for ${name}...`);
  
  const ai = new GoogleGenAI({ apiKey: googleApiKey });
  
  const image1Base64 = image1Buffer.toString('base64');
  const image2Base64 = image2Buffer.toString('base64');
  
  const parts: any[] = [
    {
      inlineData: {
        data: image1Base64,
        mimeType: 'image/png'
      }
    },
    {
      inlineData: {
        data: image2Base64,
        mimeType: 'image/png'
      }
    },
    { text: `Compose these two linoleum-style portraits into a romantic couple portrait. Keep the exact same linoleum style: high-contrast bold black strokes on textured off-white paper, smooth hand-carved edges. Show them pressed close together in love, intimate composition. Preserve the facial features from both portraits exactly as shown. Extreme close-up zoomed in, subjects fill entire frame edge to edge, no empty margins or white space around subjects.` }
  ];
  
  const response = await ai.models.generateContent({
    model: 'gemini-2.5-flash-image',
    contents: { parts },
    config: {
      imageConfig: {
        aspectRatio: "1:1"
      }
    }
  });
  
  // Extract image from response
  let generatedImageB64: string | undefined;
  if (response.candidates?.[0]?.content?.parts) {
    for (const part of response.candidates[0].content.parts) {
      if ((part as any).inlineData?.data) {
        generatedImageB64 = (part as any).inlineData.data;
        break;
      }
    }
  }
  
  if (!generatedImageB64) {
    console.error(`❌ No image generated for couple portrait`);
    return null;
  }
  
  // Post-process: auto-crop white space, then resize to square
  const rawBuffer = Buffer.from(generatedImageB64, 'base64');
  
  // First trim white/off-white background (threshold 30 to catch off-white)
  const trimmedBuffer = await sharp(rawBuffer)
    .trim({ threshold: 30 })  // Trim pixels similar to white/off-white
    .toBuffer();
  
  // Then resize to 1024x1024 square
  const processedBuffer = await sharp(trimmedBuffer)
    .resize(1024, 1024, { fit: 'cover', position: 'attention' })
    .png()
    .toBuffer();
  
  console.log(`✅ Generated couple linoleum portrait (auto-cropped)`);
  return processedBuffer;
}

main().catch(console.error);
