"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const node_fs_1 = __importDefault(require("node:fs"));
const node_path_1 = __importDefault(require("node:path"));
const ephemerisIsolation_1 = require("../services/ephemerisIsolation");
const chartDataBuilder_1 = require("../services/chartDataBuilder");
const pdfGenerator_1 = require("../services/pdf/pdfGenerator");
const systemConfig_1 = require("../config/systemConfig");
const wordCounts_1 = require("../prompts/config/wordCounts");
const aiPortraitService_1 = require("../services/aiPortraitService");
const chartReferencePage_1 = require("../services/chartReferencePage");
const generateReading_1 = require("./shared/generateReading");
function tsTag() {
    return new Date().toISOString().replace(/[:.]/g, '-');
}
function readImageAsBase64(filePath) {
    const imageBuffer = node_fs_1.default.readFileSync(filePath);
    return imageBuffer.toString('base64');
}
function addCacheBuster(url) {
    const separator = url.includes('?') ? '&' : '?';
    return `${url}${separator}v=${Date.now()}`;
}
function envNumber(name, fallback) {
    const raw = process.env[name];
    if (!raw)
        return fallback;
    const parsed = Number(raw);
    return Number.isFinite(parsed) ? parsed : fallback;
}
function resolvePortraitPath(portraitsDir) {
    const explicit = (process.env.PERSON1_PORTRAIT_PATH || process.env.PERSON1_PORTRAIT_FILE || '').trim();
    if (!explicit)
        return node_path_1.default.join(portraitsDir, 'Michael_2.jpg');
    if (node_path_1.default.isAbsolute(explicit))
        return explicit;
    return node_path_1.default.join(portraitsDir, explicit);
}
function extractCoverQuote(reading) {
    const raw = String(reading || '')
        .replace(/\b(?:individual|overlay)_[a-z0-9-]+(?:_[a-z0-9-]+){2,}\b/gi, '')
        .trim();
    if (!raw)
        return '';
    const cleanedLines = raw
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter((line) => Boolean(line))
        .map((line) => line.replace(/^(?:[---]{2,}\s*)?[IVXLC]+\.\s*/i, '').trim())
        .filter((line) => !/^(?:[---]{2,}\s*)?[IVXLC]+\.\s+/i.test(line))
        .filter((line) => !/^[A-Z0-9][A-Z0-9\s,'".:;!?&\-]{14,}$/.test(line))
        .filter((line) => !/^CHART SIGNATURE\s*:/i.test(line))
        .join(' ')
        .replace(/\s+/g, ' ')
        .trim();
    const cleaned = cleanedLines || raw.replace(/\s+/g, ' ').trim();
    const m = cleaned.match(/^(.{30,240}?[.!?])(?:\s|$)/);
    if (m?.[1])
        return m[1].trim();
    return cleaned.slice(0, 200).trim();
}
function resolveDefaultMediaOutDir(projectRoot) {
    if (process.env.MEDIA_OUT_DIR?.trim())
        return process.env.MEDIA_OUT_DIR.trim();
    const desktop = process.env.HOME ? node_path_1.default.join(process.env.HOME, 'Desktop') : '';
    if (desktop && node_fs_1.default.existsSync(desktop)) {
        return node_path_1.default.join(desktop, '1-in-a-billion-media');
    }
    return node_path_1.default.join(projectRoot, 'runtime', 'media');
}
function resolvePortraitsDir(projectRoot) {
    if (process.env.PORTRAITS_DIR?.trim())
        return process.env.PORTRAITS_DIR.trim();
    const desktop = process.env.HOME ? node_path_1.default.join(process.env.HOME, 'Desktop') : '';
    const desktopPortraits = desktop ? node_path_1.default.join(desktop, 'Portraits to upload') : '';
    if (desktopPortraits && node_fs_1.default.existsSync(desktopPortraits)) {
        return desktopPortraits;
    }
    return node_path_1.default.join(projectRoot, 'runtime', 'portraits-to-upload');
}
function logRunConfig(params) {
    console.log('⚙️  Individual run config:');
    console.log(`   - systems: ${params.systemsToRun.join(', ')}`);
    console.log(`   - styleLayer: ${params.styleLayerId || '(default from registry)'}`);
    console.log(`   - outputDir: ${params.outDir}`);
    console.log(`   - portraitsDir: ${params.portraitsDir}`);
    console.log(`   - CLAUDE_MODEL: ${process.env.CLAUDE_MODEL || '(env default)'}`);
    console.log(`   - CLAUDE_FALLBACK_MODEL: ${process.env.CLAUDE_FALLBACK_MODEL || '(none)'}`);
}
async function main() {
    const projectRoot = node_path_1.default.resolve(__dirname, '../../..');
    const outDir = resolveDefaultMediaOutDir(projectRoot);
    const portraitsDir = resolvePortraitsDir(projectRoot);
    node_fs_1.default.mkdirSync(outDir, { recursive: true });
    const argStyleLayer = process.argv.find((arg) => arg.startsWith('--styleLayer='));
    const styleLayerId = argStyleLayer
        ? argStyleLayer.replace('--styleLayer=', '').trim()
        : 'writing-style-guide-incarnation-v1';
    const styleToken = (0, generateReading_1.safeFileToken)(styleLayerId);
    const argPersonalContext = process.argv.find((arg) => arg.startsWith('--personalContext=') || arg.startsWith('--context='));
    const argPersonalContextFile = process.argv.find((arg) => arg.startsWith('--personalContextFile=') || arg.startsWith('--contextFile='));
    const resolvedContextRaw = argPersonalContext
        ? argPersonalContext.split('=').slice(1).join('=')
        : argPersonalContextFile
            ? node_fs_1.default.readFileSync(argPersonalContextFile.split('=').slice(1).join('='), 'utf8')
            : '';
    const resolvedPersonalContext = resolvedContextRaw.trim().length > 0 ? resolvedContextRaw.trim() : undefined;
    const person1 = {
        name: (process.env.PERSON1_NAME || 'Michael').trim(),
        birthDate: (process.env.PERSON1_BIRTH_DATE || '1968-08-23').trim(),
        birthTime: (process.env.PERSON1_BIRTH_TIME || '13:45').trim(),
        timezone: (process.env.PERSON1_TIMEZONE || 'Europe/Vienna').trim(),
        latitude: envNumber('PERSON1_LATITUDE', 46.6103),
        longitude: envNumber('PERSON1_LONGITUDE', 13.8558),
        birthPlace: (process.env.PERSON1_BIRTH_PLACE || 'Villach, Austria').trim(),
        portraitPath: resolvePortraitPath(portraitsDir),
    };
    const userId = process.env.USER_ID || 'f23f2057-5a74-4fc7-ab39-2a1f17729c2c';
    const person1Id = process.env.PERSON1_ID || `self-${userId}`;
    if (!node_fs_1.default.existsSync(person1.portraitPath)) {
        throw new Error(`Missing base portrait for person1: ${person1.portraitPath}`);
    }
    console.log(`🎨 Regenerating fresh AI portrait from ${portraitsDir}...`);
    const portraitResult = await (0, aiPortraitService_1.generateAIPortrait)(readImageAsBase64(person1.portraitPath), userId, person1Id);
    if (!portraitResult.success || !portraitResult.imageUrl) {
        throw new Error(`Failed to generate person1 AI portrait: ${portraitResult.error || 'unknown error'}`);
    }
    const person1PortraitUrl = addCacheBuster(portraitResult.imageUrl);
    const relationshipPreferenceScale = 7;
    const systems = ['western', 'vedic', 'human_design', 'gene_keys', 'kabbalah'];
    const argSystems = process.argv.find((arg) => arg.startsWith('--systems='));
    const systemsToRun = argSystems
        ? argSystems
            .replace('--systems=', '')
            .split(',')
            .map((s) => s.trim())
            .filter(Boolean)
        : systems;
    logRunConfig({
        outDir,
        portraitsDir,
        styleLayerId,
        systemsToRun: systemsToRun.map((s) => String(s)),
    });
    console.log('🧮 Computing placements (Swiss Ephemeris)...');
    const placements = await ephemerisIsolation_1.ephemerisIsolation.computePlacements({
        birthDate: person1.birthDate,
        birthTime: person1.birthTime,
        timezone: person1.timezone,
        latitude: person1.latitude,
        longitude: person1.longitude,
        relationshipIntensity: relationshipPreferenceScale,
        relationshipMode: 'sensual',
        primaryLanguage: 'en',
    });
    const p1BirthData = {
        birthDate: person1.birthDate,
        birthTime: person1.birthTime,
        timezone: person1.timezone,
        birthPlace: person1.birthPlace,
    };
    const tag = tsTag();
    for (const system of systemsToRun) {
        const systemId = system;
        const display = (0, systemConfig_1.getSystemDisplayName)(systemId);
        console.log(`\n📝 Generating ${display} (individual)...`);
        const chartData = (0, chartDataBuilder_1.buildChartDataForSystem)(systemId, person1.name, placements, null, null, p1BirthData, null);
        const payloadBase = {
            type: 'extended',
            systems: [systemId],
            person1: {
                name: person1.name,
                birthDate: person1.birthDate,
                birthTime: person1.birthTime,
                timezone: person1.timezone,
                latitude: person1.latitude,
                longitude: person1.longitude,
            },
            relationshipPreferenceScale,
            ...(resolvedPersonalContext ? { personalContext: resolvedPersonalContext } : {}),
            outputLanguage: 'en',
            outputLengthContract: {
                targetWordsMin: wordCounts_1.WORD_COUNT_LIMITS.min,
                targetWordsMax: wordCounts_1.WORD_COUNT_LIMITS.max,
                hardFloorWords: wordCounts_1.WORD_COUNT_LIMITS.min,
                note: `No filler. Add new insight density per paragraph. Third-person only (no you/your). Target ${wordCounts_1.WORD_COUNT_LIMITS.min}-${wordCounts_1.WORD_COUNT_LIMITS.max} words.`,
            },
            ...(styleLayerId
                ? {
                    promptLayerDirective: {
                        sharedWritingStyleLayerId: styleLayerId,
                    },
                }
                : {}),
        };
        const fileBase = `individual_${(0, generateReading_1.safeFileToken)(person1.name)}_${(0, generateReading_1.safeFileToken)(systemId)}_${styleToken}_${tag}`;
        const generated = await (0, generateReading_1.generateSingleReading)({
            system: systemId,
            personName: person1.name,
            styleLayerId,
            outDir,
            fileBase,
            chartData,
            payloadBase,
            hardFloorWords: wordCounts_1.WORD_COUNT_LIMITS.min,
            docType: 'individual',
        });
        console.log(`🧩 style resolved for ${display}: ${generated.resolvedStyleLayerId}`);
        const pdfTitle = `${display} Reading about ${person1.name}`;
        const chartReferencePage = (0, chartReferencePage_1.buildChartReferencePage)({
            chartData: generated.chartDataForPrompt,
            personName: person1.name,
            birth: {
                birthDate: person1.birthDate,
                birthTime: person1.birthTime,
                birthPlace: person1.birthPlace,
            },
            generatedAt: new Date(),
            compact: true,
            system: systemId,
        });
        const coverQuote = extractCoverQuote(generated.reading);
        const pdf = await (0, pdfGenerator_1.generateReadingPDF)({
            type: 'single',
            title: pdfTitle,
            coverQuote,
            allowInferredHeadlines: false,
            person1: {
                name: person1.name,
                birthDate: person1.birthDate,
                birthTime: person1.birthTime,
                birthPlace: person1.birthPlace,
                timezone: person1.timezone,
                portraitUrl: person1PortraitUrl,
            },
            chapters: [
                {
                    title: pdfTitle,
                    system: systemId,
                    person1Reading: generated.reading,
                },
            ],
            chartReferencePage,
            generatedAt: new Date(),
        });
        const pdfOut = node_path_1.default.join(outDir, `individual_${(0, generateReading_1.safeFileToken)(person1.name)}_${(0, generateReading_1.safeFileToken)(display)}_${styleToken}_${tag}.pdf`);
        node_fs_1.default.copyFileSync(pdf.filePath, pdfOut);
        console.log(`✅ Wrote PDF: ${pdfOut}`);
        // Persist reading text for downstream audio generation.
        const textOut = pdfOut.replace(/\.pdf$/i, '.reading.txt');
        node_fs_1.default.writeFileSync(textOut, generated.reading, 'utf8');
        console.log(`✅ Wrote reading text: ${textOut}`);
    }
    console.log('\n✅ Done. Outputs in:', outDir);
}
main().catch((err) => {
    console.error('❌ v2_generate_individual_pdfs failed:', err?.message || String(err));
    process.exitCode = 1;
});
//# sourceMappingURL=v2_generate_individual_pdfs.js.map