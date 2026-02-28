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
      Home: 'home',
      Gallery: 'gallery',
      MyLibrary: 'library',
      ReadingDetail: 'reading/:readingId',
      PersonDetail: 'person/:personId',
      Settings: 'settings',
    },
  },
};
