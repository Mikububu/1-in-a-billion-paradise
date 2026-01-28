const AsyncStorage = require('@react-native-async-storage/async-storage');
(async () => {
  await AsyncStorage.clear();
  console.log('✅ AsyncStorage cleared');
})();
