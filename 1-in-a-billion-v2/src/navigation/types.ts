/**
 * TYPE-SAFE NAVIGATION HOOKS
 */

import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';

// Import param list types from RootNavigator
// These types should already be exported from RootNavigator.tsx
import type { MainStackParamList, OnboardingStackParamList } from './RootNavigator';

export type MainNavigationProp = NativeStackNavigationProp<MainStackParamList>;
export type OnboardingNavigationProp = NativeStackNavigationProp<OnboardingStackParamList>;

export function useMainNavigation() {
  return useNavigation<MainNavigationProp>();
}

export function useOnboardingNavigation() {
  return useNavigation<OnboardingNavigationProp>();
}
