"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const llm_1 = require("../services/llm");
const dotenv = __importStar(require("dotenv"));
dotenv.config({ path: path_1.default.resolve(__dirname, '../../.env') });
const LANGUAGES = [
    { code: 'ru', name: 'Russian' }
];
const I18N_DIR = path_1.default.resolve(__dirname, '../../../src/i18n');
// Read English original
const enFile = JSON.parse(fs_1.default.readFileSync(path_1.default.join(I18N_DIR, 'en.json'), 'utf8'));
async function translateChunk(langName, langCode, keys, translatedObj) {
    const chunkPairs = keys.map(k => `KEY: ${k}\nENGLISH: ${enFile[k]}\nCURRENT ${langName.toUpperCase()}: ${translatedObj[k] || ''}`);
    const prompt = `You are a world-class literary translator and native ${langName} speaker. 
We have a spiritual dating/astrology app called "1 in a Billion". 
The current ${langName} translations are often too literal, clunky, or miss the mystical, premium, slightly edgy tone of the original English.

Review the following UI string translations. If the current ${langName} translation is perfect, natural, and fits the premium mystical vibe, keep it exactly as is! DO NOT CHANGE IT IF IT IS GOOD.
If the translation sounds awkward, machine-translated, or too literal, rewrite it to be natural, poetic, and native. 
Special Rule for German: "Wie Matching wirkt" -> "Wie Matching funktioniert" and "Meine Seelenbibliothek" -> "Meine Bibliothek der Seelen".

Keep placeholders like {{count}} or {{name}} intact.

${chunkPairs.join('\n\n')}

Return ONLY a perfectly formatted JSON object with the Keys mapped to your accepted/new ${langName} translations. No markdown, no explanations. Just valid JSON.`;
    try {
        console.log(`Sending chunk of ${keys.length} keys for ${langName}...`);
        // Use Claude since it has high context limits
        const response = await llm_1.llmPaid.generate(prompt, `translation_audit_${langCode}`, { temperature: 0.1, maxTokens: 4000 });
        let cleaned = response.trim();
        if (cleaned.startsWith('```json'))
            cleaned = cleaned.replace(/```json/g, '').replace(/```/g, '').trim();
        if (cleaned.startsWith('```'))
            cleaned = cleaned.replace(/```/g, '').trim();
        const auditedObj = JSON.parse(cleaned);
        // Merge updates
        for (const k of keys) {
            if (auditedObj[k] && auditedObj[k] !== translatedObj[k]) {
                console.log(`\n🔄 FIXED [${k}]:\nOld: ${translatedObj[k]}\nNew: ${auditedObj[k]}`);
                translatedObj[k] = auditedObj[k];
            }
        }
    }
    catch (e) {
        console.error(`Error processing chunk for ${langName}:`, e.message);
    }
}
async function run() {
    console.log('🌟 Starting AI Translation Audit & Refinement...');
    for (const lang of LANGUAGES) {
        const filePath = path_1.default.join(I18N_DIR, `${lang.code}.json`);
        if (!fs_1.default.existsSync(filePath)) {
            console.log(`Skipping ${lang.name} - file not found.`);
            continue;
        }
        console.log(`\n========================================`);
        console.log(`📝 Auditing ${lang.name} (${lang.code}.json)...`);
        console.log(`========================================\n`);
        const translatedObj = JSON.parse(fs_1.default.readFileSync(filePath, 'utf8'));
        const allKeys = Object.keys(enFile);
        const chunkSize = 20;
        for (let i = 0; i < allKeys.length; i += chunkSize) {
            const chunkKeys = allKeys.slice(i, i + chunkSize);
            await translateChunk(lang.name, lang.code, chunkKeys, translatedObj);
        }
        fs_1.default.writeFileSync(filePath, JSON.stringify(translatedObj, null, 2) + '\n');
        console.log(`✅ Finished writing audited ${lang.name} to ${filePath}`);
    }
}
run().catch(console.error);
//# sourceMappingURL=audit_ru.js.map