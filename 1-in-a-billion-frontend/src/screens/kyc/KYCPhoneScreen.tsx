/**
 * KYC PHONE VERIFICATION SCREEN
 * 
 * Step 1: Phone number + SMS OTP verification.
 * Fake API for now - will connect to Twilio later.
 */

import { useState, useRef } from 'react';
import { StyleSheet, Text, View, TextInput, TouchableOpacity, Alert, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { colors, spacing, typography, radii } from '@/theme/tokens';
import { Button } from '@/components/Button';
import { BackButton } from '@/components/BackButton';
import { MainStackParamList } from '@/navigation/RootNavigator';

type Props = NativeStackScreenProps<MainStackParamList, 'KYCPhone'>;

export const KYCPhoneScreen = ({ navigation }: Props) => {
  const [phone, setPhone] = useState('');
  const [codeSent, setCodeSent] = useState(false);
  const [code, setCode] = useState(['', '', '', '', '', '']);
  const [isLoading, setIsLoading] = useState(false);
  const codeInputs = useRef<(TextInput | null)[]>([]);

  const handleSendCode = async () => {
    if (phone.length < 8) {
      Alert.alert('Invalid Number', 'Please enter a valid phone number.');
      return;
    }

    setIsLoading(true);
    
    // FAKE API - will replace with Twilio
    await new Promise(resolve => setTimeout(resolve, 1500));
    
    setIsLoading(false);
    setCodeSent(true);
    Alert.alert('Code Sent', `We sent a 6-digit code to ${phone}. (DEV: Use 123456)`);
  };

  const handleCodeChange = (text: string, index: number) => {
    const newCode = [...code];
    newCode[index] = text;
    setCode(newCode);

    // Auto-advance to next input
    if (text && index < 5) {
      codeInputs.current[index + 1]?.focus();
    }
  };

  const handleVerify = async () => {
    const fullCode = code.join('');
    
    if (fullCode.length !== 6) {
      Alert.alert('Incomplete Code', 'Please enter the full 6-digit code.');
      return;
    }

    setIsLoading(true);
    
    // FAKE API - accept any code for now, or specifically 123456
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    setIsLoading(false);
    
    if (fullCode === '123456' || fullCode.length === 6) {
      // Success - move to document upload
      navigation.navigate('KYCDocument');
    } else {
      Alert.alert('Invalid Code', 'The code you entered is incorrect. Please try again.');
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <BackButton onPress={() => navigation.goBack()} />

      <View style={styles.content}>
        <Text style={styles.step}>Step 1 of 3</Text>
        <Text style={styles.title} selectable>Phone Verification</Text>
        <Text style={styles.subtitle} selectable>
          We'll send you a code to verify your number. This helps us keep the community safe.
        </Text>

        {!codeSent ? (
          <View style={styles.inputSection}>
            <Text style={styles.label}>Your phone number</Text>
            <TextInput
              style={styles.phoneInput}
              value={phone}
              onChangeText={setPhone}
              placeholder="+1 234 567 8900"
              placeholderTextColor={colors.mutedText}
              keyboardType="phone-pad"
              autoFocus
            />
            <Button 
              label={isLoading ? "Sending..." : "Send Code"} 
              onPress={handleSendCode}
              loading={isLoading}
            />
          </View>
        ) : (
          <View style={styles.inputSection}>
            <Text style={styles.label}>Enter the 6-digit code</Text>
            <View style={styles.codeContainer}>
              {code.map((digit, index) => (
                <TextInput
                  key={index}
                  ref={(ref) => { codeInputs.current[index] = ref; }}
                  style={styles.codeInput}
                  value={digit}
                  onChangeText={(text) => handleCodeChange(text, index)}
                  keyboardType="number-pad"
                  maxLength={1}
                  selectTextOnFocus
                />
              ))}
            </View>
            <Button 
              label={isLoading ? "Verifying..." : "Verify"} 
              onPress={handleVerify}
              loading={isLoading}
            />
            <TouchableOpacity style={styles.resendButton} onPress={handleSendCode}>
              <Text style={styles.resendText}>Didn't receive code? Send again</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: 'transparent' },
  content: { flex: 1, paddingHorizontal: spacing.page, paddingTop: spacing.xl },
  step: { fontFamily: typography.sansSemiBold, fontSize: 12, color: colors.primary, textTransform: 'uppercase', letterSpacing: 1 },
  title: { fontFamily: typography.headline, fontSize: 32, color: colors.text, marginTop: spacing.sm },
  subtitle: { fontFamily: typography.sansRegular, fontSize: 16, color: colors.mutedText, marginTop: spacing.sm, lineHeight: 24 },
  inputSection: { marginTop: spacing.xl },
  label: { fontFamily: typography.sansSemiBold, fontSize: 14, color: colors.text, marginBottom: spacing.sm },
  phoneInput: {
    fontFamily: typography.sansRegular,
    fontSize: 20,
    color: colors.text,
    borderWidth: 1,
    borderColor: colors.inputStroke,
    borderRadius: radii.card,
    backgroundColor: colors.inputBg,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    marginBottom: spacing.lg,
  },
  codeContainer: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: spacing.lg },
  codeInput: {
    width: 48,
    height: 56,
    borderWidth: 1,
    borderColor: colors.inputStroke,
    borderRadius: radii.card,
    backgroundColor: colors.inputBg,
    textAlign: 'center',
    fontFamily: typography.sansBold,
    fontSize: 24,
    color: colors.text,
  },
  resendButton: { marginTop: spacing.lg, alignItems: 'center' },
  resendText: { fontFamily: typography.sansRegular, fontSize: 14, color: colors.primary, textDecorationLine: 'underline' },
});

