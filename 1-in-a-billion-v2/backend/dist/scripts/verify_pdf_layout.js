"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const dotenv_1 = __importDefault(require("dotenv"));
const path_1 = __importDefault(require("path"));
const fs_1 = __importDefault(require("fs"));
const pdfGenerator_1 = require("../services/pdf/pdfGenerator");
dotenv_1.default.config({ path: path_1.default.resolve(__dirname, '../../.env') });
const PROJECT_ROOT = path_1.default.resolve(__dirname, '../../..');
const OUTPUT_DIR = process.env.MEDIA_OUT_DIR || path_1.default.join(PROJECT_ROOT, 'runtime', 'media');
async function runTest() {
    console.log('🚀 Starting PDF Typography Verification...');
    if (!fs_1.default.existsSync(OUTPUT_DIR)) {
        fs_1.default.mkdirSync(OUTPUT_DIR, { recursive: true });
    }
    const dummyText = `
  This is a test verifying that Garamond is used everywhere.
  
  Chapter 1: The Basics
  Here is some standard text followed by a hyphen - and another one.
  We want to ensure no em-dashes appear, but if they did, we want to see how Garamond handles them: - (em-dash) - (en-dash).
  
  Section 2: Typography Check
  This paragraph should be justified and set in Garamond.
  Title fonts should also be Garamond (formerly Inter).
  Dedication fonts should be Garamond (formerly Playfair).
  
  User Request Compliance:
  "Garamond everywhere."
  `;
    try {
        console.log('\n📄 Generating PDF...');
        const result = await (0, pdfGenerator_1.generateReadingPDF)({
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
        const dest = path_1.default.join(OUTPUT_DIR, 'verify_layout.pdf');
        fs_1.default.copyFileSync(result.filePath, dest);
        console.log(`✅ PDF generated: ${dest}`);
    }
    catch (error) {
        console.error('❌ Failed:', error);
    }
}
runTest();
//# sourceMappingURL=verify_pdf_layout.js.map