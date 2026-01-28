/**
 * DIAGNOSTIC SCRIPT: Inspect User Profiles
 * 
 * This script reads the persisted profileStore from AsyncStorage
 * and displays all isUser: true profiles with their calculated placements.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

async function inspectUserProfiles() {
  try {
    console.log('🔍 Reading profile-storage from AsyncStorage...\n');
    
    const raw = await AsyncStorage.getItem('profile-storage');
    if (!raw) {
      console.log('❌ No profile-storage found in AsyncStorage');
      return;
    }

    const parsed = JSON.parse(raw);
    const state = parsed?.state;
    
    if (!state || !Array.isArray(state.people)) {
      console.log('❌ Invalid profile-storage structure');
      return;
    }

    const users = state.people.filter((p: any) => p.isUser === true);
    
    console.log(`📊 Found ${users.length} user profile(s) with isUser: true\n`);
    
    users.forEach((user: any, index: number) => {
      console.log(`\n========== USER PROFILE #${index + 1} ==========`);
      console.log(`ID: ${user.id}`);
      console.log(`Name: ${user.name}`);
      console.log(`Created: ${user.createdAt}`);
      console.log(`Updated: ${user.updatedAt}`);
      console.log(`\nBirth Data:`);
      console.log(`  Date: ${user.birthData?.birthDate}`);
      console.log(`  Time: ${user.birthData?.birthTime}`);
      console.log(`  City: ${user.birthData?.birthCity}`);
      console.log(`  Timezone: ${user.birthData?.timezone}`);
      console.log(`  Lat/Lon: ${user.birthData?.latitude}, ${user.birthData?.longitude}`);
      
      if (user.placements) {
        console.log(`\nCalculated Placements:`);
        console.log(`  ☀️  Sun: ${user.placements.sunSign} ${user.placements.sunDegree || ''}`);
        console.log(`  🌙 Moon: ${user.placements.moonSign} ${user.placements.moonDegree || ''}`);
        console.log(`  ⬆️  Rising: ${user.placements.risingSign} ${user.placements.risingDegree || ''}`);
      } else {
        console.log(`\n⚠️  No placements calculated`);
      }
      
      console.log(`\nReadings: ${user.readings?.length || 0}`);
      console.log(`Hook Readings: ${user.hookReadings?.length || 0}`);
      console.log(`==========================================`);
    });
    
    console.log(`\n\n✅ Inspection complete`);
    
  } catch (error) {
    console.error('❌ Error inspecting profiles:', error);
  }
}

inspectUserProfiles();
