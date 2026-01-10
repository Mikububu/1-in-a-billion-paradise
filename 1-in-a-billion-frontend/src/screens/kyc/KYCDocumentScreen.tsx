/**
 * KYC DOCUMENT UPLOAD SCREEN
 * 
 * Step 2: Upload passport or ID card.
 * Front and back of document.
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

type Props = NativeStackScreenProps<MainStackParamList, 'KYCDocument'>;

type DocumentType = 'passport' | 'id_card' | 'drivers_license';

const DOCUMENT_TYPES: { id: DocumentType; label: string; icon: string }[] = [
  { id: 'passport', label: 'Passport', icon: '🛂' },
  { id: 'id_card', label: 'ID Card', icon: '🪪' },
  { id: 'drivers_license', label: "Driver's License", icon: '🚗' },
];

export const KYCDocumentScreen = ({ navigation }: Props) => {
  const [documentType, setDocumentType] = useState<DocumentType | null>(null);
  const [frontImage, setFrontImage] = useState<string | null>(null);
  const [backImage, setBackImage] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);

  const pickImage = async (side: 'front' | 'back') => {
    // DEV: If ImagePicker not available, use placeholder
    if (!ImagePicker) {
      Alert.alert(
        'Dev Mode',
        'Image picker not available. Using placeholder image.',
        [
          {
            text: 'OK',
            onPress: () => {
              // Use placeholder for dev testing
              const placeholderUri = 'https://via.placeholder.com/400x250/cccccc/666666?text=Document+Photo';
              if (side === 'front') setFrontImage(placeholderUri);
              else setBackImage(placeholderUri);
            },
          },
        ]
      );
      return;
    }

    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    
    if (status !== 'granted') {
      // Try media library instead
      const { status: libStatus } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (libStatus !== 'granted') {
        Alert.alert('Permission Required', 'We need camera or photo library access to verify your document.');
        return;
      }
    }

    Alert.alert(
      'Upload Document',
      'How would you like to add your document?',
      [
        {
          text: 'Take Photo',
          onPress: async () => {
            const result = await ImagePicker.launchCameraAsync({
              mediaTypes: ImagePicker.MediaTypeOptions.Images,
              allowsEditing: true,
              aspect: [3, 2],
              quality: 0.8,
            });
            if (!result.canceled && result.assets[0]) {
              if (side === 'front') setFrontImage(result.assets[0].uri);
              else setBackImage(result.assets[0].uri);
            }
          },
        },
        {
          text: 'Choose from Library',
          onPress: async () => {
            const result = await ImagePicker.launchImageLibraryAsync({
              mediaTypes: ImagePicker.MediaTypeOptions.Images,
              allowsEditing: true,
              aspect: [3, 2],
              quality: 0.8,
            });
            if (!result.canceled && result.assets[0]) {
              if (side === 'front') setFrontImage(result.assets[0].uri);
              else setBackImage(result.assets[0].uri);
            }
          },
        },
        { text: 'Cancel', style: 'cancel' },
      ]
    );
  };

  const handleContinue = async () => {
    if (!documentType || !frontImage) {
      Alert.alert('Missing Document', 'Please upload at least the front of your document.');
      return;
    }

    setIsUploading(true);

    // FAKE API - simulating document verification
    await new Promise(resolve => setTimeout(resolve, 2000));

    setIsUploading(false);
    
    // Move to face scan
    navigation.navigate('KYCFaceScan');
  };

  const needsBackImage = documentType === 'id_card' || documentType === 'drivers_license';

  return (
    <SafeAreaView style={styles.container}>
      <BackButton onPress={() => navigation.goBack()} />

      <View style={styles.content}>
        <Text style={styles.step}>Step 2 of 4</Text>
        <Text style={styles.title} selectable>Upload Document</Text>
        <Text style={styles.subtitle} selectable>
          We need to verify your identity with an official document.
        </Text>

        {/* Document type selection */}
        {!documentType ? (
          <View style={styles.typeSelection}>
            <Text style={styles.typeLabel}>Select document type</Text>
            {DOCUMENT_TYPES.map((type) => (
              <TouchableOpacity
                key={type.id}
                style={styles.typeCard}
                onPress={() => setDocumentType(type.id)}
              >
                <Text style={styles.typeIcon}>{type.icon}</Text>
                <Text style={styles.typeText}>{type.label}</Text>
                <Text style={styles.typeArrow}>→</Text>
              </TouchableOpacity>
            ))}
          </View>
        ) : (
          <View style={styles.uploadSection}>
            {/* Document type badge */}
            <TouchableOpacity 
              style={styles.selectedType}
              onPress={() => { setDocumentType(null); setFrontImage(null); setBackImage(null); }}
            >
              <Text style={styles.selectedTypeText}>
                {DOCUMENT_TYPES.find(t => t.id === documentType)?.icon}{' '}
                {DOCUMENT_TYPES.find(t => t.id === documentType)?.label}
              </Text>
              <Text style={styles.changeText}>Change</Text>
            </TouchableOpacity>

            {/* Front of document */}
            <View style={styles.uploadCard}>
              <Text style={styles.uploadLabel}>Front of document</Text>
              {frontImage ? (
                <TouchableOpacity onPress={() => pickImage('front')}>
                  <Image source={{ uri: frontImage }} style={styles.documentImage} />
                  <Text style={styles.retakeText}>Tap to retake</Text>
                </TouchableOpacity>
              ) : (
                <TouchableOpacity style={styles.uploadPlaceholder} onPress={() => pickImage('front')}>
                  <Text style={styles.uploadIcon}>📄</Text>
                  <Text style={styles.uploadText}>Tap to upload</Text>
                </TouchableOpacity>
              )}
            </View>

            {/* Back of document (if needed) */}
            {needsBackImage && (
              <View style={styles.uploadCard}>
                <Text style={styles.uploadLabel}>Back of document</Text>
                {backImage ? (
                  <TouchableOpacity onPress={() => pickImage('back')}>
                    <Image source={{ uri: backImage }} style={styles.documentImage} />
                    <Text style={styles.retakeText}>Tap to retake</Text>
                  </TouchableOpacity>
                ) : (
                  <TouchableOpacity style={styles.uploadPlaceholder} onPress={() => pickImage('back')}>
                    <Text style={styles.uploadIcon}>📄</Text>
                    <Text style={styles.uploadText}>Tap to upload</Text>
                  </TouchableOpacity>
                )}
              </View>
            )}

            {/* Tips */}
            <View style={styles.tips}>
              <Text style={styles.tipsTitle}>Tips for a clear upload:</Text>
              <Text style={styles.tipItem}>• Place document on a dark surface</Text>
              <Text style={styles.tipItem}>• Ensure all corners are visible</Text>
              <Text style={styles.tipItem}>• Avoid glare and shadows</Text>
              <Text style={styles.tipItem}>• Make sure text is readable</Text>
            </View>
          </View>
        )}
      </View>

      {documentType && frontImage && (
        <View style={styles.footer}>
          <Button
            label={isUploading ? "Verifying..." : "Continue to Face Scan"}
            onPress={handleContinue}
            loading={isUploading}
          />
        </View>
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  backButton: { paddingHorizontal: spacing.page, paddingVertical: spacing.sm, paddingLeft: 60 },
  backText: { fontFamily: typography.sansSemiBold, fontSize: 16, color: colors.text },
  content: { flex: 1, paddingHorizontal: spacing.page, paddingTop: spacing.lg },
  step: { fontFamily: typography.sansSemiBold, fontSize: 12, color: colors.primary, textTransform: 'uppercase', letterSpacing: 1 },
  title: { fontFamily: typography.headline, fontSize: 32, color: colors.text, marginTop: spacing.sm },
  subtitle: { fontFamily: typography.sansRegular, fontSize: 16, color: colors.mutedText, marginTop: spacing.sm, lineHeight: 24 },

  // Type selection
  typeSelection: { marginTop: spacing.xl },
  typeLabel: { fontFamily: typography.sansSemiBold, fontSize: 14, color: colors.text, marginBottom: spacing.sm },
  typeCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.card,
    marginBottom: spacing.sm,
  },
  typeIcon: { fontSize: 28, marginRight: spacing.md },
  typeText: { flex: 1, fontFamily: typography.sansSemiBold, fontSize: 16, color: colors.text },
  typeArrow: { fontFamily: typography.sansBold, fontSize: 18, color: colors.primary },

  // Upload section
  uploadSection: { marginTop: spacing.lg },
  selectedType: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: spacing.sm,
    backgroundColor: colors.primarySoft,
    borderRadius: radii.card,
    marginBottom: spacing.lg,
  },
  selectedTypeText: { fontFamily: typography.sansSemiBold, fontSize: 14, color: colors.text },
  changeText: { fontFamily: typography.sansRegular, fontSize: 14, color: colors.primary },

  uploadCard: { marginBottom: spacing.lg },
  uploadLabel: { fontFamily: typography.sansSemiBold, fontSize: 14, color: colors.text, marginBottom: spacing.sm },
  uploadPlaceholder: {
    height: 140,
    backgroundColor: colors.background,
    borderWidth: 2,
    borderColor: colors.border,
    borderStyle: 'dashed',
    borderRadius: radii.card,
    justifyContent: 'center',
    alignItems: 'center',
  },
  uploadIcon: { fontSize: 32, marginBottom: spacing.xs },
  uploadText: { fontFamily: typography.sansRegular, fontSize: 14, color: colors.mutedText },
  documentImage: { width: '100%', height: 140, borderRadius: radii.card },
  retakeText: { fontFamily: typography.sansRegular, fontSize: 12, color: colors.primary, textAlign: 'center', marginTop: spacing.xs },

  tips: { marginTop: spacing.md, padding: spacing.md, backgroundColor: colors.primarySoft, borderRadius: radii.card },
  tipsTitle: { fontFamily: typography.sansSemiBold, fontSize: 13, color: colors.text, marginBottom: spacing.xs },
  tipItem: { fontFamily: typography.sansRegular, fontSize: 12, color: colors.mutedText, marginTop: 2 },

  footer: { paddingHorizontal: spacing.page, paddingBottom: spacing.xl },
});





