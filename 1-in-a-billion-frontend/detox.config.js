/** @type {Detox.DetoxConfig} */
module.exports = {
  testRunner: {
    args: {
      '$0': 'jest',
      config: 'e2e/jest.config.js',
    },
    jest: {
      setupTimeout: 120000,
    },
  },
  apps: {
    'ios.debug': {
      type: 'ios.app',
      // NOTE: You will need to build the iOS app (dev-client) for Detox.
      // This is intentionally left as a placeholder until we add a stable build step.
      binaryPath: 'ios/build/Build/Products/Debug-iphonesimulator/1-in-a-billion-frontend.app',
      build:
        'echo "Detox build step not yet wired. Build a debug simulator app, then re-run." && exit 1',
    },
  },
  devices: {
    simulator: {
      type: 'ios.simulator',
      device: {
        type: 'iPhone 15',
      },
    },
  },
  configurations: {
    'ios.debug': {
      device: 'simulator',
      app: 'ios.debug',
    },
  },
};

