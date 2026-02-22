import 'dotenv/config';
import { readFileSync } from 'fs';
import { join } from 'path';
import { createSupabaseServiceClient } from '../services/supabaseClient';

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

  const migrationPath = join(__dirname, '../../migrations', migrationFile);
  const sql = readFileSync(migrationPath, 'utf-8');

  const supabase = createSupabaseServiceClient();
  if (!supabase) {
    throw new Error('Supabase service client not configured (SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY).');
  }

  console.log(`🧱 Applying migration (whole file): ${migrationFile}`);

  // exec_sql param naming differs across projects; try both.
  let error: any = null;
  {
    const r = await supabase.rpc('exec_sql', { sql });
    error = r.error;
  }
  if (error) {
    const r2 = await supabase.rpc('exec_sql', { sql_query: sql } as any);
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

