/**
 * KYC FACE SCAN SCREEN
 * 
 * Step 3: Live face scan to match with document photo.
 * Liveness detection (blink, turn head, smile).
 */

import { useState, useRef, useEffect } from 'react';
import { StyleSheet, Text, View, TouchableOpacity, Animated, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { colors, spacing, typography } from '@/theme/tokens';
import { Button } from '@/components/Button';
import { MainStackParamList } from '@/navigation/RootNavigator';

type Props = NativeStackScreenProps<MainStackParamList, 'KYCFaceScan'>;

const LIVENESS_CHECKS = [
  { id: 'center', instruction: 'Position your face in the circle', icon: '◯' },
  { id: 'blink', instruction: 'Blink slowly', icon: '👁' },
  { id: 'left', instruction: 'Turn your head left', icon: '←' },
  { id: 'right', instruction: 'Turn your head right', icon: '→' },
  { id: 'smile', instruction: 'Smile naturally', icon: '☺' },
];

export const KYCFaceScanScreen = ({ navigation }: Props) => {
  const [currentStep, setCurrentStep] = useState(0);
  const [isScanning, setIsScanning] = useState(false);
  const [isComplete, setIsComplete] = useState(false);
  
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const progressAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // Pulse animation for the face circle
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.05, duration: 1000, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1, duration: 1000, useNativeDriver: true }),
      ])
    ).start();
  }, []);

  const startScan = () => {
    setIsScanning(true);
    runLivenessChecks();
  };

  const runLivenessChecks = async () => {
    for (let i = 0; i < LIVENESS_CHECKS.length; i++) {
      setCurrentStep(i);
      
      // Animate progress
      Animated.timing(progressAnim, {
        toValue: (i + 1) / LIVENESS_CHECKS.length,
        duration: 500,
        useNativeDriver: false,
      }).start();
      
      // FAKE: Simulate each check taking 1.5 seconds
      await new Promise(resolve => setTimeout(resolve, 1500));
    }
    
    // Complete!
    setIsComplete(true);
    setIsScanning(false);
    
    // Auto-navigate after showing success
    setTimeout(() => {
      navigation.navigate('KYCComplete');
    }, 1500);
  };

  const currentCheck = LIVENESS_CHECKS[currentStep];

  return (
    <SafeAreaView style={styles.container}>
      <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
        <Text style={styles.backText}>← Back</Text>
      </TouchableOpacity>

      <View style={styles.content}>
        <Text style={styles.step}>Step 3 of 4</Text>
        <Text style={styles.title} selectable>Face Scan</Text>
        <Text style={styles.subtitle} selectable>
          We'll compare your face to your document photo
        </Text>

        {/* Face circle */}
        <View style={styles.scanArea}>
          <Animated.View 
            style={[
              styles.faceCircle,
              { transform: [{ scale: pulseAnim }] },
              isComplete && styles.faceCircleComplete,
            ]}
          >
            {isComplete ? (
              <Text style={styles.checkmark}>✓</Text>
            ) : (
              <Text style={styles.faceIcon}>
                {isScanning ? currentCheck.icon : '☺'}
              </Text>
            )}
          </Animated.View>
          
          {/* Progress ring */}
          {isScanning && (
            <View style={styles.progressRing}>
              <Animated.View 
                style={[
                  styles.progressFill,
                  {
                    width: progressAnim.interpolate({
                      inputRange: [0, 1],
                      outputRange: ['0%', '100%'],
                    }),
                  },
                ]} 
              />
            </View>
          )}
        </View>

        {/* Instructions */}
        <View style={styles.instructionBox}>
          {isComplete ? (
            <>
              <Text style={styles.successText}>Face verified!</Text>
              <Text style={styles.successSubtext}>Matches your document photo</Text>
            </>
          ) : isScanning ? (
            <>
              <Text style={styles.instructionText}>{currentCheck.instruction}</Text>
              <Text style={styles.stepCounter}>
                Step {currentStep + 1} of {LIVENESS_CHECKS.length}
              </Text>
            </>
          ) : (
            <>
              <Text style={styles.instructionText}>Position your face in good lighting</Text>
              <Text style={styles.instructionSubtext}>
                Remove glasses, hats, or anything covering your face
              </Text>
            </>
          )}
        </View>

        {/* Tips */}
        {!isScanning && !isComplete && (
          <View style={styles.tips}>
            <Text style={styles.tipItem}>• Good lighting on your face</Text>
            <Text style={styles.tipItem}>• Look directly at the camera</Text>
            <Text style={styles.tipItem}>• Keep a neutral expression to start</Text>
          </View>
        )}
      </View>

      {!isScanning && !isComplete && (
        <View style={styles.footer}>
          <Button label="Start Face Scan" onPress={startScan} />
        </View>
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  backButton: { paddingHorizontal: spacing.page, paddingVertical: spacing.sm, paddingLeft: 60 },
  backText: { fontFamily: typography.sansSemiBold, fontSize: 16, color: colors.text },
  content: { flex: 1, paddingHorizontal: spacing.page, paddingTop: spacing.lg, alignItems: 'center' },
  step: { fontFamily: typography.sansSemiBold, fontSize: 12, color: colors.primary, textTransform: 'uppercase', letterSpacing: 1, alignSelf: 'flex-start' },
  title: { fontFamily: typography.headline, fontSize: 32, color: colors.text, marginTop: spacing.sm, alignSelf: 'flex-start' },
  subtitle: { fontFamily: typography.sansRegular, fontSize: 16, color: colors.mutedText, marginTop: spacing.sm, alignSelf: 'flex-start' },

  scanArea: { marginTop: spacing.xl * 2, alignItems: 'center' },
  faceCircle: {
    width: 200,
    height: 200,
    borderRadius: 100,
    borderWidth: 3,
    borderColor: colors.primary,
    borderStyle: 'dashed',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.primarySoft,
  },
  faceCircleComplete: {
    borderStyle: 'solid',
    borderColor: colors.success,
    backgroundColor: 'rgba(16, 185, 129, 0.1)',
  },
  faceIcon: { fontSize: 64 },
  checkmark: { fontSize: 72, color: colors.success },
  
  progressRing: {
    position: 'absolute',
    bottom: -20,
    width: 160,
    height: 4,
    backgroundColor: colors.border,
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: colors.primary,
  },

  instructionBox: { marginTop: spacing.xl * 2, alignItems: 'center' },
  instructionText: { fontFamily: typography.sansSemiBold, fontSize: 18, color: colors.text, textAlign: 'center' },
  instructionSubtext: { fontFamily: typography.sansRegular, fontSize: 14, color: colors.mutedText, marginTop: spacing.xs, textAlign: 'center' },
  stepCounter: { fontFamily: typography.sansRegular, fontSize: 14, color: colors.primary, marginTop: spacing.sm },
  successText: { fontFamily: typography.sansSemiBold, fontSize: 24, color: colors.success },
  successSubtext: { fontFamily: typography.sansRegular, fontSize: 16, color: colors.mutedText, marginTop: spacing.xs },

  tips: { marginTop: spacing.xl, alignSelf: 'flex-start' },
  tipItem: { fontFamily: typography.sansRegular, fontSize: 14, color: colors.mutedText, marginTop: 4 },

  footer: { paddingHorizontal: spacing.page, paddingBottom: spacing.xl },
});








