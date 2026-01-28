/**
 * ANALYZE DATABASE SIZE
 * 
 * Queries table row counts to identify which tables might be consuming
 * the most storage space. For exact sizes, use Supabase Dashboard or SQL query.
 * 
 * Usage:
 *   npx ts-node src/scripts/analyzeDatabaseSize.ts
 */

import { createSupabaseServiceClient } from '../services/supabaseClient';
import { config } from 'dotenv';
import { join } from 'path';

config({ path: join(__dirname, '../../.env') });

interface TableInfo {
  table: string;
  rowCount: number;
}

async function analyzeDatabaseSize() {
  const supabase = createSupabaseServiceClient();

  if (!supabase) {
    console.error('❌ Supabase not configured');
    process.exit(1);
  }

  console.log('📊 ANALYZING DATABASE SIZE');
  console.log('═══════════════════════════════════════════════════════════\n');
  console.log('ℹ️  Note: This script counts rows per table.');
  console.log('   For exact table sizes (MB/GB), use:');
  console.log('   1. Supabase Dashboard → Database → Storage');
  console.log('   2. SQL Editor → Run queryTableSizes.sql\n');

  try {
    // Get list of all tables in public schema
    // We'll query each table's row count
    const knownTables = [
      'jobs',
      'job_tasks',
      'job_artifacts',
      'library_people',
      'user_readings',
      'job_notification_settings',
      'admin_users',
      'api_keys'
    ];

    console.log('📊 Analyzing table row counts...\n');

    const tableSizes: TableInfo[] = [];

    // Query each known table
    for (const tableName of knownTables) {
      try {
        const { count, error: countError } = await supabase
          .from(tableName)
          .select('*', { count: 'exact', head: true });
        
        if (!countError) {
          tableSizes.push({
            table: tableName,
            rowCount: count || 0
          });
        } else {
          console.log(`   ⚠️  Skipping ${tableName}: ${countError.message}`);
        }
      } catch (err: any) {
        console.log(`   ⚠️  Skipping ${tableName}: ${err.message}`);
      }
    }

    // Sort by row count
    tableSizes.sort((a, b) => b.rowCount - a.rowCount);

    console.log('📋 Table row counts (sorted by size):');
    console.log('─────────────────────────────────────────────────────────────');
    console.log('Table'.padEnd(30) + ' | ' + 'Row Count'.padStart(12));
    console.log('─────────────────────────────────────────────────────────────');
    
    let totalRows = 0;
    for (const table of tableSizes) {
      totalRows += table.rowCount;
      console.log(table.table.padEnd(30) + ' | ' + table.rowCount.toString().padStart(12));
    }
    
    console.log('─────────────────────────────────────────────────────────────');
    console.log('TOTAL'.padEnd(30) + ' | ' + totalRows.toString().padStart(12));
    
    // Show top 5 largest tables
    console.log('\n📊 Top 5 largest tables (by row count):');
    for (let i = 0; i < Math.min(5, tableSizes.length); i++) {
      const table = tableSizes[i];
      console.log(`   ${i + 1}. ${table.table}: ${table.rowCount.toLocaleString()} rows`);
    }

    // Estimate size (very rough - assumes ~1KB per row on average)
    const estimatedMB = (totalRows * 1024) / (1024 * 1024);
    const estimatedGB = estimatedMB / 1024;
    
    console.log('\n💡 Rough size estimate (assuming ~1KB per row):');
    console.log(`   ~${estimatedMB.toFixed(2)} MB (~${estimatedGB.toFixed(2)} GB)`);
    console.log('   ⚠️  This is a rough estimate - actual sizes vary by table structure');

    console.log('\n═══════════════════════════════════════════════════════════');
    console.log('💡 TO GET EXACT TABLE SIZES:');
    console.log('═══════════════════════════════════════════════════════════');
    console.log('1. Supabase Dashboard → Database → Storage');
    console.log('   This shows exact MB/GB per table');
    console.log('');
    console.log('2. SQL Editor → Run this query:');
    console.log('   (See: src/scripts/queryTableSizes.sql)');
    console.log('');
    console.log('   SELECT ');
    console.log('     tablename as table,');
    console.log('     pg_size_pretty(pg_total_relation_size(\'public.\'||tablename)) as total_size,');
    console.log('     pg_size_pretty(pg_relation_size(\'public.\'||tablename)) as table_size');
    console.log('   FROM pg_tables');
    console.log('   WHERE schemaname = \'public\'');
    console.log('   ORDER BY pg_total_relation_size(\'public.\'||tablename) DESC;');
    console.log('');
    console.log('3. Check for:');
    console.log('   - Tables with large JSONB columns (jobs.params, jobs.progress)');
    console.log('   - Many rows in job_artifacts, jobs, job_tasks');
    console.log('   - Old/unused data that can be cleaned up');
    console.log('═══════════════════════════════════════════════════════════\n');

  } catch (error: any) {
    console.error('❌ Fatal error:', error);
    console.error('\n💡 Alternative: Check Supabase Dashboard → Database → Storage');
    process.exit(1);
  }
}

analyzeDatabaseSize().catch(err => {
  console.error('❌ Fatal error:', err);
  process.exit(1);
});
