"use strict";
/**
 * CHECK UNIQUE FILES
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const supabaseClient_1 = require("../services/supabaseClient");
const dotenv_1 = require("dotenv");
const path_1 = require("path");
const fs_1 = __importDefault(require("fs"));
const path_2 = __importDefault(require("path"));
(0, dotenv_1.config)({ path: (0, path_1.join)(__dirname, '../../.env') });
const PROJECT_ROOT = path_2.default.resolve(__dirname, '../../..');
const OUTPUT_DIR = process.env.MEDIA_OUT_DIR || path_2.default.join(PROJECT_ROOT, 'runtime', 'media');
async function checkUniqueFiles() {
    const supabase = (0, supabaseClient_1.createSupabaseServiceClient)();
    if (!supabase) {
        console.error('❌ Supabase not configured');
        process.exit(1);
    }
    try {
        const { data } = await supabase
            .from('job_artifacts')
            .select('storage_path, artifact_type')
            .in('artifact_type', ['pdf', 'audio_mp3', 'audio_song'])
            .not('storage_path', 'is', null);
        const allNames = (data || []).map((a) => String(a.storage_path.split('/').pop() || ''));
        const unique = Array.from(new Set(allNames));
        console.log('📊 DATABASE:');
        console.log(`   Total entries: ${data?.length || 0}`);
        console.log(`   Unique filenames: ${unique.length}`);
        console.log(`   Duplicate entries: ${(data?.length || 0) - unique.length}\n`);
        const byType = {};
        (data || []).forEach((a) => {
            const type = String(a.artifact_type || '');
            const name = String(a.storage_path.split('/').pop() || '');
            if (!byType[type])
                byType[type] = new Set();
            byType[type].add(name);
        });
        console.log('Unique files by type:');
        Object.entries(byType).forEach(([type, set]) => {
            console.log(`   ${type}: ${set.size} unique files`);
        });
        const baseDir = path_2.default.join(OUTPUT_DIR, 'e34061de-755c-4b5e-9b0d-a6c7aa8bddc2');
        const onDisk = new Set();
        ['pdf', 'audio_mp3', 'audio_song'].forEach(type => {
            const typeDir = path_2.default.join(baseDir, type);
            try {
                fs_1.default.readdirSync(typeDir).forEach(f => onDisk.add(f));
            }
            catch { }
        });
        console.log(`\n📁 ON DISK:`);
        console.log(`   Unique files: ${onDisk.size}\n`);
        const missing = unique.filter((f) => !onDisk.has(f));
        console.log(`❌ MISSING: ${missing.length} unique files\n`);
        if (missing.length > 0) {
            console.log('Missing files:');
            missing.forEach((f) => console.log(`   - ${f}`));
        }
        else {
            console.log('✅ All unique files are downloaded!');
        }
        process.exit(0);
    }
    catch (error) {
        console.error('❌ Error:', error);
        process.exit(1);
    }
}
checkUniqueFiles();
//# sourceMappingURL=checkUniqueFiles.js.map