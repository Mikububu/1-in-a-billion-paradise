"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const dotenv_1 = __importDefault(require("dotenv"));
const path_1 = __importDefault(require("path"));
const fs_1 = __importDefault(require("fs"));
const swissEphemeris_1 = require("../services/swissEphemeris");
const pdfGenerator_1 = require("../services/pdf/pdfGenerator");
dotenv_1.default.config({ path: path_1.default.resolve(__dirname, '../../.env') });
const PROJECT_ROOT = path_1.default.resolve(__dirname, '../../..');
const OUTPUT_DIR = process.env.MEDIA_OUT_DIR || path_1.default.join(PROJECT_ROOT, 'runtime', 'media');
const TEXT_FILE = path_1.default.join(OUTPUT_DIR, 'reading.txt');
const PDF_FILE = path_1.default.join(OUTPUT_DIR, 'reading_v3_fixed.pdf');
async function runRegeneration() {
    console.log('🚀 Regenerating PDF Only (Skipping Text Gen)...');
    if (!fs_1.default.existsSync(OUTPUT_DIR)) {
        fs_1.default.mkdirSync(OUTPUT_DIR, { recursive: true });
    }
    // 1. Recalculate Placements (Trusted Source) - Leo Moon confirmed
    const michaelPayload = {
        birthDate: '1968-08-23',
        birthTime: '13:45',
        timezone: 'Europe/Vienna',
        latitude: 46.6103,
        longitude: 13.8558,
        relationshipIntensity: 5,
        relationshipMode: 'sensual',
        primaryLanguage: 'en',
        subjectName: 'Michael',
        isPartnerReading: false,
    };
    try {
        console.log('\n🔮 1. Calculating Placements via Swiss Ephemeris...');
        const placements = await swissEphemeris_1.swissEngine.computePlacements(michaelPayload);
        console.log(`✅ Placements: Sun=${placements.sunSign}, Moon=${placements.moonSign}, Rising=${placements.risingSign}`);
        // 2. Read Existing Text (Generated in previous step)
        console.log('\n📖 2. Reading existing text (skip generation)...');
        if (!fs_1.default.existsSync(TEXT_FILE)) {
            throw new Error('reading.txt missing. Cannot regenerate.');
        }
        const textContent = fs_1.default.readFileSync(TEXT_FILE, 'utf-8');
        console.log(`✅ Loaded ${textContent.length} chars from ${TEXT_FILE}`);
        // 3. Generate PDF (Garamond + Fixes)
        console.log('\n📄 3. Generating PDF (Garamond + Fixes)...');
        const pdfResult = await (0, pdfGenerator_1.generateReadingPDF)({
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
        fs_1.default.copyFileSync(pdfResult.filePath, PDF_FILE);
        console.log(`✅ PDF Finalized: ${PDF_FILE} (${pdfResult.pageCount} pages)`);
        console.log('\n👉 Please review: reading_v3_fixed.pdf');
    }
    catch (error) {
        console.error('❌ Failed:', error);
    }
}
runRegeneration();
//# sourceMappingURL=regenerate_pdf_from_existing.js.map