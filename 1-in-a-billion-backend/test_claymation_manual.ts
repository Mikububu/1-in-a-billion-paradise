import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import { generateAIPortrait } from './src/services/aiPortraitService';

/**
 * Manual test script for AI portrait generation
 * Usage: ts-node test_claymation_manual.ts
 */
async function main() {
  console.log('🎨 Testing AI Portrait Pipeline\n');
  
  // Read the portrait image
  const imagePath = '/Users/michaelperinwogenburg/Desktop/working stuff/michael nice portrait.jpg';
  
  if (!fs.existsSync(imagePath)) {
    console.error(`❌ Image not found: ${imagePath}`);
    return;
  }
  
  console.log(`📸 Reading image: ${path.basename(imagePath)}`);
  const imageBuffer = fs.readFileSync(imagePath);
  const base64Image = imageBuffer.toString('base64');
  const imageSize = (imageBuffer.length / 1024).toFixed(2);
  console.log(`   Size: ${imageSize} KB\n`);
  
  // Test user ID (Michael's account)
  const userId = 'e34061de-755c-4b5e-9b0d-a6c7aa8bddc2';
  
  console.log('🚀 Sending to AI portrait service...\n');
  
  try {
    const result = await generateAIPortrait(base64Image, userId);
    
    if (result.success) {
      console.log('✅ AI Portrait Generated Successfully!\n');
      console.log('📊 Result:');
      console.log(`   Original Image URL: ${result.originalUrl || 'Not stored'}`);
      console.log(`   AI Portrait URL: ${result.imageUrl}\n`);
      console.log(`   Storage Path: ${result.storagePath || 'N/A'}`);
      console.log(`   Cost: $${result.cost?.toFixed(4) || '0'}\n`);
      
      console.log('🎉 Test complete! Check Supabase Storage:');
      console.log(`   - profile-images/${userId}/original.jpg`);
      console.log(`   - profile-images/${userId}/self/AI-generated-portrait.png`);
    } else {
      console.log('❌ AI Portrait Generation Failed\n');
      console.log(`Error: ${result.error}`);
    }
    
  } catch (error: any) {
    console.error('❌ Error:', error.message);
    if (error.response) {
      console.error('API Response:', error.response);
    }
  }
}

main().catch(console.error);
