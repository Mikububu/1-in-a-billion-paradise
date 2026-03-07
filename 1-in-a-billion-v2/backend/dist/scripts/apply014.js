"use strict";
/**
 * Apply Migration 014 - Parallel Post-Text Tasks
 *
 * This script applies the migration using direct Postgres connection.
 */
Object.defineProperty(exports, "__esModule", { value: true });
const fs_1 = require("fs");
const path_1 = require("path");
const supabase_js_1 = require("@supabase/supabase-js");
const dotenv_1 = require("dotenv");
// Load environment variables
(0, dotenv_1.config)({ path: (0, path_1.join)(__dirname, '../../.env') });
async function applyMigration014() {
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!supabaseUrl || !supabaseKey) {
        console.error('❌ Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env');
        process.exit(1);
    }
    console.log('📄 Reading migration 014...');
    const migrationPath = (0, path_1.join)(__dirname, '../../migrations/014_parallel_post_text_tasks.sql');
    const sql = (0, fs_1.readFileSync)(migrationPath, 'utf-8');
    console.log('🔧 Applying migration to Supabase...');
    console.log('   URL:', supabaseUrl);
    const supabase = (0, supabase_js_1.createClient)(supabaseUrl, supabaseKey);
    // Execute the SQL directly
    try {
        const { data, error } = await supabase.rpc('exec', { sql });
        if (error) {
            console.error('❌ Migration failed:', error);
            console.log('\n💡 Please apply this SQL manually in Supabase Dashboard → SQL Editor:');
            console.log('\n--- Copy from here ---\n');
            console.log(sql);
            console.log('\n--- End of SQL ---\n');
            process.exit(1);
        }
        console.log('✅ Migration applied successfully!');
    }
    catch (err) {
        console.error('❌ Error applying migration:', err.message);
        console.log('\n💡 Please apply this SQL manually in Supabase Dashboard → SQL Editor:');
        console.log('\n--- Copy from here ---\n');
        console.log(sql);
        console.log('\n--- End of SQL ---\n');
        process.exit(1);
    }
}
applyMigration014().catch(err => {
    console.error('❌ Fatal error:', err);
    process.exit(1);
});
//# sourceMappingURL=apply014.js.map