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
Object.defineProperty(exports, "__esModule", { value: true });
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const supabase_js_1 = require("@supabase/supabase-js");
const dotenv = __importStar(require("dotenv"));
dotenv.config({ path: path.join(__dirname, '../../.env') });
const supabaseUrl = process.env.SUPABASE_URL || '';
const supabaseKey = 'sb_publishable_Eo_ARWmmkiRfpLdSOYh_Dw_hJlVCQ8n';
if (!supabaseUrl) {
    console.error('❌ Missing Supabase URL in .env');
    process.exit(1);
}
const supabase = (0, supabase_js_1.createClient)(supabaseUrl, supabaseKey);
async function upsertPrompt(category, key, content) {
    const { error } = await supabase.rpc('insert_ai_config', {
        p_category: category,
        p_key: key,
        p_content: content
    });
    if (error) {
        console.error(`❌ Failed to upsert ${key}:`, error.message);
    }
    else {
        console.log(`✅ Upserted ${key} [${category}]`);
    }
}
async function migrateFolder(folderPath, category) {
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
//# sourceMappingURL=migratePromptsToDB.js.map