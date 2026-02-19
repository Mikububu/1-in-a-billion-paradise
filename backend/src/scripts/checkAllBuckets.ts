/**
 * CHECK ALL STORAGE BUCKETS
 * 
 * Lists all buckets and their sizes to find what's consuming storage.
 */

import { createSupabaseServiceClient } from '../services/supabaseClient';
import { config } from 'dotenv';
import { join } from 'path';

config({ path: join(__dirname, '../../.env') });

async function checkAllBuckets() {
  const supabase = createSupabaseServiceClient();

  if (!supabase) {
    console.error('❌ Supabase not configured');
    process.exit(1);
  }

  console.log('🔍 CHECKING ALL STORAGE BUCKETS');
  console.log('═══════════════════════════════════════════════════════════\n');

  try {
    // List all buckets
    const { data: buckets, error } = await supabase.storage.listBuckets();

    if (error) {
      console.error('❌ Error:', error);
      throw error;
    }

    if (!buckets || buckets.length === 0) {
      console.log('No buckets found');
      return;
    }

    console.log(`Found ${buckets.length} bucket(s):\n`);

    for (const bucket of buckets) {
      console.log(`📦 Bucket: ${bucket.name}`);
      console.log(`   ID: ${bucket.id}`);
      console.log(`   Public: ${bucket.public}`);
      console.log(`   Created: ${bucket.created_at}`);
      
      // Try to list files (first level only)
      try {
        const { data: files, error: listError } = await supabase.storage
          .from(bucket.name)
          .list('', {
            limit: 100,
            sortBy: { column: 'name', order: 'asc' }
          });

        if (listError) {
          console.log(`   ⚠️  Error listing: ${listError.message}`);
        } else {
          console.log(`   📄 Top-level items: ${files?.length || 0}`);
          if (files && files.length > 0) {
            // Show first few items
            const items = files.slice(0, 5);
            for (const item of items) {
              if (item.id) {
                const sizeMB = ((item as any).metadata?.size || 0) / (1024 * 1024);
                console.log(`      - ${item.name} ${sizeMB > 0 ? `(${sizeMB.toFixed(2)} MB)` : ''}`);
              } else {
                console.log(`      - ${item.name}/ (folder)`);
              }
            }
            if (files.length > 5) {
              console.log(`      ... and ${files.length - 5} more`);
            }
          }
        }
      } catch (err: any) {
        console.log(`   ⚠️  Error: ${err.message}`);
      }
      
      console.log('');
    }

    console.log('═══════════════════════════════════════════════════════════\n');

  } catch (error: any) {
    console.error('❌ Fatal error:', error);
    process.exit(1);
  }
}

checkAllBuckets().catch(err => {
  console.error('❌ Fatal error:', err);
  process.exit(1);
});
