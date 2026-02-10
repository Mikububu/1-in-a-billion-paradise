#!/usr/bin/env node
/**
 * Test script to upload a photo and generate claymation portrait
 * Usage: node test_claymation_upload.js <path-to-image>
 */

const fs = require('fs');
const path = require('path');
const https = require('https');

const API_URL = 'https://1-in-a-billion-backend.fly.dev/api/profile/claymation';

// Get image path from command line
const imagePath = process.argv[2];

if (!imagePath) {
  console.error('Usage: node test_claymation_upload.js <path-to-image>');
  process.exit(1);
}

if (!fs.existsSync(imagePath)) {
  console.error('Error: Image file not found:', imagePath);
  process.exit(1);
}

console.log('📸 Reading image:', imagePath);
const imageBuffer = fs.readFileSync(imagePath);
const imageBase64 = imageBuffer.toString('base64');

console.log('📦 Image size:', (imageBase64.length / 1024).toFixed(2), 'KB');
console.log('🚀 Uploading to backend...');
console.log('   URL:', API_URL);

// Parse URL
const url = new URL(API_URL);
const postData = JSON.stringify({
  photoBase64: imageBase64
});

const options = {
  hostname: url.hostname,
  port: url.port || 443,
  path: url.pathname,
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(postData),
    'X-User-Id': 'test-user-' + Date.now(),
  }
};

const req = https.request(options, (res) => {
  console.log('📡 Status:', res.statusCode);
  
  let data = '';
  res.on('data', (chunk) => {
    data += chunk;
  });
  
  res.on('end', () => {
    try {
      const result = JSON.parse(data);
      console.log('\n✅ Response:');
      console.log(JSON.stringify(result, null, 2));
      
      if (result.success && result.imageUrl) {
        console.log('\n🎨 Claymation portrait generated!');
        console.log('🔗 Claymation URL:', result.imageUrl);
        if (result.originalUrl) {
          console.log('📸 Original URL:', result.originalUrl);
        }
      } else {
        console.log('\n❌ Generation failed:', result.error);
      }
    } catch (err) {
      console.error('❌ Failed to parse response:', err.message);
      console.log('Raw response:', data);
    }
  });
});

req.on('error', (err) => {
  console.error('❌ Request failed:', err.message);
});

req.write(postData);
req.end();

console.log('⏳ Waiting for response (this may take 30-60 seconds)...');
