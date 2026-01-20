/**
 * PERSON PHOTO UPLOAD SCREEN
 * 
 * Allows uploading a photo for people in Karmic Zoo.
 * Photo is transformed into claymation style via backend service.
 */

import React, { useState, useEffect } from 'react';
import { StyleSheet, Text, View, TouchableOpacity, Image, Alert, ActivityIndicator, Animated } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { colors, spacing, typography } from '@/theme/tokens';
import { Button } from '@/components/Button';
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
  
  const [photoUri, setPhotoUri] = useState<string | null>(person?.originalPhotoUrl || null);
  const [isUploading, setIsUploading] = useState(false);
  
  // Rotation animation for uploading indicator
  const rotateAnim = React.useRef(new Animated.Value(0)).current;
  
  React.useEffect(() => {
    // Show rotating animation when no photo OR when uploading
    if (!photoUri || isUploading) {
      Animated.loop(
        Animated.timing(rotateAnim, {
          toValue: 1,
          duration: 2000,
          useNativeDriver: true,
        })
      ).start();
    } else {
      rotateAnim.setValue(0);
    }
  }, [photoUri, isUploading]);

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
      setPhotoUri(result.assets[0].uri);
    }
  };

  const handleUpload = async () => {
    if (!photoUri) {
      Alert.alert('No Photo', 'Please select a photo first.');
      return;
    }

    setIsUploading(true);

    try {
      const result = await uploadPersonPhoto(person.id, photoUri);
      
      if (!result.success) {
        throw new Error(result.error || 'Upload failed');
      }

      // Update person in store with new URLs
      updatePerson(person.id, {
        originalPhotoUrl: result.originalUrl,
        claymationUrl: result.claymationUrl,
      });

      Alert.alert('Success', 'Photo uploaded and transformed!', [
        { text: 'OK', onPress: () => navigation.goBack() }
      ]);
    } catch (error: any) {
      console.error('Photo upload error:', error);
      Alert.alert('Upload Failed', error?.message || 'Could not upload photo. Please try again.');
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <>
      <SafeAreaView style={styles.container} edges={['top']}>
        <BackButton onPress={() => navigation.goBack()} />
      
      <View style={styles.content}>
        <Text style={styles.title}>Upload Photo</Text>
        <Text style={styles.subtitle}>{person.name}</Text>
        
        <TouchableOpacity style={styles.photoPreview} onPress={pickImage} disabled={isUploading}>
          {photoUri ? (
            <Image source={{ uri: photoUri }} style={styles.previewImage} />
          ) : (
            <View style={styles.placeholderCircle}>
              <Text style={styles.placeholderText}>{person.name.charAt(0).toUpperCase()}</Text>
              <Text style={styles.placeholderHint}>Tap to select photo</Text>
            </View>
          )}
          
          {/* Rotating dashed border before upload and during upload */}
          {(!photoUri || isUploading) && (
            <Animated.View
              style={[
                styles.uploadingBorder,
                {
                  transform: [
                    {
                      rotate: rotateAnim.interpolate({
                        inputRange: [0, 1],
                        outputRange: ['0deg', '360deg'],
                      }),
                    },
                  ],
                },
              ]}
            />
          )}
        </TouchableOpacity>

        <Text style={styles.infoText}>
          By selecting and uploading a photo, you confirm having the necessary rights to do so. The photo will be transformed into a modified portrait for privacy and artistic consistency.
        </Text>

        {photoUri && (
          <View style={styles.buttons}>
            <Button
              label={isUploading ? "Uploading..." : "Upload & Transform"}
              onPress={handleUpload}
              variant="primary"
              disabled={isUploading}
            />
          </View>
        )}

        {isUploading && (
          <View style={styles.uploadingOverlay}>
            <ActivityIndicator size="large" color={colors.primary} />
            <Text style={styles.uploadingText}>
              Transforming into claymation...
            </Text>
          </View>
        )}
      </View>
    </SafeAreaView>
    
    {/* Demo claymation preview - outside SafeAreaView to reach bottom */}
    <View style={styles.demoPreview}>
      <Image 
        source={require('../../../assets/demo-claymation.png')} 
        style={styles.demoImage}
        resizeMode="cover"
      />
    </View>
    </>
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
    width: 200,
    height: 200,
    borderRadius: 100,
    overflow: 'hidden',
    marginBottom: spacing.lg,
    position: 'relative',
  },
  uploadingBorder: {
    position: 'absolute',
    top: -8,
    left: -8,
    width: 216,
    height: 216,
    borderRadius: 108,
    borderWidth: 6,
    borderStyle: 'dashed',
    borderColor: '#FF0000',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.5,
    shadowRadius: 4,
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
    fontSize: 64,
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
    fontSize: 14,
    color: colors.mutedText,
    textAlign: 'center',
    marginBottom: spacing.xl,
    maxWidth: 300,
    lineHeight: 20,
  },
  buttons: {
    width: '100%',
    gap: spacing.md,
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
  demoPreview: {
    position: 'absolute',
    bottom: -60,
    left: 0,
    right: 0,
    height: 460,
    alignItems: 'center',
    justifyContent: 'flex-end',
  },
  demoImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
});
