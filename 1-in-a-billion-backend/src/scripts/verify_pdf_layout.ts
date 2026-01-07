
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import { generateReadingPDF } from '../services/pdf/pdfGenerator';

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const OUTPUT_DIR = path.resolve(process.env.HOME || '/Users/michaelperinwogenburg', 'Desktop/pdf_verification');

async function runTest() {
    console.log('🚀 Starting PDF Typography Verification...');

    if (!fs.existsSync(OUTPUT_DIR)) {
        fs.mkdirSync(OUTPUT_DIR, { recursive: true });
    }

    const dummyText = `
  This is a test verifying that Garamond is used everywhere.
  
  Chapter 1: The Basics
  Here is some standard text followed by a hyphen - and another one.
  We want to ensure no em-dashes appear, but if they did, we want to see how Garamond handles them: — (em-dash) – (en-dash).
  
  Section 2: Typography Check
  This paragraph should be justified and set in Garamond.
  Title fonts should also be Garamond (formerly Inter).
  Dedication fonts should be Garamond (formerly Playfair).
  
  User Request Compliance:
  "Garamond everywhere."
  `;

    try {
        console.log('\n📄 Generating PDF...');
        const result = await generateReadingPDF({
            type: 'single',
            title: 'Typography Verification',
            subtitle: 'Testing Garamond Override',
            person1: {
                name: 'Michael',
                birthDate: '1968-08-23',
                sunSign: 'Virgo',
                moonSign: 'Virgo',
                risingSign: 'Sagittarius'
            },
            chapters: [{
                title: 'Garamond Verification',
                system: 'western',
                person1Reading: dummyText
            }],
            generatedAt: new Date(),
        });

        const dest = path.join(OUTPUT_DIR, 'verify_layout.pdf');
        fs.copyFileSync(result.filePath, dest);
        console.log(`✅ PDF generated: ${dest}`);

    } catch (error) {
        console.error('❌ Failed:', error);
    }
}

runTest();
