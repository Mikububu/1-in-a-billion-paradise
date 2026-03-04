/**
 * DEEP LINKING CONFIGURATION
 */

import { LinkingOptions } from '@react-navigation/native';
import * as Linking from 'expo-linking';

const prefix = Linking.createURL('/');

export const linking: LinkingOptions<any> = {
  prefixes: [prefix, 'oneinabillion://', 'https://1-in-a-billion.app'],
  config: {
    screens: {
      Onboarding: {
        screens: {
          ResetPassword: 'auth/reset-password',
          SignIn: 'auth/callback',
        },
      },
      Main: {
        screens: {
          Home: 'home',
          Gallery: 'gallery',
          MyLibrary: 'library',
          Settings: 'settings',
        },
      },
    },
  },
};
