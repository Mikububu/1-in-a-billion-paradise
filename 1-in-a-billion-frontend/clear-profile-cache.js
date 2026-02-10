/**
 * Script to clear profile cache from AsyncStorage
 * Run this in React Native Debugger or add as a dev menu option
 * 
 * This will force the app to re-fetch all people data from Supabase
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

async function clearProfileCache() {
  try {
    console.log('🗑️ Clearing profile cache from AsyncStorage...');
    
    // Clear the profile store
    await AsyncStorage.removeItem('profile-storage');
    
    console.log('✅ Profile cache cleared!');
    console.log('💡 Reload the app to fetch fresh data from Supabase');
    
    return { success: true };
  } catch (error) {
    console.error('❌ Error clearing cache:', error);
    return { success: false, error: error.message };
  }
}

// Export for use in dev menu or console
if (typeof global !== 'undefined') {
  global.clearProfileCache = clearProfileCache;
}

export default clearProfileCache;
