/**
 * KYC PHOTO VERIFICATION SCREEN
 * 
 * Step 2: Selfie + pose verification.
 * Ensures real person, not a photo of a photo.
 * Fake API for now - will connect to verification service later.
 */

import { useState } from 'react';
import { StyleSheet, Text, View, TouchableOpacity, Image, Alert, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { colors, spacing, typography, radii } from '@/theme/tokens';
import { Button } from '@/components/Button';
import { MainStackParamList } from '@/navigation/RootNavigator';
import { BackButton } from '@/components/BackButton';

// Lazy load expo-image-picker
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let ImagePicker: any = null;
try {
  ImagePicker = require('expo-image-picker');
} catch (e) {
  console.warn('expo-image-picker not available');
}

type Props = NativeStackScreenProps<MainStackParamList, 'KYCPhoto'>;

const POSES = [
  { id: 'smile', instruction: 'Smile naturally', emoji: '😊' },
  { id: 'turn_left', instruction: 'Turn your head slightly left', emoji: '👈' },
  { id: 'peace', instruction: 'Show a peace sign', emoji: '✌️' },
];

export const KYCPhotoScreen = ({ navigation }: Props) => {
  const [currentPose, setCurrentPose] = useState(0);
  const [photos, setPhotos] = useState<(string | null)[]>([null, null, null]);
  const [isVerifying, setIsVerifying] = useState(false);

  const takePhoto = async () => {
    // DEV: If ImagePicker not available, use placeholder
    if (!ImagePicker) {
      const placeholderUri = `https://via.placeholder.com/200/cccccc/666666?text=Photo+${currentPose + 1}`;
      const newPhotos = [...photos];
      newPhotos[currentPose] = placeholderUri;
      setPhotos(newPhotos);
      if (currentPose < 2) {
        setCurrentPose(currentPose + 1);
      }
      return;
    }

    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    
    if (status !== 'granted') {
      Alert.alert('Camera Required', 'We need camera access to verify your identity.');
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });

    if (!result.canceled && result.assets[0]) {
      const newPhotos = [...photos];
      newPhotos[currentPose] = result.assets[0].uri;
      setPhotos(newPhotos);

      // Auto-advance to next pose
      if (currentPose < 2) {
        setCurrentPose(currentPose + 1);
      }
    }
  };

  const handleVerify = async () => {
    if (photos.some(p => !p)) {
      Alert.alert('Photos Required', 'Please take all 3 verification photos.');
      return;
    }

    setIsVerifying(true);

    // FAKE API - simulating verification
    await new Promise(resolve => setTimeout(resolve, 2500));

    setIsVerifying(false);

    // In real implementation, send photos to verification API
    // For now, always succeed
    navigation.navigate('KYCComplete');
  };

  const pose = POSES[currentPose];
  const allPhotosTaken = photos.every(p => p !== null);

  return (
    <SafeAreaView style={styles.container}>
      <BackButton onPress={() => navigation.goBack()} />

      <View style={styles.content}>
        <Text style={styles.step}>Step 2 of 3</Text>
        <Text style={styles.title} selectable>Photo Verification</Text>
        <Text style={styles.subtitle} selectable>
          We need 3 quick selfies to confirm you're real. This protects everyone in our community.
        </Text>

        {/* Progress dots */}
        <View style={styles.progressDots}>
          {POSES.map((_, idx) => (
            <View 
              key={idx} 
              style={[
                styles.dot, 
                photos[idx] ? styles.dotComplete : (idx === currentPose ? styles.dotActive : {})
              ]} 
            />
          ))}
        </View>

        {/* Current photo preview or instruction */}
        <View style={styles.photoSection}>
          {allPhotosTaken ? (
            <View style={styles.photoGrid}>
              {photos.map((uri, idx) => (
                <Image key={idx} source={{ uri: uri! }} style={styles.photoThumb} />
              ))}
            </View>
          ) : (
            <View style={styles.instructionCard}>
              <Text style={styles.poseEmoji}>{pose.emoji}</Text>
              <Text style={styles.poseInstruction}>{pose.instruction}</Text>
              <Text style={styles.poseTip}>
                Make sure your face is clearly visible and well-lit
              </Text>
            </View>
          )}
        </View>

        {/* Photo preview thumbnails */}
        {!allPhotosTaken && (
          <View style={styles.thumbnails}>
            {photos.map((uri, idx) => (
              <TouchableOpacity 
                key={idx} 
                style={[styles.thumbnail, idx === currentPose && styles.thumbnailActive]}
                onPress={() => setCurrentPose(idx)}
              >
                {uri ? (
                  <Image source={{ uri }} style={styles.thumbnailImage} />
                ) : (
                  <Text style={styles.thumbnailNumber}>{idx + 1}</Text>
                )}
              </TouchableOpacity>
            ))}
          </View>
        )}
      </View>

      <View style={styles.footer}>
        {allPhotosTaken ? (
          <Button 
            label={isVerifying ? "Verifying..." : "Complete Verification"} 
            onPress={handleVerify}
            loading={isVerifying}
          />
        ) : (
          <Button 
            label={`Take Photo ${currentPose + 1} of 3`} 
            onPress={takePhoto}
          />
        )}
        
        {allPhotosTaken && (
          <TouchableOpacity 
            style={styles.retakeButton} 
            onPress={() => { setPhotos([null, null, null]); setCurrentPose(0); }}
          >
            <Text style={styles.retakeText}>Retake photos</Text>
          </TouchableOpacity>
        )}
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  backButton: { paddingHorizontal: spacing.page, paddingVertical: spacing.sm, paddingLeft: 60 },
  backText: { fontFamily: typography.sansSemiBold, fontSize: 16, color: colors.text },
  content: { flex: 1, paddingHorizontal: spacing.page, paddingTop: spacing.xl },
  step: { fontFamily: typography.sansSemiBold, fontSize: 12, color: colors.primary, textTransform: 'uppercase', letterSpacing: 1 },
  title: { fontFamily: typography.headline, fontSize: 32, color: colors.text, marginTop: spacing.sm },
  subtitle: { fontFamily: typography.sansRegular, fontSize: 16, color: colors.mutedText, marginTop: spacing.sm, lineHeight: 24 },
  
  progressDots: { flexDirection: 'row', justifyContent: 'center', marginTop: spacing.lg, gap: spacing.sm },
  dot: { width: 10, height: 10, borderRadius: 5, backgroundColor: colors.border },
  dotActive: { backgroundColor: colors.primary, width: 24 },
  dotComplete: { backgroundColor: colors.primary },
  
  photoSection: { flex: 1, justifyContent: 'center', alignItems: 'center', marginTop: spacing.xl },
  instructionCard: { 
    alignItems: 'center', 
    padding: spacing.xl, 
    backgroundColor: colors.primarySoft, 
    borderRadius: radii.card,
    width: '100%',
  },
  poseEmoji: { fontSize: 64, marginBottom: spacing.md },
  poseInstruction: { fontFamily: typography.sansSemiBold, fontSize: 20, color: colors.text, textAlign: 'center' },
  poseTip: { fontFamily: typography.sansRegular, fontSize: 14, color: colors.mutedText, marginTop: spacing.sm, textAlign: 'center' },
  
  photoGrid: { flexDirection: 'row', gap: spacing.sm },
  photoThumb: { width: 100, height: 100, borderRadius: radii.card },
  
  thumbnails: { flexDirection: 'row', justifyContent: 'center', marginTop: spacing.lg, gap: spacing.sm },
  thumbnail: { 
    width: 60, 
    height: 60, 
    borderRadius: 30, 
    borderWidth: 2, 
    borderColor: colors.border,
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  thumbnailActive: { borderColor: colors.primary, borderWidth: 3 },
  thumbnailImage: { width: '100%', height: '100%' },
  thumbnailNumber: { fontFamily: typography.sansSemiBold, fontSize: 18, color: colors.mutedText },
  
  footer: { paddingHorizontal: spacing.page, paddingBottom: spacing.xl },
  retakeButton: { marginTop: spacing.md, alignItems: 'center' },
  retakeText: { fontFamily: typography.sansRegular, fontSize: 14, color: colors.primary, textDecorationLine: 'underline' },
});


