import fs from 'fs';
import path from 'path';
import { llmWithFallback } from '../services/llm';

const BATCH_SIZE = 100;

const I18N_DIR = path.join(__dirname, '../../../src/i18n');
const EN_PATH = path.join(I18N_DIR, 'en.json');

const LANGUAGES = [
    { code: 'ja', name: 'Japanese' },
    { code: 'ko', name: 'Korean' },
    { code: 'hi', name: 'Hindi' },
    { code: 'pt', name: 'Portuguese (Brazil)' },
    { code: 'it', name: 'Italian' }
];

async function translateBatch(keys: string[], enDict: Record<string, string>, targetLang: string): Promise<Record<string, string>> {
    const sourceObj: Record<string, string> = {};
    for (const k of keys) {
        sourceObj[k] = enDict[k];
    }

    const prompt = `Translate the following JSON UI strings from English to ${targetLang}.
Keep all JSON keys exactly the same.
Keep all interpolation variables (e.g., {{name}}, {{count}}) exactly the same.
Return ONLY valid JSON and nothing else. Do not wrap in markdown tags if you can help it, but if you do, ensure it parses as JSON when stripped.

JSON to translate:
${JSON.stringify(sourceObj, null, 2)}
`;

    try {
        const { text } = await llmWithFallback.generateWithFallback(prompt, `translate-${targetLang}`, { maxTokens: 8192 });
        let cleanText = text.trim();
        if (cleanText.startsWith('```json')) {
            cleanText = cleanText.substring(7);
        } else if (cleanText.startsWith('```')) {
            cleanText = cleanText.substring(3);
        }
        if (cleanText.endsWith('```')) {
            cleanText = cleanText.substring(0, cleanText.length - 3);
        }
        return JSON.parse(cleanText.trim());
    } catch (err: any) {
        console.error(`Error translating batch for ${targetLang}:`, err.message);
        throw err;
    }
}

async function main() {
    const enDict = JSON.parse(fs.readFileSync(EN_PATH, 'utf-8'));
    const allKeys = Object.keys(enDict);

    for (const lang of LANGUAGES) {
        console.log(`\n🌍 Translating to ${lang.name} (${lang.code})...`);
        const outPath = path.join(I18N_DIR, `${lang.code}.json`);

        // Load existing if any, to skip already translated
        let resultDict: Record<string, string> = {};
        if (fs.existsSync(outPath)) {
            try {
                const existing = JSON.parse(fs.readFileSync(outPath, 'utf-8'));
                if (Object.keys(existing).length > 0) resultDict = existing;
            } catch (e) { }
        }

        const missingKeys = allKeys.filter(k => !resultDict[k]);
        console.log(`${missingKeys.length} keys to translate.`);

        for (let i = 0; i < missingKeys.length; i += BATCH_SIZE) {
            const batchKeys = missingKeys.slice(i, i + BATCH_SIZE);
            console.log(`  -> Batch ${Math.floor(i / BATCH_SIZE) + 1} of ${Math.ceil(missingKeys.length / BATCH_SIZE)}`);

            let success = false;
            let retries = 3;
            while (!success && retries > 0) {
                try {
                    const translatedBatch = await translateBatch(batchKeys, enDict, lang.name);
                    // Merge
                    for (const k of batchKeys) {
                        if (translatedBatch[k]) {
                            resultDict[k] = translatedBatch[k];
                        } else {
                            console.warn(`    ⚠️ Missing key in translation: ${k}`);
                            resultDict[k] = enDict[k]; // fallback to EN if model skipped it
                        }
                    }
                    success = true;
                    // Save incrementally
                    fs.writeFileSync(outPath, JSON.stringify(resultDict, null, 2), 'utf-8');
                } catch (err) {
                    retries--;
                    console.warn(`    Retrying batch... (${retries} left)`);
                }
            }
            if (!success) {
                console.error(`    ❌ Failed to translate batch. Skipping to next.`);
            }
        }
    }
    console.log('\n🎉 All translations complete!');
}

main().catch(console.error);
