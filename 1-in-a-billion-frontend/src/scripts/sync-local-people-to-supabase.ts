/**
 * SYNC LOCAL PEOPLE TO SUPABASE
 * 
 * This script reads people from your local AsyncStorage and syncs them to Supabase
 * for your currently logged-in account.
 * 
 * Safe to run - uses upsert so won't create duplicates.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { syncPeopleToSupabase } from '../services/peopleCloud';
import { supabase } from '../services/supabase';

async function syncLocalPeopleToSupabase() {
  console.log('🔄 Starting local people sync to Supabase...\n');

  // 1. Get current user
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  
  if (authError || !user) {
    console.error('❌ Not logged in or auth error:', authError?.message);
    return;
  }

  console.log(`✅ Logged in as: ${user.email}`);
  console.log(`   User ID: ${user.id}\n`);

  // 2. Read profileStore from AsyncStorage
  const storeKey = 'profile-storage';
  const rawData = await AsyncStorage.getItem(storeKey);
  
  if (!rawData) {
    console.error('❌ No profile data found in AsyncStorage');
    return;
  }

  const storeData = JSON.parse(rawData);
  const people = storeData?.state?.people || [];

  if (people.length === 0) {
    console.log('⚠️  No people found in local storage');
    return;
  }

  console.log(`📦 Found ${people.length} people in local storage:\n`);
  
  let portraitCount = 0;
  
  people.forEach((person: any, index: number) => {
    const hasPortrait = Boolean(person.portraitUrl);
    if (hasPortrait) portraitCount++;
    
    console.log(`   ${index + 1}. ${person.name} ${person.isUser ? '(YOU)' : ''}`);
    console.log(`      ID: ${person.id}`);
    console.log(`      Birth: ${person.birthData?.birthDate || 'N/A'}`);
    console.log(`      Placements: ${person.placements ? 'Yes' : 'No'}`);
    console.log(`      Hook Readings: ${person.hookReadings ? 'Yes' : 'No'}`);
    console.log(`      Portrait: ${hasPortrait ? '✅ ' + person.portraitUrl : '❌ MISSING'}`);
    if (person.originalPhotoUrl) {
      console.log(`      Original Photo: ✅ ${person.originalPhotoUrl}`);
    }
    console.log('');
  });
  
  console.log(`📸 Portrait Summary: ${portraitCount} out of ${people.length} people have portraits\n`);

  // 3. Sync to Supabase
  console.log('📤 Syncing to Supabase...\n');
  
  const result = await syncPeopleToSupabase(user.id, people);
  
  if (result.success) {
    console.log('✅ Successfully synced all people to Supabase!');
    console.log(`   ${people.length} people now available in the cloud`);
  } else {
    console.error('❌ Sync failed:', result.error);
  }
}

// Run the script
syncLocalPeopleToSupabase()
  .then(() => {
    console.log('\n✨ Script complete');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n💥 Script error:', error);
    process.exit(1);
  });
