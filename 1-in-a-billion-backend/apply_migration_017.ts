/**
 * Apply Migration 017: Fix Voice Selection
 * 
 * This script helps you apply the migration via Supabase Dashboard.
 * Since Supabase doesn't allow arbitrary SQL via JS client, it provides
 * the SQL and opens the dashboard for you.
 */

import * as fs from 'fs';
import * as path from 'path';
import { execSync } from 'child_process';

const migrationPath = path.resolve(__dirname, 'migrations/017_fix_voice_selection.sql');
const sql = fs.readFileSync(migrationPath, 'utf-8');

console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('🚀 Migration 017: Fix Voice Selection');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

console.log('📋 SQL has been copied to your clipboard!\n');
console.log('📝 Next steps:');
console.log('   1. Go to: https://supabase.com/dashboard/project/qdfikbgwuauertfmkmzk/sql/new');
console.log('   2. Paste (Cmd+V) the SQL into the SQL Editor');
console.log('   3. Click "Run" or press Cmd+Enter');
console.log('   4. You should see: ✅ Success. No rows returned\n');

// Copy SQL to clipboard
try {
  execSync(`echo "${sql.replace(/"/g, '\\"')}" | pbcopy`, { stdio: 'ignore' });
  console.log('✅ SQL copied to clipboard!\n');
} catch (error) {
  console.log('⚠️  Could not copy to clipboard automatically.');
  console.log('   Please copy the SQL manually from: migrations/017_fix_voice_selection.sql\n');
}

// Try to open Supabase dashboard
try {
  execSync('open "https://supabase.com/dashboard/project/qdfikbgwuauertfmkmzk/sql/new"', { stdio: 'ignore' });
  console.log('🌐 Opened Supabase SQL Editor in your browser!\n');
} catch (error) {
  console.log('💡 Please open this URL manually:');
  console.log('   https://supabase.com/dashboard/project/qdfikbgwuauertfmkmzk/sql/new\n');
}

console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('📄 SQL Preview (first 500 chars):');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
console.log(sql.substring(0, 500) + '...\n');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
