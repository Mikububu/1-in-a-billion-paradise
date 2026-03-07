"use strict";
/**
 * TEST IMPROVED PIPELINE
 *
 * Full end-to-end test: Swiss Ephemeris → Chart Data → Portrait (Gemini Pro) →
 * Trigger + Writing (improved pipeline) → PDF with portrait embedded.
 *
 * All 4 quality fixes applied:
 *   Fix 1: Full chart data (no stripping)
 *   Fix 2: Style-specific system prompt (spicy_surreal)
 *   Fix 3: Chart-aware provocations (anchored to actual placements)
 *   Fix 4: Dead code removed
 *
 * Portrait uses Google Gemini 3 Pro Image (not Flash).
 *
 * Usage:
 *   npx tsx src/scripts/test_improved_pipeline.ts                    # Tata + western
 *   npx tsx src/scripts/test_improved_pipeline.ts --person=michael    # specific person
 *   npx tsx src/scripts/test_improved_pipeline.ts --system=vedic      # specific system
 *   npx tsx src/scripts/test_improved_pipeline.ts --person=tata --all-systems
 *   npx tsx src/scripts/test_improved_pipeline.ts --skip-portrait     # text+PDF only, no portrait
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const node_fs_1 = __importDefault(require("node:fs"));
const node_path_1 = __importDefault(require("node:path"));
const ephemerisIsolation_1 = require("../services/ephemerisIsolation");
const chartDataBuilder_1 = require("../services/chartDataBuilder");
const llm_1 = require("../services/llm");
const styles_1 = require("../prompts/styles");
const chartProvocations_1 = require("../prompts/chartProvocations");
const aiPortraitService_1 = require("../services/aiPortraitService");
const pdfGenerator_1 = require("../services/pdf/pdfGenerator");
const chartReferencePage_1 = require("../services/chartReferencePage");
const systemConfig_1 = require("../config/systemConfig");
const westernTrigger_1 = require("../promptEngine/triggerEngine/westernTrigger");
const vedicTrigger_1 = require("../promptEngine/triggerEngine/vedicTrigger");
const humanDesignTrigger_1 = require("../promptEngine/triggerEngine/humanDesignTrigger");
const geneKeysTrigger_1 = require("../promptEngine/triggerEngine/geneKeysTrigger");
const kabbalahTrigger_1 = require("../promptEngine/triggerEngine/kabbalahTrigger");
// ─── Config ─────────────────────────────────────────────────────────────────
const STYLE = 'spicy_surreal';
const SPICE_LEVEL = 7;
const TARGET_WORDS = 2000;
const MAX_TOKENS_WRITING = 16384;
const PORTRAITS_DIR = node_path_1.default.join(process.env.HOME || '', 'Desktop', 'Portraits to upload');
const OUT_DIR = node_path_1.default.join(process.env.HOME || '', 'Desktop', '1-in-a-billion-media');
const TEST_PEOPLE = {
    tata: {
        name: 'Tata',
        birthDate: '1982-06-30',
        birthTime: '15:15',
        timezone: 'America/Bogota',
        latitude: 4.7110,
        longitude: -74.0721,
        birthCity: 'Bogota, Colombia',
        portraitFile: 'Tata.jpeg',
    },
    michael: {
        name: 'Michael',
        birthDate: '1968-08-23',
        birthTime: '13:45',
        timezone: 'Europe/Vienna',
        latitude: 46.6103,
        longitude: 13.8558,
        birthCity: 'Villach, Austria',
        portraitFile: 'Michael_2.jpg',
    },
    charmaine: {
        name: 'Charmaine',
        birthDate: '1983-11-23',
        birthTime: '06:25',
        timezone: 'Asia/Hong_Kong',
        latitude: 22.3193,
        longitude: 114.1694,
        birthCity: 'Hong Kong',
    },
    iya: {
        name: 'Iya',
        birthDate: '1998-03-24',
        birthTime: '10:45',
        timezone: 'Asia/Manila',
        latitude: 7.4474,
        longitude: 125.8078,
        birthCity: 'Tagum, Philippines',
    },
    jonathan: {
        name: 'Jonathan',
        birthDate: '1987-11-08',
        birthTime: '10:44',
        timezone: 'Europe/London',
        latitude: 51.5074,
        longitude: -0.1278,
        birthCity: 'London, UK',
    },
    eva: {
        name: 'Eva',
        birthDate: '1974-07-09',
        birthTime: '04:15',
        timezone: 'Asia/Jerusalem',
        latitude: 32.0543,
        longitude: 34.7516,
        birthCity: 'Jaffa, Israel',
    },
    fabrice: {
        name: 'Fabrice',
        birthDate: '1972-04-26',
        birthTime: '08:00',
        timezone: 'Europe/Paris',
        latitude: 43.5297,
        longitude: 5.4474,
        birthCity: 'Aix-en-Provence, France',
    },
    luca: {
        name: 'Luca',
        birthDate: '1958-07-11',
        birthTime: '10:30',
        timezone: 'Europe/Rome',
        latitude: 44.4949,
        longitude: 11.3426,
        birthCity: 'Bologna, Italy',
    },
    martina: {
        name: 'Martina',
        birthDate: '1955-05-06',
        birthTime: '12:00',
        timezone: 'Europe/Stockholm',
        latitude: 60.6066,
        longitude: 15.6263,
        birthCity: 'Falun, Sweden',
    },
    anand: {
        name: 'Anand',
        birthDate: '1981-03-11',
        birthTime: '19:00',
        timezone: 'Asia/Kolkata',
        latitude: 30.3165,
        longitude: 78.0322,
        birthCity: 'Dehradun, India',
    },
    akasha: {
        name: 'Akasha',
        birthDate: '1982-10-16',
        birthTime: '06:10',
        timezone: 'Europe/Berlin',
        latitude: 48.2599,
        longitude: 11.4342,
        birthCity: 'Dachau, Germany',
    },
};
// ─── Trigger/Writing Prompt Builders per System ─────────────────────────────
function getTriggerBuilder(system) {
    switch (system) {
        case 'western': return westernTrigger_1.buildWesternTriggerPrompt;
        case 'vedic': return vedicTrigger_1.buildVedicTriggerPrompt;
        case 'human_design': return humanDesignTrigger_1.buildHDTriggerPrompt;
        case 'gene_keys': return geneKeysTrigger_1.buildGeneKeysTriggerPrompt;
        case 'kabbalah': return kabbalahTrigger_1.buildKabbalahTriggerPrompt;
        default: throw new Error(`Unknown system: ${system}`);
    }
}
function getWritingBuilder(system) {
    switch (system) {
        case 'western': return westernTrigger_1.buildWesternWritingPrompt;
        case 'vedic': return vedicTrigger_1.buildVedicWritingPrompt;
        case 'human_design': return humanDesignTrigger_1.buildHDWritingPrompt;
        case 'gene_keys': return geneKeysTrigger_1.buildGeneKeysWritingPrompt;
        case 'kabbalah': return kabbalahTrigger_1.buildKabbalahWritingPrompt;
        default: throw new Error(`Unknown system: ${system}`);
    }
}
function readImageAsBase64(filePath) {
    return node_fs_1.default.readFileSync(filePath).toString('base64');
}
function addCacheBuster(url) {
    const sep = url.includes('?') ? '&' : '?';
    return `${url}${sep}v=${Date.now()}`;
}
function extractCoverQuote(reading) {
    const raw = String(reading || '').replace(/\b(?:individual|overlay)_[a-z0-9-]+(?:_[a-z0-9-]+){2,}\b/gi, '').trim();
    if (!raw)
        return '';
    const cleaned = raw
        .split(/\r?\n/)
        .map(l => l.trim())
        .filter(Boolean)
        .filter(l => !/^[A-Z0-9][A-Z0-9\s,'".:;!?&\-]{14,}$/.test(l))
        .filter(l => !/^CHART SIGNATURE\s*:/i.test(l))
        .join(' ')
        .replace(/\s+/g, ' ')
        .trim();
    const m = cleaned.match(/^(.{30,240}?[.!?])(?:\s|$)/);
    return m?.[1]?.trim() || cleaned.slice(0, 200).trim();
}
// ─── Portrait Generation (Gemini 3 Pro) ─────────────────────────────────────
async function generatePortraitForPerson(person) {
    if (!person.portraitFile) {
        console.log(`⏭️  No portrait file for ${person.name} - skipping`);
        return null;
    }
    const portraitPath = node_path_1.default.join(PORTRAITS_DIR, person.portraitFile);
    if (!node_fs_1.default.existsSync(portraitPath)) {
        console.log(`⚠️  Portrait file not found: ${portraitPath}`);
        return null;
    }
    console.log(`🎨 Generating AI portrait for ${person.name} via Gemini 3 Pro Image...`);
    console.log(`   Source: ${portraitPath}`);
    const base64 = readImageAsBase64(portraitPath);
    const testUserId = `test-${person.name.toLowerCase()}-${Date.now()}`;
    const testPersonId = `test-person-${person.name.toLowerCase()}`;
    const result = await (0, aiPortraitService_1.generateAIPortrait)(base64, testUserId, testPersonId);
    if (!result.success || !result.imageUrl) {
        console.error(`❌ Portrait failed for ${person.name}:`, result.error);
        return null;
    }
    console.log(`✅ Portrait generated: ${result.imageUrl}`);
    return addCacheBuster(result.imageUrl);
}
// ─── Single System Reading + PDF ────────────────────────────────────────────
async function runSystemReading(person, system, placements, portraitUrl) {
    const display = (0, systemConfig_1.getSystemDisplayName)(system);
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    const fileBase = `${person.name.toLowerCase()}_${system}_${timestamp}`;
    console.log(`\n${'═'.repeat(70)}`);
    console.log(`  ${display.toUpperCase()} READING - ${person.name}`);
    console.log(`${'═'.repeat(70)}`);
    // ── Build Chart Data (FULL - no stripping) ──────────────────────────────
    console.log(`📊 Building ${system} chart data (FULL)...`);
    const p1BirthData = {
        birthDate: person.birthDate,
        birthTime: person.birthTime,
        timezone: person.timezone,
        birthPlace: person.birthCity,
    };
    const chartData = (0, chartDataBuilder_1.buildChartDataForSystem)(system, person.name, placements, null, null, p1BirthData, null);
    node_fs_1.default.writeFileSync(node_path_1.default.join(OUT_DIR, `${fileBase}_chartdata.txt`), chartData, 'utf8');
    console.log(`   ${chartData.split('\n').length} lines`);
    // ── Chart-Aware Provocations (FIX 3) ────────────────────────────────────
    console.log(`🎯 Building chart-aware provocations...`);
    const provocations = (0, chartProvocations_1.buildChartAwareProvocations)(person.name, system, chartData, SPICE_LEVEL);
    node_fs_1.default.writeFileSync(node_path_1.default.join(OUT_DIR, `${fileBase}_provocations.txt`), provocations, 'utf8');
    // ── Trigger Call (narrative seed) ───────────────────────────────────────
    console.log(`🩸 Trigger call...`);
    const triggerPrompt = getTriggerBuilder(system)({ personName: person.name, strippedChartData: chartData });
    node_fs_1.default.writeFileSync(node_path_1.default.join(OUT_DIR, `${fileBase}_trigger_prompt.txt`), triggerPrompt, 'utf8');
    const triggerRaw = await llm_1.llmPaid.generateStreaming(triggerPrompt, `test:${fileBase}:trigger`, {
        maxTokens: 300,
        temperature: 0.7,
        maxRetries: 3,
    });
    const narrativeTrigger = String(triggerRaw || '').trim();
    const triggerUsage = llm_1.llmPaid.getLastUsage();
    console.log(`   ✅ Trigger: ${narrativeTrigger.split(/\s+/).length} words`);
    if (triggerUsage)
        console.log(`   Tokens: ${triggerUsage.usage.inputTokens} in / ${triggerUsage.usage.outputTokens} out (${triggerUsage.provider})`);
    node_fs_1.default.writeFileSync(node_path_1.default.join(OUT_DIR, `${fileBase}_trigger_output.txt`), narrativeTrigger, 'utf8');
    // ── Writing Call (main reading) ─────────────────────────────────────────
    console.log(`✍️  Writing call...`);
    const baseWritingPrompt = getWritingBuilder(system)({
        personName: person.name,
        narrativeTrigger,
        strippedChartData: chartData,
        targetWords: TARGET_WORDS,
    });
    const fullWritingPrompt = `${provocations}\n\n${baseWritingPrompt}`;
    const systemPrompt = (0, styles_1.getSystemPromptForStyle)(STYLE, 'individual');
    node_fs_1.default.writeFileSync(node_path_1.default.join(OUT_DIR, `${fileBase}_writing_prompt.txt`), `[SYSTEM PROMPT]\n${systemPrompt}\n\n[USER PROMPT]\n${fullWritingPrompt}`, 'utf8');
    const readingRaw = await llm_1.llmPaid.generateStreaming(fullWritingPrompt, `test:${fileBase}:writing`, {
        maxTokens: MAX_TOKENS_WRITING,
        temperature: 0.8,
        maxRetries: 3,
        systemPrompt,
    });
    const writingUsage = llm_1.llmPaid.getLastUsage();
    const wordCount = String(readingRaw || '').split(/\s+/).filter(Boolean).length;
    console.log(`   ✅ Reading: ${wordCount} words`);
    if (writingUsage)
        console.log(`   Tokens: ${writingUsage.usage.inputTokens} in / ${writingUsage.usage.outputTokens} out (${writingUsage.provider})`);
    node_fs_1.default.writeFileSync(node_path_1.default.join(OUT_DIR, `${fileBase}_READING.txt`), readingRaw, 'utf8');
    // ── Generate PDF (with portrait embedded) ───────────────────────────────
    console.log(`📄 Generating PDF...`);
    const chartReferencePage = (0, chartReferencePage_1.buildChartReferencePage)({
        chartData,
        personName: person.name,
        birth: {
            birthDate: person.birthDate,
            birthTime: person.birthTime,
            birthPlace: person.birthCity,
        },
        generatedAt: new Date(),
        compact: true,
        system,
    });
    const coverQuote = extractCoverQuote(readingRaw);
    const pdfTitle = `${display} Reading about ${person.name}`;
    const pdf = await (0, pdfGenerator_1.generateReadingPDF)({
        type: 'single',
        title: pdfTitle,
        coverQuote,
        allowInferredHeadlines: true,
        person1: {
            name: person.name,
            birthDate: person.birthDate,
            birthTime: person.birthTime,
            birthPlace: person.birthCity,
            timezone: person.timezone,
            portraitUrl: portraitUrl || undefined,
        },
        chapters: [
            {
                title: pdfTitle,
                system,
                person1Reading: readingRaw,
            },
        ],
        chartReferencePage,
        generatedAt: new Date(),
    });
    const pdfOut = node_path_1.default.join(OUT_DIR, `${fileBase}.pdf`);
    node_fs_1.default.copyFileSync(pdf.filePath, pdfOut);
    console.log(`   ✅ PDF: ${node_path_1.default.basename(pdfOut)} (${pdf.pageCount} pages)`);
    console.log(`\n${'─'.repeat(70)}`);
    console.log(`  📖 READING: ${fileBase}_READING.txt (${wordCount} words)`);
    console.log(`  📄 PDF:     ${node_path_1.default.basename(pdfOut)}`);
    console.log(`${'─'.repeat(70)}`);
}
// ─── CLI Entry Point ────────────────────────────────────────────────────────
async function main() {
    const args = process.argv.slice(2);
    const personArg = args.find(a => a.startsWith('--person='));
    const systemArg = args.find(a => a.startsWith('--system='));
    const allSystems = args.includes('--all-systems');
    const skipPortrait = args.includes('--skip-portrait');
    const personKey = personArg
        ? personArg.replace('--person=', '').toLowerCase().trim()
        : 'tata';
    const person = TEST_PEOPLE[personKey];
    if (!person) {
        console.error(`❌ Unknown person: "${personKey}". Available: ${Object.keys(TEST_PEOPLE).join(', ')}`);
        process.exit(1);
    }
    const systems = allSystems
        ? ['western', 'vedic', 'human_design', 'gene_keys', 'kabbalah']
        : [(systemArg?.replace('--system=', '').trim() || 'western')];
    node_fs_1.default.mkdirSync(OUT_DIR, { recursive: true });
    console.log(`\n🚀 TEST IMPROVED PIPELINE`);
    console.log(`   Person:   ${person.name} (${person.birthDate}, ${person.birthTime}, ${person.birthCity})`);
    console.log(`   Systems:  ${systems.join(', ')}`);
    console.log(`   Style:    ${STYLE} | Spice: ${SPICE_LEVEL}`);
    console.log(`   Portrait: ${skipPortrait ? 'SKIPPED' : `Gemini 3 Pro Image → ${person.portraitFile || 'none'}`}`);
    console.log(`   Output:   ${OUT_DIR}\n`);
    // ── Step 1: Compute Placements (FRESH - Swiss Ephemeris) ────────────────
    console.log('🧮 Computing placements (Swiss Ephemeris - fresh)...');
    const placements = await ephemerisIsolation_1.ephemerisIsolation.computePlacements({
        birthDate: person.birthDate,
        birthTime: person.birthTime,
        timezone: person.timezone,
        latitude: person.latitude,
        longitude: person.longitude,
        relationshipIntensity: SPICE_LEVEL,
        relationshipMode: 'sensual',
        primaryLanguage: 'en',
    });
    console.log(`✅ Placements: Sun=${placements.sunSign || '?'}, Moon=${placements.moonSign || '?'}, Rising=${placements.risingSign || '?'}`);
    // ── Step 2: Generate Portrait (Gemini 3 Pro Image) ──────────────────────
    let portraitUrl = null;
    if (!skipPortrait) {
        try {
            portraitUrl = await generatePortraitForPerson(person);
        }
        catch (err) {
            console.error(`⚠️  Portrait failed (continuing without):`, err.message || err);
        }
    }
    // ── Step 3: Generate Readings + PDFs ────────────────────────────────────
    for (const system of systems) {
        try {
            await runSystemReading(person, system, placements, portraitUrl);
        }
        catch (err) {
            console.error(`\n❌ Failed for ${system}:`, err.message || err);
        }
    }
    console.log(`\n🎉 Done! All output in: ${OUT_DIR}`);
    process.exit(0);
}
main().catch((err) => {
    console.error('❌ Fatal error:', err);
    process.exit(1);
});
//# sourceMappingURL=test_improved_pipeline.js.map