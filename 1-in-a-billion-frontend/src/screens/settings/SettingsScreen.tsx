/**
 * SETTINGS SCREEN
 * 
 * Main hub for all app settings and legal requirements.
 * Apple App Store requires easy access to:
 * - Privacy Policy
 * - Terms of Service
 * - Account Deletion
 * - Data & Privacy controls
 */

import { StyleSheet, Text, View, ScrollView, TouchableOpacity, Alert, Linking } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { colors, spacing, typography, radii } from '@/theme/tokens';
import { MainStackParamList } from '@/navigation/RootNavigator';
import { useOnboardingStore } from '@/store/onboardingStore';
import { useProfileStore } from '@/store/profileStore';
import { useAuthStore } from '@/store/authStore';
import { useSubscriptionStore } from '@/store/subscriptionStore';

type Props = NativeStackScreenProps<MainStackParamList, 'Settings'>;

const screenId = '30'; // Settings

type SettingsItem = {
  id: string;
  icon: string;
  title: string;
  subtitle?: string;
  onPress: () => void;
  danger?: boolean;
};

type SettingsSection = {
  title: string;
  items: SettingsItem[];
};

export const SettingsScreen = ({ navigation }: Props) => {
  console.log(`📱 Screen ${screenId}: SettingsScreen`);
  const resetOnboarding = useOnboardingStore((state) => state.reset);
  const resetProfile = useProfileStore((state) => state.reset);
  const signOut = useAuthStore((s) => s.signOut);
  const resetSubscription = useSubscriptionStore((s) => s.reset);
  // Get verification status directly from user object (not via function)

  const people = useProfileStore((state) => state.people);
  const user = people.find(p => p.isUser);
  const isVerified = user?.isVerified || false;

  const handleStartOver = () => {
    Alert.alert(
      'Start Over',
      'This will log you out and clear all local data, returning you to the Intro screen.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Log Out',
          style: 'destructive',
          onPress: async () => {
            // CRITICAL: Sign out FIRST to clear Supabase session
            // Then reset stores (order matters to prevent race conditions)
            console.log('🚪 LOGOUT: Starting logout + reset process');
            await signOut();
            console.log('✅ LOGOUT: Supabase session cleared, now resetting stores');
            resetProfile();
            resetSubscription();
            resetOnboarding();
            console.log('✅ LOGOUT: All stores reset - NavigationContainer will remount');
            // NavigationContainer will automatically switch to OnboardingNavigator
          },
        },
      ]
    );
  };

  const handleLogout = () => {
    Alert.alert(
      'Log Out',
      'Are you sure you want to log out? Your data will be saved locally.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Log Out',
          style: 'destructive',
          onPress: async () => {
            await signOut();
            // NavigationContainer will automatically switch to OnboardingNavigator
          }
        },
      ]
    );
  };

  const handleRestorePurchases = async () => {
    // In production, this would call RevenueCat/StoreKit
    Alert.alert(
      'Restore Purchases',
      'Checking for previous purchases...',
      [{ text: 'OK' }]
    );
    // Simulate restore
    setTimeout(() => {
      Alert.alert('Complete', 'No previous purchases found to restore.');
    }, 1500);
  };

  const handleContactSupport = () => {
    Linking.openURL('mailto:support@oneinabillion.app?subject=App Support Request');
  };

  const sections: SettingsSection[] = [
    {
      title: 'Account',
      items: [
        {
          id: 'profile',
          icon: '◉',
          title: 'Your Profile',
          subtitle: isVerified ? 'Verified ✓' : 'Not verified',
          onPress: () => navigation.navigate('YourChart'),
        },
        {
          id: 'library',
          icon: '☰',
          title: 'My Library',
          subtitle: 'Readings, audio & saved content',
          onPress: () => navigation.navigate('MyLibrary'),
        },
        {
          id: 'notifications',
          icon: '○',
          title: 'Notifications',
          subtitle: 'Manage alerts and reminders',
          onPress: () => Alert.alert('Coming Soon', 'Notification settings will be available soon.'),
        },
      ],
    },
    {
      title: 'Purchases',
      items: [
        {
          id: 'restore',
          icon: '↻',
          title: 'Restore Purchases',
          subtitle: 'Recover previous purchases',
          onPress: handleRestorePurchases,
        },
      ],
    },
    {
      title: 'Privacy & Data',
      items: [
        {
          id: 'ai_disclosure',
          icon: '◎',
          title: 'AI & Data Usage',
          subtitle: 'How we use AI to create your readings',
          onPress: () => navigation.navigate('DataPrivacy'),
        },
        {
          id: 'privacy',
          icon: '▣',
          title: 'Privacy Policy',
          onPress: () => navigation.navigate('PrivacyPolicy'),
        },
        {
          id: 'terms',
          icon: '≡',
          title: 'Terms of Service',
          onPress: () => navigation.navigate('TermsOfService'),
        },
      ],
    },
    {
      title: 'Support',
      items: [
        {
          id: 'help',
          icon: '?',
          title: 'Help & FAQ',
          onPress: () => navigation.navigate('ContactSupport'),
        },
        {
          id: 'contact',
          icon: '→',
          title: 'Contact Us',
          subtitle: 'support@oneinabillion.app',
          onPress: handleContactSupport,
        },
        {
          id: 'about',
          icon: 'i',
          title: 'About',
          subtitle: 'Version 1.0.0',
          onPress: () => navigation.navigate('About'),
        },
      ],
    },
    {
      title: 'Account Actions',
      items: [
        {
          id: 'start_over',
          icon: '↺',
          title: 'Start Over',
          subtitle: 'Reset to Intro (Screen 1)',
          onPress: handleStartOver,
          danger: true,
        },
        {
          id: 'logout',
          icon: '←',
          title: 'Log Out',
          onPress: handleLogout,
        },
        {
          id: 'delete',
          icon: '×',
          title: 'Delete Account',
          subtitle: 'Permanently remove your data',
          onPress: () => navigation.navigate('AccountDeletion'),
          danger: true,
        },
      ],
    },
  ];

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Text style={styles.backText}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Settings</Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {sections.map((section) => (
          <View key={section.title} style={styles.section}>
            <Text style={styles.sectionTitle}>{section.title}</Text>
            <View style={styles.sectionContent}>
              {section.items.map((item, index) => (
                <TouchableOpacity
                  key={item.id}
                  style={[
                    styles.settingsItem,
                    index === section.items.length - 1 && styles.settingsItemLast,
                  ]}
                  onPress={item.onPress}
                  activeOpacity={0.7}
                >
                  <Text style={styles.itemIcon}>{item.icon}</Text>
                  <View style={styles.itemContent}>
                    <Text style={[styles.itemTitle, item.danger && styles.itemTitleDanger]}>
                      {item.title}
                    </Text>
                    {item.subtitle && (
                      <Text style={styles.itemSubtitle}>{item.subtitle}</Text>
                    )}
                  </View>
                  <Text style={styles.itemArrow}>→</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        ))}

        {/* Footer */}
        <View style={styles.footer}>
          <Text style={styles.footerText}>1 In A Billion</Text>
          <Text style={styles.footerVersion}>Version 1.0.0 (Build 1)</Text>
          {__DEV__ ? <Text style={styles.footerDev}>DEV 9bb6107</Text> : null}
          <Text style={styles.footerCopy}>© 2024 One In A Billion Ltd.</Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.page,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.divider,
  },
  backButton: {
    paddingVertical: spacing.xs,
  },
  backText: {
    fontFamily: typography.sansMedium,
    fontSize: 16,
    color: colors.primary,
  },
  headerTitle: {
    fontFamily: typography.headline,
    fontSize: 24,
    color: colors.text,
  },
  headerSpacer: {
    width: 60,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingVertical: spacing.lg,
  },
  section: {
    marginBottom: spacing.xl,
  },
  sectionTitle: {
    fontFamily: typography.sansSemiBold,
    fontSize: 12,
    color: colors.mutedText,
    textTransform: 'uppercase',
    letterSpacing: 1,
    paddingHorizontal: spacing.page,
    marginBottom: spacing.sm,
  },
  sectionContent: {
    backgroundColor: colors.surface,
    marginHorizontal: spacing.page,
    borderRadius: radii.card,
    borderWidth: 1,
    borderColor: colors.border,
  },
  settingsItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.divider,
  },
  settingsItemLast: {
    borderBottomWidth: 0,
  },
  itemIcon: {
    fontSize: 22,
    width: 36,
  },
  itemContent: {
    flex: 1,
  },
  itemTitle: {
    fontFamily: typography.sansSemiBold,
    fontSize: 16,
    color: colors.text,
  },
  itemTitleDanger: {
    color: colors.primary,
  },
  itemSubtitle: {
    fontFamily: typography.sansRegular,
    fontSize: 13,
    color: colors.mutedText,
    marginTop: 2,
  },
  itemArrow: {
    fontFamily: typography.sansMedium,
    fontSize: 18,
    color: colors.mutedText,
  },
  footer: {
    alignItems: 'center',
    paddingVertical: spacing.xl,
    paddingHorizontal: spacing.page,
  },
  footerText: {
    fontFamily: typography.headline,
    fontSize: 18,
    color: colors.text,
  },
  footerVersion: {
    fontFamily: typography.sansRegular,
    fontSize: 13,
    color: colors.mutedText,
    marginTop: spacing.xs,
  },
  footerCopy: {
    fontFamily: typography.sansRegular,
    fontSize: 12,
    color: colors.mutedText,
    marginTop: spacing.xs,
  },
  footerDev: {
    fontFamily: typography.sansBold,
    fontSize: 12,
    color: colors.mutedText,
    marginTop: spacing.xs,
    letterSpacing: 0.5,
  },
});




