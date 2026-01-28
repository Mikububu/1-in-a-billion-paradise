module.exports = {
  preset: 'jest-expo',
  testMatch: ['**/__tests__/**/*.test.[jt]s?(x)'],
  transformIgnorePatterns: [
    'node_modules/(?!(' +
      [
        'react-native',
        '@react-native',
        'expo(nent)?',
        'expo-modules-core',
        '@expo(nent)?/.*',
        '@expo-google-fonts/.*',
        'react-navigation',
        '@react-navigation/.*',
      ].join('|') +
      ')/)',
  ],
};

