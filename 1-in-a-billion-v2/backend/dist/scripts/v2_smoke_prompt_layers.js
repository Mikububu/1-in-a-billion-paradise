"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const node_fs_1 = __importDefault(require("node:fs"));
const node_path_1 = __importDefault(require("node:path"));
const fromJobPayload_1 = require("../promptEngine/fromJobPayload");
const llm_1 = require("../services/llm");
const pdfGenerator_1 = require("../services/pdf/pdfGenerator");
function tsTag() {
    return new Date().toISOString().replace(/[:.]/g, '-');
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
async function main() {
    const projectRoot = node_path_1.default.resolve(__dirname, '../../..');
    const outDir = resolveDefaultMediaOutDir(projectRoot);
    const portraitsDir = resolvePortraitsDir(projectRoot);
    node_fs_1.default.mkdirSync(outDir, { recursive: true });
    const payload = {
        type: 'synastry',
        systems: ['kabbalah'],
        person1: {
            name: 'Michael',
            birthDate: '1968-08-23',
            birthTime: '13:45',
            timezone: 'Europe/Vienna',
            latitude: 46.6103,
            longitude: 13.8558,
        },
        person2: {
            name: 'Tata Umana',
            birthDate: '1982-06-30',
            birthTime: '15:15',
            timezone: 'America/Bogota',
            latitude: 4.711,
            longitude: -74.0721,
        },
        relationshipPreferenceScale: 7,
        relationshipContext: 'Test run: verify V2 prompt layers are active. No name/gematria analysis. Focus on Kabbalah synastry structure.',
        outputLengthContract: {
            targetWordsMin: 700,
            targetWordsMax: 1100,
            hardFloorWords: 600,
            note: 'Smoke test: short output is OK. Prioritize insight density over length.',
        },
        promptLayerDirective: {
            sharedWritingStyleLayerId: 'writing-style-guide-v1',
        },
        chartData: [
            'BIRTH DATA (FOR STRUCTURE ONLY):',
            '- Michael: 1968-08-23 13:45 Europe/Vienna (Villach, Austria)',
            '- Tata Umana: 1982-06-30 15:15 America/Bogota (Bogota, Colombia)',
            '',
            'NOTE:',
            '- This is a smoke test; full computed placements are omitted.',
            '- Do not fall back to name-letter analysis; use Tree of Life structure + synastry dynamics.',
        ].join('\n'),
    };
    const composed = await (0, fromJobPayload_1.composePromptFromJobStartPayload)(payload);
    const userMessage = composed.userMessage || composed.prompt;
    const systemPrompt = composed.systemPrompt || undefined;
    const tag = tsTag();
    const promptPath = node_path_1.default.join(outDir, `smoke_${tag}_kabbalah_synastry.prompt.txt`);
    node_fs_1.default.writeFileSync(promptPath, composed.prompt, 'utf8');
    node_fs_1.default.writeFileSync(node_path_1.default.join(outDir, `smoke_${tag}_kabbalah_synastry.user.txt`), userMessage, 'utf8');
    node_fs_1.default.writeFileSync(node_path_1.default.join(outDir, `smoke_${tag}_kabbalah_synastry.system.txt`), systemPrompt || '', 'utf8');
    const text = await llm_1.llmPaid.generateStreaming(userMessage, `smoke-kabbalah-${tag}`, {
        maxTokens: 2500,
        temperature: 0.85,
        systemPrompt,
    });
    const textPath = node_path_1.default.join(outDir, `smoke_${tag}_kabbalah_synastry.reading.txt`);
    node_fs_1.default.writeFileSync(textPath, text, 'utf8');
    const pdfResult = await (0, pdfGenerator_1.generateReadingPDF)({
        type: 'overlay',
        title: `Kabbalah - Michael & Tata Umana`,
        person1: {
            name: payload.person1.name,
            birthDate: payload.person1.birthDate,
            birthTime: payload.person1.birthTime,
            birthPlace: 'Villach, Austria',
            timezone: payload.person1.timezone,
            portraitUrl: node_path_1.default.join(portraitsDir, 'Michael_2.jpg'),
        },
        person2: {
            name: payload.person2.name,
            birthDate: payload.person2.birthDate,
            birthTime: payload.person2.birthTime,
            birthPlace: 'Bogota, Colombia',
            timezone: payload.person2.timezone,
            portraitUrl: node_path_1.default.join(portraitsDir, 'Tata.jpeg'),
        },
        chapters: [
            {
                title: 'Kabbalah Synastry',
                system: 'kabbalah',
                overlayReading: text,
            },
        ],
        generatedAt: new Date(),
    });
    const pdfOutPath = node_path_1.default.join(outDir, `smoke_${tag}_kabbalah_synastry.pdf`);
    node_fs_1.default.copyFileSync(pdfResult.filePath, pdfOutPath);
    console.log('✅ Smoke test artifacts written to:', outDir);
    console.log('-', promptPath);
    console.log('-', textPath);
    console.log('-', pdfOutPath);
}
main().catch((err) => {
    console.error('❌ Smoke test failed:', err);
    process.exitCode = 1;
});
//# sourceMappingURL=v2_smoke_prompt_layers.js.map