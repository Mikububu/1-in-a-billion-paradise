import fs from 'fs';
import path from 'path';
import { llmPaid } from '../services/llm';

import * as dotenv from 'dotenv';
dotenv.config({ path: path.resolve(__dirname, '../../.env') });


const LANGUAGES = [
    { code: 'ru', name: 'Russian' }
];

const I18N_DIR = path.resolve(__dirname, '../../../src/i18n');

// Read English original
const enFile = JSON.parse(fs.readFileSync(path.join(I18N_DIR, 'en.json'), 'utf8'));

async function translateChunk(langName: string, langCode: string, keys: string[], translatedObj: any): Promise<void> {
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
        const response = await llmPaid.generate(prompt, `translation_audit_${langCode}`, { temperature: 0.1, maxTokens: 4000 });

        let cleaned = response.trim();
        if (cleaned.startsWith('```json')) cleaned = cleaned.replace(/```json/g, '').replace(/```/g, '').trim();
        if (cleaned.startsWith('```')) cleaned = cleaned.replace(/```/g, '').trim();

        const auditedObj = JSON.parse(cleaned);

        // Merge updates
        for (const k of keys) {
            if (auditedObj[k] && auditedObj[k] !== translatedObj[k]) {
                console.log(`\n🔄 FIXED [${k}]:\nOld: ${translatedObj[k]}\nNew: ${auditedObj[k]}`);
                translatedObj[k] = auditedObj[k];
            }
        }
    } catch (e: any) {
        console.error(`Error processing chunk for ${langName}:`, e.message);
    }
}

async function run() {
    console.log('🌟 Starting AI Translation Audit & Refinement...');

    for (const lang of LANGUAGES) {
        const filePath = path.join(I18N_DIR, `${lang.code}.json`);
        if (!fs.existsSync(filePath)) {
            console.log(`Skipping ${lang.name} - file not found.`);
            continue;
        }

        console.log(`\n========================================`);
        console.log(`📝 Auditing ${lang.name} (${lang.code}.json)...`);
        console.log(`========================================\n`);

        const translatedObj = JSON.parse(fs.readFileSync(filePath, 'utf8'));
        const allKeys = Object.keys(enFile);

        const chunkSize = 20;

        for (let i = 0; i < allKeys.length; i += chunkSize) {
            const chunkKeys = allKeys.slice(i, i + chunkSize);
            await translateChunk(lang.name, lang.code, chunkKeys, translatedObj);
        }

        fs.writeFileSync(filePath, JSON.stringify(translatedObj, null, 2) + '\n');
        console.log(`✅ Finished writing audited ${lang.name} to ${filePath}`);
    }
}

run().catch(console.error);
