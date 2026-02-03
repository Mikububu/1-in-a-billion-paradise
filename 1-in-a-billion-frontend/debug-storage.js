/**
 * DEBUG STORAGE INSPECTOR
 * 
 * Run this in the iOS Simulator to see exactly what's in AsyncStorage
 * 
 * Usage:
 * 1. Open app in simulator
 * 2. Open Safari Developer Tools
 * 3. Connect to simulator
 * 4. Paste this code in console
 */

const AsyncStorage = require('@react-native-async-storage/async-storage').default;

(async () => {
  try {
    console.log('🔍 Inspecting AsyncStorage...\n');
    
    // Get all keys
    const keys = await AsyncStorage.getAllKeys();
    console.log(`📦 Found ${keys.length} keys:`, keys);
    console.log('\n');
    
    // Get profile-storage (where profileStore persists)
    const profileData = await AsyncStorage.getItem('profile-storage');
    
    if (profileData) {
      console.log('📂 PROFILE-STORAGE CONTENTS:');
      console.log('═'.repeat(60));
      
      const parsed = JSON.parse(profileData);
      const state = parsed?.state || parsed;
      
      console.log('📊 Store version:', parsed?.version || 'unknown');
      console.log('👥 People count:', state?.people?.length || 0);
      console.log('\n');
      
      if (state?.people && state.people.length > 0) {
        console.log('👤 PEOPLE IN STORAGE:');
        state.people.forEach((person, idx) => {
          console.log(`\n  [${idx}] ${person.name}`);
          console.log(`      ID: ${person.id}`);
          console.log(`      IsUser: ${person.isUser}`);
          console.log(`      Email?: ${person.email || 'N/A'}`);
          console.log(`      Birth Date: ${person.birthData?.birthDate || 'N/A'}`);
          console.log(`      Placements: ${person.placements?.sunSign || 'NONE'} / ${person.placements?.moonSign || 'NONE'} / ${person.placements?.risingSign || 'NONE'}`);
          console.log(`      Created: ${person.createdAt}`);
        });
      }
      
      console.log('\n');
      console.log('═'.repeat(60));
      console.log('🎯 FOUND THE BEAST!');
      console.log('Location: AsyncStorage -> "profile-storage" -> state.people[]');
      console.log('Path: ~/Library/Developer/CoreSimulator/Devices/[DEVICE_ID]/data/Containers/Data/Application/[APP_ID]/Library/Application Support/[APP_NAME]/RCTAsyncLocalStorage');
    } else {
      console.log('❌ No profile-storage found!');
    }
    
    // Check auth-storage too
    const authData = await AsyncStorage.getItem('auth-storage');
    if (authData) {
      console.log('\n🔐 AUTH-STORAGE:');
      const authParsed = JSON.parse(authData);
      const authState = authParsed?.state || authParsed;
      console.log('  Display Name:', authState?.displayName || 'N/A');
      console.log('  User ID:', authState?.user?.id || 'N/A');
    }
    
  } catch (err) {
    console.error('❌ Error:', err);
  }
})();

