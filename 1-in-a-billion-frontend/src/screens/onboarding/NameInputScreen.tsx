import React, { useState } from 'react';
import { StyleSheet, Text, View, TextInput, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { colors, spacing, typography } from '@/theme/tokens';
import { Button } from '@/components/Button';
import { OnboardingStackParamList } from '@/navigation/RootNavigator';
import { useAuthStore } from '@/store/authStore';

type Props = NativeStackScreenProps<OnboardingStackParamList, 'NameInput'>;

export const NameInputScreen = ({ navigation, route }: Props) => {
  const [name, setName] = useState('');
  const setDisplayName = useAuthStore((s) => s.setDisplayName);
  const postPurchase = route?.params?.postPurchase;

  const handleContinue = () => {
    const trimmedName = name.trim();
    
    if (!trimmedName) {
      Alert.alert('Name Required', 'Please enter your name to continue.');
      return;
    }

    // Extract first name only (in case they enter full name)
    const firstName = trimmedName.split(' ')[0];
    
    // Store the chosen name
    setDisplayName(firstName);
    
    // Proceed to Account screen for OAuth sign-in
    navigation.replace('Account', { postPurchase });
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <View style={styles.topSection}>
          <Text style={styles.title} selectable>
            The name you wish{'\n'}to be known by
          </Text>
          
          <TextInput
            style={styles.input}
            value={name}
            onChangeText={setName}
            placeholder="Your first name"
            placeholderTextColor={colors.mutedText}
            autoCapitalize="words"
            autoCorrect={false}
            autoFocus
            returnKeyType="done"
            onSubmitEditing={handleContinue}
          />
        </View>

        <Button
          label="Continue"
          onPress={handleContinue}
          variant="primary"
          style={styles.button}
        />
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
    justifyContent: 'space-between',
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
    marginBottom: spacing.xxl,
    lineHeight: 44,
  },
  input: {
    width: '100%',
    maxWidth: 400,
    fontFamily: typography.sansRegular,
    fontSize: 20,
    color: colors.text,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    textAlign: 'center',
  },
  button: {
    width: '100%',
  },
});
