const appJson = require('./app.json');

const isDevVariant = process.env.APP_VARIANT === 'dev';
const bundleId = isDevVariant ? 'com.oneinabillion.app.dev' : 'com.oneinabillion.app';
const appName = isDevVariant ? '1 In A Billion (Dev)' : appJson.expo.name;

module.exports = ({ config }) => {
  return {
    ...appJson.expo,
    ...config,
    name: appName,
    ios: {
      ...appJson.expo.ios,
      ...config.ios,
      bundleIdentifier: bundleId,
    },
    android: {
      ...appJson.expo.android,
      ...config.android,
      package: bundleId,
    },
    extra: {
      ...appJson.expo.extra,
      ...config.extra,
      eas: {
        projectId: appJson.expo.extra?.eas?.projectId || '3e4c2d65-6c4b-4d3c-9a2f-8e1b5c7d9f0a',
      },
    },
  };
};
