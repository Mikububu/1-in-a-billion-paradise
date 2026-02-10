/**
 * Check if notification tables exist in Supabase
 */

import { createSupabaseServiceClient } from './src/services/supabaseClient';
import { config } from 'dotenv';
import { join } from 'path';

config({ path: join(__dirname, '.env') });

async function checkNotificationTables() {
  const supabase = createSupabaseServiceClient();

  if (!supabase) {
    console.error('❌ Supabase not configured');
    process.exit(1);
  }

  console.log('🔍 Checking notification tables...\n');

  // Check user_push_tokens table
  try {
    const { data, error } = await supabase
      .from('user_push_tokens')
      .select('id')
      .limit(1);

    if (error) {
      if (error.code === '42P01') { // Table doesn't exist
        console.log('❌ user_push_tokens table does NOT exist');
      } else {
        console.log(`⚠️  user_push_tokens table exists but error: ${error.message}`);
      }
    } else {
      console.log('✅ user_push_tokens table exists');
    }
  } catch (e: any) {
    console.log(`❌ Error checking user_push_tokens: ${e.message}`);
  }

  // Check job_notification_subscriptions table
  try {
    const { data, error } = await supabase
      .from('job_notification_subscriptions')
      .select('id')
      .limit(1);

    if (error) {
      if (error.code === '42P01') { // Table doesn't exist
        console.log('❌ job_notification_subscriptions table does NOT exist');
        console.log('\n📋 To fix this, apply migration 016:');
        console.log('   1. Open Supabase Dashboard → SQL Editor');
        console.log('   2. Copy the contents of: migrations/016_push_notifications.sql');
        console.log('   3. Paste and run it in the SQL Editor');
      } else {
        console.log(`⚠️  job_notification_subscriptions table exists but error: ${error.message}`);
      }
    } else {
      console.log('✅ job_notification_subscriptions table exists');
    }
  } catch (e: any) {
    console.log(`❌ Error checking job_notification_subscriptions: ${e.message}`);
  }

  // Check if functions exist
  try {
    const { data, error } = await supabase.rpc('get_pending_notifications', { 
      p_job_id: '00000000-0000-0000-0000-000000000000' 
    });
    
    if (error) {
      if (error.message.includes('does not exist')) {
        console.log('\n❌ get_pending_notifications function does NOT exist');
      } else {
        console.log(`\n⚠️  get_pending_notifications function exists (test call returned expected error)`);
      }
    } else {
      console.log('\n✅ get_pending_notifications function exists');
    }
  } catch (e: any) {
    console.log(`\n⚠️  Could not test get_pending_notifications function: ${e.message}`);
  }
}

checkNotificationTables().catch(console.error);
