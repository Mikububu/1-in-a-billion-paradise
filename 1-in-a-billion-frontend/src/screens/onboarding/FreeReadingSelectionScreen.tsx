import React, { useState } from 'react';
import { StyleSheet, Text, View, TouchableOpacity, Alert, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { colors, spacing, typography } from '@/theme/tokens';
import { OnboardingStackParamList } from '@/navigation/RootNavigator';
import { useAuthStore } from '@/store/authStore';
import { useOnboardingStore } from '@/store/onboardingStore';
import { createIncludedReading } from '@/services/api';

type Props = NativeStackScreenProps<OnboardingStackParamList, 'FreeReadingSelection'>;

const SYSTEMS = [
  {
    id: 'western',
    name: 'Western Astrology',
    description: 'Your planets, houses, and aspects through the classical Western lens',
  },
  {
    id: 'vedic',
    name: 'Vedic Astrology',
    description: 'Ancient Jyotish wisdom revealing your dharma and life path',
  },
  {
    id: 'human_design',
    name: 'Human Design',
    description: 'Your energetic blueprint combining astrology, I-Ching, and Kabbalah',
  },
  {
    id: 'gene_keys',
    name: 'Gene Keys',
    description: 'Unlock your genetic genius and life purpose through 64 keys',
  },
  {
    id: 'kabbalah',
    name: 'Kabbalah',
    description: 'Mystical Jewish wisdom revealing your soul structure',
  },
];

export const FreeReadingSelectionScreen = ({ navigation, route }: Props) => {
  const [selectedSystem, setSelectedSystem] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  
  const user = useAuthStore((s) => s.user);
  const userData = useOnboardingStore((s) => s.userData);

  const handleSystemSelect = async (systemId: string) => {
    if (isCreating) return;
    
    setSelectedSystem(systemId);
    setIsCreating(true);

    try {
      if (!user?.id) {
        throw new Error('User not authenticated');
      }

      if (!userData.birthDate || !userData.birthTime) {
        throw new Error('Birth data not found');
      }

      console.log(`🎁 Creating included reading: ${systemId} for user ${user.id}`);

      // Create the job with useIncludedReading flag
      await createIncludedReading(user.id, systemId, {
        id: userData.id || user.id,
        name: userData.name,
        birthDate: userData.birthDate,
        birthTime: userData.birthTime,
        timezone: userData.timezone,
        latitude: userData.latitude,
        longitude: userData.longitude,
      });

      console.log('✅ Included reading job created successfully');

      // Navigate to MyLibrary where the job will appear
      const onboarding = useOnboardingStore.getState();
      onboarding.setRedirectAfterOnboarding('MyLibrary');
      onboarding.completeOnboarding();
      onboarding.setShowDashboard(true);

    } catch (error: any) {
      console.error('❌ Failed to create included reading:', error);
      setIsCreating(false);
      setSelectedSystem(null);
      
      Alert.alert(
        'Error',
        error.message || 'Failed to create your reading. Please try again.',
        [{ text: 'OK' }]
      );
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <View style={styles.topSection}>
          <Text style={styles.title} selectable>
            Choose Your{'\n'}Included Reading
          </Text>
          
          <Text style={styles.subtitle} selectable>
            Select one system for your free 15-20 minute personal reading
          </Text>

          <View style={styles.systemsList}>
            {SYSTEMS.map((system) => (
              <TouchableOpacity
                key={system.id}
                style={[
                  styles.systemCard,
                  selectedSystem === system.id && styles.systemCardSelected,
                ]}
                onPress={() => handleSystemSelect(system.id)}
                disabled={isCreating}
              >
                <Text style={styles.systemName}>{system.name}</Text>
                <Text style={styles.systemDescription}>{system.description}</Text>
                
                {selectedSystem === system.id && isCreating && (
                  <ActivityIndicator 
                    size="small" 
                    color={colors.accent} 
                    style={styles.spinner}
                  />
                )}
              </TouchableOpacity>
            ))}
          </View>
        </View>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  content: {
    flex: 1,
    paddingHorizontal: spacing.page,
    paddingTop: spacing.xxl * 2,
    paddingBottom: spacing.xl,
  },
  topSection: {
    width: '100%',
    alignItems: 'center',
  },
  title: {
    fontFamily: typography.headline,
    fontSize: 36,
    color: colors.text,
    textAlign: 'center',
    marginBottom: spacing.lg,
    lineHeight: 44,
  },
  subtitle: {
    fontFamily: typography.sansRegular,
    fontSize: 16,
    color: colors.mutedText,
    textAlign: 'center',
    marginBottom: spacing.xxl,
    lineHeight: 24,
  },
  systemsList: {
    width: '100%',
    gap: spacing.md,
  },
  systemCard: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    padding: spacing.lg,
    minHeight: 80,
  },
  systemCardSelected: {
    borderColor: colors.accent,
    borderWidth: 2,
  },
  systemName: {
    fontFamily: typography.serifBold,
    fontSize: 18,
    color: colors.text,
    marginBottom: spacing.xs,
  },
  systemDescription: {
    fontFamily: typography.sansRegular,
    fontSize: 14,
    color: colors.mutedText,
    lineHeight: 20,
  },
  spinner: {
    marginTop: spacing.sm,
  },
});
