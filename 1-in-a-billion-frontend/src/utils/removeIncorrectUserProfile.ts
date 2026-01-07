import AsyncStorage from '@react-native-async-storage/async-storage';

export async function removeIncorrectUserProfile() {
  try {
    console.log('🔍 Reading profile-storage from AsyncStorage...');
    
    const raw = await AsyncStorage.getItem('profile-storage');
    if (!raw) {
      console.log('❌ No profile-storage found');
      return { success: false, message: 'No data found' };
    }

    const parsed = JSON.parse(raw);
    const state = parsed?.state;
    
    if (!state || !Array.isArray(state.people)) {
      console.log('❌ Invalid profile-storage structure');
      return { success: false, message: 'Invalid structure' };
    }

    const users = state.people.filter((p) => p.isUser === true);
    
    console.log(`📊 Found ${users.length} user profile(s)`);
    
    if (users.length <= 1) {
      console.log('✅ Only one user profile exists, no cleanup needed');
      return { success: true, message: 'No duplicates found' };
    }

    // Find the correct profile: Virgo Sun | Leo Moon | Sagittarius Rising
    const correctProfile = users.find((user) => {
      const placements = user.placements;
      if (!placements) return false;
      
      const sunSign = placements.sunSign?.toLowerCase().trim();
      const moonSign = placements.moonSign?.toLowerCase().trim();
      const risingSign = placements.risingSign?.toLowerCase().trim();
      
      return sunSign === 'virgo' && 
             moonSign === 'leo' && 
             risingSign === 'sagittarius';
    });

    if (!correctProfile) {
      console.log('❌ Could not find the correct Virgo profile');
      console.log('Available profiles:');
      users.forEach((u, i) => {
        console.log(`  ${i + 1}. ${u.placements?.sunSign || 'Unknown'} Sun | ${u.placements?.moonSign || 'Unknown'} Moon | ${u.placements?.risingSign || 'Unknown'} Rising`);
      });
      return { success: false, message: 'Correct profile not found' };
    }

    console.log(`✅ Found correct profile: ${correctProfile.name} (ID: ${correctProfile.id})`);
    console.log(`   ☀️  Sun: ${correctProfile.placements.sunSign}`);
    console.log(`   🌙 Moon: ${correctProfile.placements.moonSign}`);
    console.log(`   ⬆️  Rising: ${correctProfile.placements.risingSign}`);

    // Remove all other user profiles
    const incorrectProfiles = users.filter((u) => u.id !== correctProfile.id);
    
    console.log(`
🗑️  Removing ${incorrectProfiles.length} incorrect profile(s):`);
    incorrectProfiles.forEach((u) => {
      console.log(`   - ${u.name} (ID: ${u.id})`);
      console.log(`     ${u.placements?.sunSign || 'Unknown'} Sun | ${u.placements?.moonSign || 'Unknown'} Moon | ${u.placements?.risingSign || 'Unknown'} Rising`);
    });

    // Filter out incorrect user profiles
    const cleanedPeople = state.people.filter((p) => {
      if (!p.isUser) return true; // Keep all non-user profiles
      return p.id === correctProfile.id; // Keep only the correct user profile
    });

    // Update state
    const updatedState = {
      ...state,
      people: cleanedPeople
    };

    const updatedData = {
      ...parsed,
      state: updatedState
    };

    // Save back to AsyncStorage
    await AsyncStorage.setItem('profile-storage', JSON.stringify(updatedData));
    
    console.log(`
✅ Cleanup complete!`);
    console.log(`   Kept: ${correctProfile.name} (Virgo Sun | Leo Moon | Sagittarius Rising)`);
    console.log(`   Removed: ${incorrectProfiles.length} duplicate profile(s)`);
    console.log(`   Total people remaining: ${cleanedPeople.length}`);
    
    return { 
      success: true, 
      message: `Removed ${incorrectProfiles.length} duplicate(s)`,
      keptProfile: correctProfile.name,
      removedCount: incorrectProfiles.length
    };
    
  } catch (error) {
    console.error('❌ Error during cleanup:', error);
    return { success: false, message: error.message };
  }
}