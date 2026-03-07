"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
require("dotenv/config");
const fs_1 = require("fs");
const path_1 = require("path");
const supabaseClient_1 = require("../services/supabaseClient");
/**
 * Apply a migration by sending the WHOLE SQL file to the `exec_sql` RPC in one call.
 * This is required for PL/pgSQL functions/triggers (splitting on semicolons breaks them).
 *
 * Usage:
 *   ts-node src/scripts/applyMigrationWholeFile.ts 022_fix_synastry_task_fanout.sql
 */
async function main() {
    const migrationFile = process.argv[2];
    if (!migrationFile) {
        throw new Error('Missing migration filename arg. Example: ts-node src/scripts/applyMigrationWholeFile.ts 022_fix_synastry_task_fanout.sql');
    }
    const migrationPath = (0, path_1.join)(__dirname, '../../migrations', migrationFile);
    const sql = (0, fs_1.readFileSync)(migrationPath, 'utf-8');
    const supabase = (0, supabaseClient_1.createSupabaseServiceClient)();
    if (!supabase) {
        throw new Error('Supabase service client not configured (SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY).');
    }
    console.log(`🧱 Applying migration (whole file): ${migrationFile}`);
    // exec_sql param naming differs across projects; try both.
    let error = null;
    {
        const r = await supabase.rpc('exec_sql', { sql });
        error = r.error;
    }
    if (error) {
        const r2 = await supabase.rpc('exec_sql', { sql_query: sql });
        error = r2.error;
    }
    if (error) {
        console.error('❌ Migration failed:', error);
        process.exit(1);
    }
    console.log('✅ Migration applied successfully');
}
main().catch((err) => {
    console.error('❌', err?.message || String(err));
    process.exit(1);
});
//# sourceMappingURL=applyMigrationWholeFile.js.map