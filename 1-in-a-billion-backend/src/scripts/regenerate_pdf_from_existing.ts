
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import { swissEngine } from '../services/swissEphemeris';
import { generateReadingPDF } from '../services/pdf/pdfGenerator';

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const OUTPUT_DIR = path.resolve(process.env.HOME || '/Users/michaelperinwogenburg', 'Desktop/reading_test_michael');
const TEXT_FILE = path.join(OUTPUT_DIR, 'reading.txt');
const PDF_FILE = path.join(OUTPUT_DIR, 'reading_v3_fixed.pdf');

async function runRegeneration() {
    console.log('🚀 Regenerating PDF Only (Skipping Text Gen)...');

    if (!fs.existsSync(OUTPUT_DIR)) {
        fs.mkdirSync(OUTPUT_DIR, { recursive: true });
    }

    // 1. Recalculate Placements (Trusted Source) - Leo Moon confirmed
    const michaelPayload = {
        birthDate: '1968-08-23',
        birthTime: '13:45',
        timezone: 'Europe/Vienna',
        latitude: 46.6103,
        longitude: 13.8558,
        relationshipIntensity: 5,
        relationshipMode: 'sensual' as any,
        primaryLanguage: 'en',
        subjectName: 'Michael',
        isPartnerReading: false,
    };

    try {
        console.log('\n🔮 1. Calculating Placements via Swiss Ephemeris...');
        const placements = await swissEngine.computePlacements(michaelPayload);
        console.log(`✅ Placements: Sun=${placements.sunSign}, Moon=${placements.moonSign}, Rising=${placements.risingSign}`);

        // 2. Read Existing Text (Generated in previous step)
        console.log('\n📖 2. Reading existing text (skip generation)...');
        if (!fs.existsSync(TEXT_FILE)) {
            throw new Error('reading.txt missing. Cannot regenerate.');
        }
        const textContent = fs.readFileSync(TEXT_FILE, 'utf-8');
        console.log(`✅ Loaded ${textContent.length} chars from ${TEXT_FILE}`);

        // 3. Generate PDF (Garamond + Fixes)
        console.log('\n📄 3. Generating PDF (Garamond + Fixes)...');
        const pdfResult = await generateReadingPDF({
            type: 'single',
            title: 'Western Astrology Reading',
            subtitle: undefined,
            person1: {
                name: michaelPayload.subjectName,
                birthDate: michaelPayload.birthDate,
                sunSign: placements.sunSign,
                moonSign: placements.moonSign,
                risingSign: placements.risingSign
            },
            chapters: [{
                title: 'Western Analysis',
                system: 'western',
                person1Reading: textContent
            }],
            generatedAt: new Date(),
        });

        fs.copyFileSync(pdfResult.filePath, PDF_FILE);
        console.log(`✅ PDF Finalized: ${PDF_FILE} (${pdfResult.pageCount} pages)`);
        console.log('\n👉 Please review: reading_v3_fixed.pdf');

    } catch (error) {
        console.error('❌ Failed:', error);
    }
}

runRegeneration();
