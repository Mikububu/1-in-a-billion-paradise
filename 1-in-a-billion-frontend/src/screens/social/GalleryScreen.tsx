/**
 * GALLERY SCREEN
 * 
 * Worldwide gallery of all users' claymation portraits.
 * A beautiful grid display of artistic clay sculptures representing real users.
 * Tap a portrait to view their profile (signs only - privacy preserved).
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  StyleSheet,
  Text,
  View,
  FlatList,
  TouchableOpacity,
  Image,
  Dimensions,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { colors, spacing, typography } from '@/theme/tokens';
import { MainStackParamList } from '@/navigation/RootNavigator';
import { useAuthStore } from '@/store/authStore';
import { env } from '@/config/env';

type Props = NativeStackScreenProps<MainStackParamList, 'Gallery'>;

interface GalleryPerson {
  id: string;
  userId: string;
  displayName: string;
  claymationUrl: string | null;
  sunSign: string | null;
  moonSign: string | null;
  risingSign: string | null;
  bio: string | null;
  lastActiveAt: string | null;
}

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const GRID_COLUMNS = 3;
const GRID_GAP = 4;
const ITEM_SIZE = (SCREEN_WIDTH - spacing.page * 2 - GRID_GAP * (GRID_COLUMNS - 1)) / GRID_COLUMNS;

export const GalleryScreen = ({ navigation }: Props) => {
  const [gallery, setGallery] = useState<GalleryPerson[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedPerson, setSelectedPerson] = useState<GalleryPerson | null>(null);
  const userId = useAuthStore((s) => s.userId);

  const fetchGallery = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);

    try {
      const response = await fetch(`${env.CORE_API_URL}/api/chat/gallery/random?count=60`, {
        headers: { 'X-User-Id': userId || '' },
      });
      const data = await response.json();
      
      if (data.success) {
        setGallery(data.gallery);
      }
    } catch (error) {
      console.error('Gallery fetch error:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [userId]);

  useEffect(() => {
    fetchGallery();
  }, [fetchGallery]);

  const renderPerson = ({ item }: { item: GalleryPerson }) => (
    <TouchableOpacity
      style={styles.galleryItem}
      onPress={() => setSelectedPerson(item)}
      activeOpacity={0.8}
    >
      {item.claymationUrl ? (
        <Image source={{ uri: item.claymationUrl }} style={styles.galleryImage} />
      ) : (
        <View style={[styles.galleryImage, styles.placeholderImage]}>
          <Text style={styles.placeholderText}>
            {item.displayName?.charAt(0) || '?'}
          </Text>
        </View>
      )}
      <View style={styles.galleryOverlay}>
        <Text style={styles.gallerySigns}>
          ☉{item.sunSign?.slice(0, 3) || '?'}
        </Text>
      </View>
    </TouchableOpacity>
  );

  const renderProfileModal = () => {
    if (!selectedPerson) return null;

    return (
      <TouchableOpacity
        style={styles.modalOverlay}
        activeOpacity={1}
        onPress={() => setSelectedPerson(null)}
      >
        <View style={styles.profileModal}>
          {selectedPerson.claymationUrl && (
            <Image
              source={{ uri: selectedPerson.claymationUrl }}
              style={styles.profileImage}
            />
          )}
          <Text style={styles.profileName}>{selectedPerson.displayName}</Text>
          
          <View style={styles.signsRow}>
            <View style={styles.signBadge}>
              <Text style={styles.signIcon}>☉</Text>
              <Text style={styles.signText}>{selectedPerson.sunSign || '?'}</Text>
            </View>
            <View style={styles.signBadge}>
              <Text style={styles.signIcon}>☽</Text>
              <Text style={styles.signText}>{selectedPerson.moonSign || '?'}</Text>
            </View>
            <View style={styles.signBadge}>
              <Text style={styles.signIcon}>↑</Text>
              <Text style={styles.signText}>{selectedPerson.risingSign || '?'}</Text>
            </View>
          </View>

          {selectedPerson.bio && (
            <Text style={styles.profileBio}>{selectedPerson.bio}</Text>
          )}

          <Text style={styles.privacyNote}>
            If the universe aligns your paths, you will be notified.
          </Text>

          <TouchableOpacity
            style={styles.closeButton}
            onPress={() => setSelectedPerson(null)}
          >
            <Text style={styles.closeButtonText}>Close</Text>
          </TouchableOpacity>
        </View>
      </TouchableOpacity>
    );
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.loadingText}>Loading souls...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Text style={styles.backArrow}>←</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Soul Gallery</Text>
        <View style={{ width: 40 }} />
      </View>

      <Text style={styles.subtitle}>
        {gallery.length} souls around the world
      </Text>

      {/* Gallery Grid */}
      <FlatList
        data={gallery}
        renderItem={renderPerson}
        keyExtractor={(item) => item.id}
        numColumns={GRID_COLUMNS}
        contentContainerStyle={styles.galleryGrid}
        columnWrapperStyle={styles.galleryRow}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => fetchGallery(true)}
            tintColor={colors.primary}
          />
        }
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>No portraits yet</Text>
            <Text style={styles.emptySubtext}>
              Be the first to upload your photograph
            </Text>
          </View>
        }
      />

      {/* Profile Modal */}
      {renderProfileModal()}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.pageBg,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.page,
    paddingVertical: spacing.md,
  },
  backButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  backArrow: {
    fontSize: 24,
    color: colors.text,
  },
  headerTitle: {
    fontFamily: typography.sansBold,
    fontSize: 20,
    color: colors.text,
  },
  subtitle: {
    fontFamily: typography.sansRegular,
    fontSize: 14,
    color: colors.mutedText,
    textAlign: 'center',
    marginBottom: spacing.md,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    fontFamily: typography.sansRegular,
    fontSize: 16,
    color: colors.mutedText,
    marginTop: spacing.md,
  },
  galleryGrid: {
    paddingHorizontal: spacing.page,
    paddingBottom: spacing.xl,
  },
  galleryRow: {
    gap: GRID_GAP,
    marginBottom: GRID_GAP,
  },
  galleryItem: {
    width: ITEM_SIZE,
    height: ITEM_SIZE,
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: colors.cardBg,
  },
  galleryImage: {
    width: '100%',
    height: '100%',
  },
  placeholderImage: {
    backgroundColor: colors.border,
    justifyContent: 'center',
    alignItems: 'center',
  },
  placeholderText: {
    fontFamily: typography.sansBold,
    fontSize: 32,
    color: colors.mutedText,
  },
  galleryOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: 4,
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  gallerySigns: {
    fontFamily: typography.sansRegular,
    fontSize: 10,
    color: '#fff',
    textAlign: 'center',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: spacing.xxl,
  },
  emptyText: {
    fontFamily: typography.sansSemiBold,
    fontSize: 18,
    color: colors.text,
  },
  emptySubtext: {
    fontFamily: typography.sansRegular,
    fontSize: 14,
    color: colors.mutedText,
    marginTop: spacing.sm,
  },
  
  // Profile Modal
  modalOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.8)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 100,
  },
  profileModal: {
    width: SCREEN_WIDTH - spacing.page * 2,
    backgroundColor: colors.cardBg,
    borderRadius: 24,
    padding: spacing.xl,
    alignItems: 'center',
  },
  profileImage: {
    width: 340,
    height: 340,
    borderRadius: 24,
    marginBottom: spacing.lg,
    borderWidth: 3,
    borderColor: colors.primary,
  },
  profileName: {
    fontFamily: typography.sansBold,
    fontSize: 24,
    color: colors.text,
    marginBottom: spacing.md,
  },
  signsRow: {
    flexDirection: 'row',
    gap: spacing.md,
    marginBottom: spacing.lg,
  },
  signBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    backgroundColor: colors.pageBg,
    borderRadius: 12,
  },
  signIcon: {
    fontSize: 14,
  },
  signText: {
    fontFamily: typography.sansMedium,
    fontSize: 12,
    color: colors.text,
  },
  profileBio: {
    fontFamily: typography.sansRegular,
    fontSize: 14,
    color: colors.mutedText,
    textAlign: 'center',
    marginBottom: spacing.lg,
  },
  privacyNote: {
    fontFamily: typography.sansItalic,
    fontSize: 12,
    color: colors.mutedText,
    textAlign: 'center',
    marginBottom: spacing.lg,
    paddingHorizontal: spacing.md,
  },
  closeButton: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.xl,
    backgroundColor: colors.primary,
    borderRadius: 999,
  },
  closeButtonText: {
    fontFamily: typography.sansSemiBold,
    fontSize: 14,
    color: '#fff',
  },
});

export default GalleryScreen;
