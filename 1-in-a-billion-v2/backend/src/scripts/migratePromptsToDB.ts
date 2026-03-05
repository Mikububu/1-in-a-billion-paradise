import * as fs from 'fs';
import * as path from 'path';
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config({ path: path.join(__dirname, '../../.env') });

const supabaseUrl = process.env.SUPABASE_URL || '';
const supabaseKey = 'sb_publishable_Eo_ARWmmkiRfpLdSOYh_Dw_hJlVCQ8n';

if (!supabaseUrl) {
    console.error('❌ Missing Supabase URL in .env');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function upsertPrompt(category: string, key: string, content: string) {
    const { error } = await supabase.rpc('insert_ai_config', {
        p_category: category,
        p_key: key,
        p_content: content
    });

    if (error) {
        console.error(`❌ Failed to upsert ${key}:`, error.message);
    } else {
        console.log(`✅ Upserted ${key} [${category}]`);
    }
}

async function migrateFolder(folderPath: string, category: string) {
    if (!fs.existsSync(folderPath)) {
        console.warn(`⚠️ Folder not found: ${folderPath}`);
        return;
    }

    const files = fs.readdirSync(folderPath).filter(f => f.endsWith('.md'));
    for (const file of files) {
        const key = path.parse(file).name;
        const content = fs.readFileSync(path.join(folderPath, file), 'utf-8');
        await upsertPrompt(category, key, content.trim());
    }
}

async function run() {
    console.log('🚀 Migrating existing prompts to Supabase ai_configurations table VIA RPC...\n');

    const rootDir = path.join(__dirname, '../../');

    await migrateFolder(path.join(rootDir, 'prompt-layers/systems'), 'system_prompts');
    await migrateFolder(path.join(rootDir, 'prompts/music'), 'music_prompts');
    await migrateFolder(path.join(rootDir, 'prompt-layers/verdict'), 'verdict_prompts');
    await migrateFolder(path.join(rootDir, 'prompt-layers/images'), 'image_prompts');

    await upsertPrompt('settings', 'google_image_model', 'gemini-3-pro-image-preview');

    console.log('\n🎉 Migration complete!');
}

run().catch(console.error);
