"use strict";
/**
 * LIST ALL FILES IN DATABASE
 *
 * Lists all media files in database to see what exists vs what was downloaded.
 */
Object.defineProperty(exports, "__esModule", { value: true });
const supabaseClient_1 = require("../services/supabaseClient");
const dotenv_1 = require("dotenv");
const path_1 = require("path");
(0, dotenv_1.config)({ path: (0, path_1.join)(__dirname, '../../.env') });
async function listAllFilesInDB() {
    const supabase = (0, supabaseClient_1.createSupabaseServiceClient)();
    if (!supabase) {
        console.error('❌ Supabase not configured');
        process.exit(1);
    }
    try {
        const { data: artifacts, error } = await supabase
            .from('job_artifacts')
            .select('job_id, artifact_type, storage_path, file_size_bytes')
            .in('artifact_type', ['pdf', 'audio_mp3', 'audio_m4a', 'audio_song'])
            .not('storage_path', 'is', null)
            .order('artifact_type', { ascending: true })
            .order('storage_path', { ascending: true });
        if (error)
            throw error;
        console.log('📋 ALL FILES IN DATABASE');
        console.log('═══════════════════════════════════════════════════════════\n');
        console.log(`Total: ${artifacts?.length || 0} files\n`);
        // Group by type
        const byType = {};
        for (const artifact of artifacts || []) {
            const type = artifact.artifact_type || 'unknown';
            if (!byType[type])
                byType[type] = [];
            byType[type].push(artifact);
        }
        for (const [type, files] of Object.entries(byType)) {
            console.log(`\n📁 ${type.toUpperCase()} (${files.length} files):`);
            console.log('─────────────────────────────────────────────────────────────');
            for (const file of files) {
                const fileName = file.storage_path.split('/').pop();
                const sizeMB = (file.file_size_bytes || 0) / (1024 * 1024);
                console.log(`  ${fileName.padEnd(60)} ${sizeMB.toFixed(2).padStart(8)} MB`);
            }
        }
        console.log('\n═══════════════════════════════════════════════════════════\n');
    }
    catch (error) {
        console.error('❌ Fatal error:', error);
        process.exit(1);
    }
}
listAllFilesInDB().catch(err => {
    console.error('❌ Fatal error:', err);
    process.exit(1);
});
//# sourceMappingURL=listAllFilesInDB.js.map