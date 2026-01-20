/**
 * PERSON PHOTO UPLOAD SCREEN
 * 
 * Allows uploading a photo for people in Karmic Zoo.
 * Photo is transformed into a stylized portrait via backend service.
 */

import React, { useState, useEffect, useRef } from 'react';
import { StyleSheet, Text, View, TouchableOpacity, Image, Alert, ActivityIndicator, Animated } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { colors, spacing, typography } from '@/theme/tokens';
import { BackButton } from '@/components/BackButton';
import { MainStackParamList } from '@/navigation/RootNavigator';
import { useProfileStore } from '@/store/profileStore';
import { uploadPersonPhoto } from '@/services/personPhotoService';

// Dynamic import to avoid crash in Expo Go
let ImagePicker: any = null;

async function loadImagePicker() {
  if (!ImagePicker) {
    try {
      ImagePicker = await import('expo-image-picker');
    } catch (e) {
      console.warn('expo-image-picker not available');
    }
  }
  return ImagePicker;
}

type Props = NativeStackScreenProps<MainStackParamList, 'PersonPhotoUpload'>;

export const PersonPhotoUploadScreen = ({ navigation, route }: Props) => {
  const { personId } = route.params;
  const people = useProfileStore((s) => s.people);
  const updatePerson = useProfileStore((s) => s.updatePerson);
  
  const person = people.find(p => p.id === personId);
  
  // Local selection (temporary). Once upload finishes we clear it, so the square shows the generated portrait.
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  
  // Subtle dotted-ring motion (avoid "spinning rectangle" feel)
  const rotateRed = useRef(new Animated.Value(0)).current;
  const rotateBlack = useRef(new Animated.Value(0)).current;
  const rotateWhite = useRef(new Animated.Value(0)).current;
  const ringAnims = useRef<Array<Animated.CompositeAnimation>>([]);
  
  const hasGeneratedPortrait = Boolean(person?.claymationUrl);
  const showRing = isUploading || (!hasGeneratedPortrait && !photoUri);

  useEffect(() => {
    // Move the "dots" without rotating the whole rectangle aggressively.
    // Using dotted borders + slow rotations makes it feel like a marching-stroke.
    ringAnims.current.forEach((a) => a.stop());
    ringAnims.current = [];

    if (showRing) {
      const mk = (v: Animated.Value, duration: number, reverse?: boolean) =>
        Animated.loop(
          Animated.timing(v, {
            toValue: reverse ? -1 : 1,
            duration,
            useNativeDriver: true,
          })
        );

      const a1 = mk(rotateRed, 9000, false);
      const a2 = mk(rotateBlack, 11000, true);
      const a3 = mk(rotateWhite, 14000, false);
      ringAnims.current = [a1, a2, a3];
      a1.start();
      a2.start();
      a3.start();
    } else {
      rotateRed.setValue(0);
      rotateBlack.setValue(0);
      rotateWhite.setValue(0);
    }

    return () => {
      ringAnims.current.forEach((a) => a.stop());
      ringAnims.current = [];
    };
  }, [showRing, rotateRed, rotateBlack, rotateWhite]);

  if (!person) {
    return (
      <SafeAreaView style={styles.container}>
        <BackButton onPress={() => navigation.goBack()} />
        <View style={styles.content}>
          <Text style={styles.errorText}>Person not found</Text>
        </View>
      </SafeAreaView>
    );
  }

  const uploadSelectedPhoto = async (selectedUri: string) => {
    setIsUploading(true);

    try {
      const result = await uploadPersonPhoto(person.id, selectedUri);

      if (!result.success) {
        throw new Error(result.error || 'Upload failed');
      }

      // Update person in store with new URLs
      updatePerson(person.id, {
        originalPhotoUrl: result.originalUrl,
        claymationUrl: result.claymationUrl,
      });

      // Clear local selection so we show the generated portrait.
      setPhotoUri(null);
    } catch (error: any) {
      console.error('Photo upload error:', error);
      Alert.alert('Upload Failed', error?.message || 'Could not upload photo. Please try again.');
    } finally {
      setIsUploading(false);
    }
  };

  const pickImage = async () => {
    const picker = await loadImagePicker();
    
    if (!picker) {
      Alert.alert(
        'Photo Upload Unavailable', 
        'Photo upload requires a native build. This feature will work on your deployed iPhone app.\n\nFor now, you can test other features or build for simulator with: npx expo prebuild && npx expo run:ios',
        [{ text: 'OK' }]
      );
      return;
    }

    // Request permissions
    const { status } = await picker.requestMediaLibraryPermissionsAsync();
    
    if (status !== 'granted') {
      Alert.alert('Permission Required', 'We need photo library access to upload photos.');
      return;
    }

    const result = await picker.launchImageLibraryAsync({
      mediaTypes: picker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });

    if (!result.canceled && result.assets[0]) {
      const selectedUri = result.assets[0].uri;
      setPhotoUri(selectedUri);
      // Auto-run upload/transform (no button).
      await uploadSelectedPhoto(selectedUri);
    }
  };

  const handleAvatarPress = async () => {
    if (isUploading) return;

    if (hasGeneratedPortrait) {
      Alert.alert(
        'Update portrait?',
        'You can regenerate the stylized portrait by selecting a new photo.',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Regenerate', style: 'destructive', onPress: () => { void pickImage(); } },
        ]
      );
      return;
    }

    void pickImage();
  };

  const displayUri = photoUri || person.claymationUrl || person.originalPhotoUrl || null;

  return (
    <View style={styles.root}>
      <SafeAreaView style={styles.container} edges={['top']}>
        <BackButton onPress={() => navigation.goBack()} />
      
      <View style={styles.content}>
        <Text style={styles.title}>Upload Photo</Text>
        <Text style={styles.subtitle}>{person.name}</Text>
        
        <TouchableOpacity style={styles.photoPreview} onPress={handleAvatarPress} disabled={isUploading}>
          {displayUri ? (
            <Image source={{ uri: displayUri }} style={styles.previewImage} />
          ) : (
            <View style={styles.placeholderCircle}>
              <Text style={styles.placeholderText}>{person.name.charAt(0).toUpperCase()}</Text>
              <Text style={styles.placeholderHint}>Tap to choose a photo</Text>
            </View>
          )}
          
          {/* Rotating dashed border before upload and during upload */}
          {showRing && (
            <>
              <Animated.View
                pointerEvents="none"
                style={[
                  styles.ringOuter,
                  {
                    transform: [
                      {
                        rotate: rotateRed.interpolate({
                          inputRange: [-1, 1],
                          outputRange: ['-360deg', '360deg'],
                        }),
                      },
                    ],
                  },
                ]}
              />
              <Animated.View
                pointerEvents="none"
                style={[
                  styles.ringMiddle,
                  {
                    transform: [
                      {
                        rotate: rotateBlack.interpolate({
                          inputRange: [-1, 1],
                          outputRange: ['-360deg', '360deg'],
                        }),
                      },
                    ],
                  },
                ]}
              />
              <Animated.View
                pointerEvents="none"
                style={[
                  styles.ringInner,
                  {
                    transform: [
                      {
                        rotate: rotateWhite.interpolate({
                          inputRange: [-1, 1],
                          outputRange: ['-360deg', '360deg'],
                        }),
                      },
                    ],
                  },
                ]}
              />
            </>
          )}
        </TouchableOpacity>

        <View style={styles.infoCard}>
          <Text style={styles.infoText}>
            By selecting and uploading a photo, you confirm having the necessary rights to do so. The photo will be transformed into a modified portrait for privacy and artistic consistency.
          </Text>
        </View>

        {isUploading && (
          <View style={styles.uploadingOverlay}>
            <ActivityIndicator size="large" color={colors.primary} />
            <Text style={styles.uploadingText}>
              Transforming into a stylized portrait...
            </Text>
          </View>
        )}
      </View>
    </SafeAreaView>
    </View>
  );
};

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  container: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  content: {
    flex: 1,
    paddingHorizontal: spacing.page,
    paddingTop: 80,
    alignItems: 'center',
  },
  title: {
    fontFamily: typography.headline,
    fontSize: 28,
    color: colors.text,
    marginBottom: spacing.xs,
  },
  subtitle: {
    fontFamily: typography.sansRegular,
    fontSize: 16,
    color: colors.mutedText,
    marginBottom: spacing.xl,
  },
  photoPreview: {
    width: 320,
    height: 320,
    borderRadius: 28,
    overflow: 'hidden',
    marginBottom: spacing.lg,
    position: 'relative',
  },
  ringOuter: {
    position: 'absolute',
    top: -6,
    left: -6,
    width: 332,
    height: 332,
    borderRadius: 34,
    borderWidth: 3,
    borderStyle: 'dotted',
    borderColor: '#FF0000',
    opacity: 0.9,
  },
  ringMiddle: {
    position: 'absolute',
    top: -3,
    left: -3,
    width: 326,
    height: 326,
    borderRadius: 31,
    borderWidth: 2.5,
    borderStyle: 'dotted',
    borderColor: '#000000',
    opacity: 0.55,
  },
  ringInner: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: 320,
    height: 320,
    borderRadius: 28,
    borderWidth: 2,
    borderStyle: 'dotted',
    // White is too subtle on light backgrounds; use very-light gray.
    borderColor: '#F2F2F2',
    opacity: 0.9,
  },
  previewImage: {
    width: '100%',
    height: '100%',
  },
  placeholderCircle: {
    width: '100%',
    height: '100%',
    backgroundColor: colors.surface,
    borderWidth: 2,
    borderColor: colors.border,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
  },
  placeholderText: {
    fontFamily: typography.headline,
    fontSize: 76,
    color: colors.mutedText,
    marginBottom: spacing.sm,
  },
  placeholderHint: {
    fontFamily: typography.sansRegular,
    fontSize: 12,
    color: colors.mutedText,
  },
  infoText: {
    fontFamily: typography.sansRegular,
    fontSize: 12,
    color: colors.mutedText,
    textAlign: 'center',
    lineHeight: 17,
  },
  infoCard: {
    width: '100%',
    maxWidth: 340,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 22,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    marginBottom: spacing.lg,
  },
  errorText: {
    fontFamily: typography.sansRegular,
    fontSize: 16,
    color: colors.text,
  },
  uploadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  uploadingText: {
    marginTop: spacing.md,
    fontFamily: typography.sansSemiBold,
    fontSize: 16,
    color: colors.text,
  },
});
