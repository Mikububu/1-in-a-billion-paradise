import { useState } from 'react';
import {
  TouchableOpacity,
  Text,
  StyleSheet,
  Modal,
  View,
  ScrollView,
  Pressable,
  Alert
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useOnboardingStore } from '@/store/onboardingStore';
import { useProfileStore } from '@/store/profileStore';
import { resetToOnboardingStart, navigateToScreen } from '@/navigation/navigationRef';
import { colors, typography, spacing, radii } from '@/theme/tokens';
import { supabase } from '@/services/supabase';



const ALL_SCREENS = [
  // Onboarding
  { name: 'SignIn', stack: 'onboarding' },
  { name: 'Relationship', stack: 'onboarding' },
  { name: 'BirthInfo', stack: 'onboarding' },
  { name: 'Languages', stack: 'onboarding' },
  { name: 'Account', stack: 'onboarding' },
  { name: 'CoreIdentities', stack: 'onboarding' },
  { name: 'HookSequence', stack: 'onboarding' },
  // Main
  { name: 'Home', stack: 'main' },
  { name: 'MyLibrary', stack: 'main' },
  { name: 'YourChart', stack: 'main' },
  { name: 'PartnerInfo', stack: 'main' },
  { name: 'PartnerCoreIdentities', stack: 'main' },
  { name: 'PartnerReadings', stack: 'main' },
  { name: 'SynastryPreview', stack: 'main' },
  { name: 'SynastryOptions', stack: 'main' },
  { name: 'ExtendedPrompt', stack: 'main' },
  { name: 'ExtendedReading', stack: 'main' },
  { name: 'FullReading', stack: 'main', params: { system: 'western' } },
  { name: 'CompleteReading', stack: 'main' },
  { name: 'ReadingSummary', stack: 'main', params: { person1Name: 'You', person2Name: 'Luna', overallScore: 7.5, wordCount: 4500 } },
  { name: 'PeopleList', stack: 'main' },
  { name: 'Purchase', stack: 'main', params: { mode: 'all' } },
  { name: 'WhyDifferent', stack: 'main' },
  // Settings
  { name: 'Settings', stack: 'main' },
  { name: 'PrivacyPolicy', stack: 'main' },
  { name: 'TermsOfService', stack: 'main' },
  { name: 'AccountDeletion', stack: 'main' },
  { name: 'DataPrivacy', stack: 'main' },
  { name: 'ContactSupport', stack: 'main' },
  { name: 'About', stack: 'main' },
];

export const DevResetButton = () => {
  const [showMenu, setShowMenu] = useState(false);
  const reset = useOnboardingStore((state) => state.reset);
  const resetProfile = useProfileStore((state) => state.reset);
  const setHasCompletedOnboarding = useOnboardingStore((state) => state.setHasCompletedOnboarding);
  const setBirthDate = useOnboardingStore((state) => state.setBirthDate);
  const setBirthTime = useOnboardingStore((state) => state.setBirthTime);
  const setBirthCity = useOnboardingStore((state) => state.setBirthCity);
  const setHookReading = useOnboardingStore((state) => state.setHookReading);
  const people = useProfileStore((state) => state.people);
  const updatePerson = useProfileStore((state) => state.updatePerson);

  const handleReset = () => {
    console.log('🔄 D - HARD RESET (both stores)');
    reset();
    resetProfile(); // Also clear people/partners
    setTimeout(() => {
      resetToOnboardingStart();
    }, 100);
  };


  // Single tap = go to onboarding start (SignIn) - FULL RESET
  const handleGoOnboardingStart = () => {
    console.log('🏠 H tap - FULL RESET (both stores)');
    reset();
    resetProfile(); // Also clear people/partners
    setTimeout(() => {
      resetToOnboardingStart();
    }, 100);
  };



  const handleLongPress = () => {
    setShowMenu(true);
  };

  const handleNavigate = (screen: typeof ALL_SCREENS[0]) => {
    setShowMenu(false);

    // If going to main stack, set onboarding complete
    if (screen.stack === 'main') {
      setHasCompletedOnboarding(true);
    }
    // Don't reset onboarding state when navigating to onboarding screens
    // This allows testing screen 1 without losing completed onboarding status

    setTimeout(() => {
      navigateToScreen(screen.name, screen.params);
    }, 150);
  };

  return (
    <>
      <TouchableOpacity
        style={styles.btn}
        onPress={handleGoOnboardingStart}
        onLongPress={handleLongPress}
        activeOpacity={0.7}
        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
      >
        <Text style={styles.text}>H</Text>
      </TouchableOpacity>

      <Modal
        visible={showMenu}
        transparent
        animationType="fade"
        onRequestClose={() => setShowMenu(false)}
      >
        <Pressable style={styles.overlay} onPress={() => setShowMenu(false)}>
          <Pressable style={styles.menu} onPress={(e) => e.stopPropagation()}>
            <Text style={styles.menuTitle}>Dev Menu</Text>



            <ScrollView style={styles.menuScroll}>
              <Text style={styles.sectionTitle}>Onboarding</Text>
              {ALL_SCREENS.filter(s => s.stack === 'onboarding').map((screen) => (
                <TouchableOpacity
                  key={screen.name}
                  style={styles.menuItem}
                  onPress={() => handleNavigate(screen)}
                >
                  <Text style={styles.menuItemText}>{screen.name}</Text>
                </TouchableOpacity>
              ))}

              <Text style={styles.sectionTitle}>Main</Text>
              {ALL_SCREENS.filter(s => s.stack === 'main').map((screen) => (
                <TouchableOpacity
                  key={screen.name}
                  style={styles.menuItem}
                  onPress={() => handleNavigate(screen)}
                >
                  <Text style={styles.menuItemText}>{screen.name}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            <TouchableOpacity
              style={styles.closeBtn}
              onPress={() => setShowMenu(false)}
            >
              <Text style={styles.closeBtnText}>Close</Text>
            </TouchableOpacity>
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
};

const styles = StyleSheet.create({
  btn: {
    position: 'absolute',
    top: 55,
    left: 16,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(0,0,0,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 99999,
    elevation: 999,
  },
  text: {
    fontFamily: typography.sansBold,
    fontSize: 16,
    fontWeight: '900',
    color: colors.text,
  },
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  menu: {
    width: '80%',
    maxHeight: '70%',
    backgroundColor: colors.background,
    borderRadius: radii.card,
    padding: spacing.lg,
  },
  menuTitle: {
    fontFamily: typography.serifBold,
    fontSize: 20,
    color: colors.text,
    textAlign: 'center',
    marginBottom: spacing.md,
  },
  devLoginRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: spacing.md,
    marginBottom: spacing.lg,
  },
  devLoginBtn: {
    backgroundColor: colors.primary,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.lg,
    borderRadius: radii.button,
    alignItems: 'center',
    minWidth: 100,
  },
  devLoginEmoji: {
    fontSize: 24,
    marginBottom: 2,
  },
  devLoginName: {
    fontFamily: typography.sansBold,
    fontSize: 12,
    color: '#FFF',
  },
  menuScroll: {
    maxHeight: 400,
  },
  sectionTitle: {
    fontFamily: typography.sansBold,
    fontSize: 12,
    color: colors.mutedText,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginTop: spacing.sm,
    marginBottom: spacing.xs,
  },
  menuItem: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.divider,
  },
  menuItemText: {
    fontFamily: typography.sansRegular,
    fontSize: 16,
    color: colors.text,
  },
  closeBtn: {
    marginTop: spacing.lg,
    backgroundColor: colors.primary,
    paddingVertical: spacing.sm,
    borderRadius: radii.button,
    alignItems: 'center',
  },
  closeBtnText: {
    fontFamily: typography.sansBold,
    fontSize: 14,
    color: '#FFF',
  },
});
