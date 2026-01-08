/**
 * ACCOUNT DELETION SCREEN
 * 
 * Apple App Store MANDATORY since June 2022.
 * Apps with account creation MUST offer account deletion.
 * 
 * Requirements:
 * - Clear explanation of what data will be deleted
 * - Confirmation step
 * - Grace period (optional but recommended)
 * - Contact option for assistance
 */

import { useState } from 'react';
import { StyleSheet, Text, View, ScrollView, TouchableOpacity, Alert, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { colors, spacing, typography, radii } from '@/theme/tokens';
import { MainStackParamList } from '@/navigation/RootNavigator';
import { useOnboardingStore } from '@/store/onboardingStore';
import { useProfileStore } from '@/store/profileStore';
import { deleteAccount } from '@/services/accountDeletion';

type Props = NativeStackScreenProps<MainStackParamList, 'AccountDeletion'>;

export const AccountDeletionScreen = ({ navigation }: Props) => {
  const [isDeleting, setIsDeleting] = useState(false);

  const resetOnboarding = useOnboardingStore((state) => state.reset);
  const resetProfile = useProfileStore((state) => state.reset);

  const handleDeleteAccount = async () => {
    setIsDeleting(true);
    try {
      // Call backend API to permanently delete account
      await deleteAccount();

      // Clear local data
      resetOnboarding();
      resetProfile();

      Alert.alert(
        'Account Deleted',
        'Your account and all associated data have been permanently deleted.',
        [
          {
            text: 'OK',
            onPress: () => {
              // No need to navigate - signOut() already happened,
              // RootNavigator will automatically show OnboardingNavigator (Intro)
              // Just reset to clear the navigation stack
              navigation.reset({
                index: 0,
                routes: [{ name: 'Home' }],
              });
            },
          },
        ]
      );
    } catch (error: any) {
      console.error('Account deletion error:', error);
      Alert.alert(
        'Deletion Failed',
        error.message || 'Failed to delete account. Please try again or contact support.'
      );
    } finally {
      setIsDeleting(false);
    }
  };

  const handleContactSupport = () => {
    Alert.alert(
      'Contact Support',
      'For help with account deletion, please email:\n\nsupport@oneinabillion.app\n\nSubject: Account Deletion Request',
      [{ text: 'OK' }]
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Text style={styles.backText}>← Back</Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Title */}
        <Text style={styles.title}>Delete Account</Text>
        <Text style={styles.subtitle}>
          We're sad to see you go. Before you delete your account, please understand what will happen.
        </Text>

        {/* What Will Be Deleted */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>What Will Be Deleted</Text>

          <View style={styles.dataItem}>
            <Text style={styles.dataIcon}>◉</Text>
            <View style={styles.dataContent}>
              <Text style={styles.dataTitle}>Your Profile</Text>
              <Text style={styles.dataDesc}>Name, birth data, preferences</Text>
            </View>
          </View>

          <View style={styles.dataItem}>
            <Text style={styles.dataIcon}>≡</Text>
            <View style={styles.dataContent}>
              <Text style={styles.dataTitle}>All Readings</Text>
              <Text style={styles.dataDesc}>Generated astrological interpretations</Text>
            </View>
          </View>

          <View style={styles.dataItem}>
            <Text style={styles.dataIcon}>♪</Text>
            <View style={styles.dataContent}>
              <Text style={styles.dataTitle}>Audio Files</Text>
              <Text style={styles.dataDesc}>Narrated readings you've saved</Text>
            </View>
          </View>

          <View style={styles.dataItem}>
            <Text style={styles.dataIcon}>⊕</Text>
            <View style={styles.dataContent}>
              <Text style={styles.dataTitle}>People & Compatibility</Text>
              <Text style={styles.dataDesc}>Partners, friends, and overlay analyses</Text>
            </View>
          </View>

          <View style={styles.dataItem}>
            <Text style={styles.dataIcon}>◇</Text>
            <View style={styles.dataContent}>
              <Text style={styles.dataTitle}>Purchase History</Text>
              <Text style={styles.dataDesc}>Records of in-app purchases</Text>
            </View>
          </View>
        </View>

        {/* What Won't Be Deleted */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>What Won't Be Deleted</Text>
          <Text style={styles.infoText}>
            • Apple retains purchase transaction records (required by law){'\n'}
            • Anonymous, aggregated analytics data{'\n'}
            • Legal records we're required to keep for compliance
          </Text>
        </View>

        {/* Immediate Deletion Notice */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Immediate Deletion</Text>
          <Text style={styles.infoText}>
            When you confirm deletion, your account and all data will be permanently removed immediately. This action cannot be undone.
          </Text>
        </View>

        {/* Alternatives */}
        <View style={styles.alternativesSection}>
          <Text style={styles.sectionTitle}>Before You Go...</Text>

          <TouchableOpacity style={styles.alternativeButton} onPress={handleContactSupport}>
            <Text style={styles.alternativeIcon}>?</Text>
            <View style={styles.alternativeContent}>
              <Text style={styles.alternativeTitle}>Having Issues?</Text>
              <Text style={styles.alternativeDesc}>Our support team can help resolve problems</Text>
            </View>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.alternativeButton}
            onPress={() => navigation.navigate('Settings')}
          >
            <Text style={styles.alternativeIcon}>⚙</Text>
            <View style={styles.alternativeContent}>
              <Text style={styles.alternativeTitle}>Adjust Settings</Text>
              <Text style={styles.alternativeDesc}>Change preferences or notification settings</Text>
            </View>
          </TouchableOpacity>
        </View>

        {/* Delete Button */}
        <TouchableOpacity
          style={styles.requestDeleteButton}
          onPress={handleDeleteAccount}
          disabled={isDeleting}
        >
          <Text style={styles.requestDeleteText}>
            {isDeleting ? 'Deleting Account...' : 'Delete My Account'}
          </Text>
        </TouchableOpacity>

        <Text style={styles.disclaimer}>
          By requesting deletion, you confirm that you understand this action is permanent and cannot be undone.
        </Text>
      </ScrollView>

      {/* Full-screen blocking overlay during deletion */}
      {isDeleting && (
        <View style={styles.deletingOverlay}>
          <View style={styles.deletingBox}>
            <ActivityIndicator size="large" color={colors.primary} />
            <Text style={styles.deletingText}>Deleting your account...</Text>
            <Text style={styles.deletingSubtext}>This may take a few seconds</Text>
          </View>
        </View>
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
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
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: spacing.page,
    paddingVertical: spacing.xl,
  },
  title: {
    fontFamily: typography.headline,
    fontSize: 32,
    color: colors.primary,
    marginBottom: spacing.sm,
  },
  subtitle: {
    fontFamily: typography.sansRegular,
    fontSize: 16,
    color: colors.mutedText,
    lineHeight: 24,
    marginBottom: spacing.xl,
  },
  section: {
    marginBottom: spacing.xl,
  },
  sectionTitle: {
    fontFamily: typography.serifBold,
    fontSize: 18,
    color: colors.text,
    marginBottom: spacing.md,
  },
  dataItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: colors.surface,
    padding: spacing.md,
    borderRadius: radii.card,
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  dataIcon: {
    fontSize: 24,
    width: 40,
  },
  dataContent: {
    flex: 1,
  },
  dataTitle: {
    fontFamily: typography.sansSemiBold,
    fontSize: 15,
    color: colors.text,
  },
  dataDesc: {
    fontFamily: typography.sansRegular,
    fontSize: 13,
    color: colors.mutedText,
    marginTop: 2,
  },
  infoText: {
    fontFamily: typography.sansRegular,
    fontSize: 15,
    color: colors.text,
    lineHeight: 24,
  },
  alternativesSection: {
    backgroundColor: colors.surface,
    padding: spacing.lg,
    borderRadius: radii.card,
    marginBottom: spacing.xl,
    borderWidth: 1,
    borderColor: colors.border,
  },
  alternativeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.divider,
  },
  alternativeIcon: {
    fontSize: 24,
    width: 40,
  },
  alternativeContent: {
    flex: 1,
  },
  alternativeTitle: {
    fontFamily: typography.sansSemiBold,
    fontSize: 15,
    color: colors.text,
  },
  alternativeDesc: {
    fontFamily: typography.sansRegular,
    fontSize: 13,
    color: colors.mutedText,
    marginTop: 2,
  },
  requestDeleteButton: {
    backgroundColor: colors.primary,
    paddingVertical: spacing.lg,
    borderRadius: radii.button,
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  requestDeleteText: {
    fontFamily: typography.sansSemiBold,
    fontSize: 16,
    color: '#fff',
  },
  disclaimer: {
    fontFamily: typography.sansRegular,
    fontSize: 12,
    color: colors.mutedText,
    textAlign: 'center',
    lineHeight: 18,
  },
  deletingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.85)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 9999,
  },
  deletingBox: {
    backgroundColor: colors.surface,
    borderRadius: radii.card,
    padding: spacing.xl,
    alignItems: 'center',
    minWidth: 250,
    borderWidth: 1,
    borderColor: colors.border,
  },
  deletingText: {
    fontFamily: typography.sansSemiBold,
    fontSize: 18,
    color: colors.text,
    marginTop: spacing.md,
    textAlign: 'center',
  },
  deletingSubtext: {
    fontFamily: typography.sansRegular,
    fontSize: 14,
    color: colors.mutedText,
    marginTop: spacing.xs,
    textAlign: 'center',
  },
});




