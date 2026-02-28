import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Dimensions,
  FlatList,
  Image,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { env } from '@/config/env';
import { getAuthHeaders } from '@/services/api';
import { MainStackParamList } from '@/navigation/RootNavigator';
import { useAuthStore } from '@/store/authStore';
import { colors, spacing, typography } from '@/theme/tokens';
import { ChatAccessRenewModal } from '@/components/ChatAccessRenewModal';
import { useChatAccessGate } from '@/hooks/useChatAccessGate';
import { CHAT_RENEW_WARNING_TEXT } from '@/utils/chatAccess';

type Props = NativeStackScreenProps<MainStackParamList, 'Gallery'>;

type GalleryPerson = {
  id: string;
  userId: string;
  displayName: string;
  portraitUrl: string | null;
  sunSign: string | null;
  moonSign: string | null;
  risingSign: string | null;
  bio: string | null;
  lastActiveAt: string | null;
};

type MatchItem = {
  id: string;
  otherUserId: string;
  otherPersonId: string;
  otherName: string;
  otherPortraitUrl: string | null;
  compatibilityScore: number | null;
  matchReason: string | null;
  systemsMatched: string[];
  status: string;
  seenAt: string | null;
  createdAt: string;
};

type ConversationItem = {
  id: string;
  matchId: string;
  otherName: string;
  otherPortraitUrl: string | null;
  unreadCount: number;
  status: string;
  lastMessageAt: string | null;
  lastMessagePreview: string | null;
};

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const GRID_COLUMNS = 3;
const GRID_GAP = 4;
const ITEM_SIZE = (SCREEN_WIDTH - spacing.page * 2 - GRID_GAP * (GRID_COLUMNS - 1)) / GRID_COLUMNS;

export const GalleryScreen = ({ navigation }: Props) => {
  const [gallery, setGallery] = useState<GalleryPerson[]>([]);
  const [matches, setMatches] = useState<MatchItem[]>([]);
  const [conversationByMatch, setConversationByMatch] = useState<Record<string, ConversationItem>>({});
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedPerson, setSelectedPerson] = useState<GalleryPerson | null>(null);

  const userId = useAuthStore((s) => s.session?.user?.id || s.user?.id || null);
  const {
    chatBlocked,
    runWithChatAccess,
    closeRenewModal,
    renewNow,
    renewing,
    modalVisible,
  } = useChatAccessGate();

  const fetchData = useCallback(
    async (isRefresh = false) => {
      if (isRefresh) setRefreshing(true);
      else setLoading(true);

      try {
        const authHeaders = getAuthHeaders();
        const galleryReq = fetch(`${env.CORE_API_URL}/api/chat/gallery/random?count=90`, {
          headers: { ...authHeaders },
        });
        const matchesReq = userId
          ? fetch(`${env.CORE_API_URL}/api/chat/matches`, { headers: { ...authHeaders } })
          : Promise.resolve(null);
        const conversationsReq = userId
          ? fetch(`${env.CORE_API_URL}/api/chat/conversations`, { headers: { ...authHeaders } })
          : Promise.resolve(null);

        const [galleryRes, matchesRes, conversationsRes] = await Promise.all([
          galleryReq,
          matchesReq,
          conversationsReq,
        ]);

        const galleryJson = await galleryRes.json().catch(() => ({}));
        if (galleryRes.ok && galleryJson?.success && Array.isArray(galleryJson.gallery)) {
          setGallery(galleryJson.gallery);
        } else {
          setGallery([]);
        }

        if (matchesRes) {
          const matchesJson = await matchesRes.json().catch(() => ({}));
          if (matchesRes.ok && matchesJson?.success && Array.isArray(matchesJson.matches)) {
            setMatches(matchesJson.matches);
          } else {
            setMatches([]);
          }
        } else {
          setMatches([]);
        }

        if (conversationsRes) {
          const conversationsJson = await conversationsRes.json().catch(() => ({}));
          if (
            conversationsRes.ok &&
            conversationsJson?.success &&
            Array.isArray(conversationsJson.conversations)
          ) {
            const nextMap: Record<string, ConversationItem> = {};
            for (const row of conversationsJson.conversations as ConversationItem[]) {
              if (row?.matchId) nextMap[row.matchId] = row;
            }
            setConversationByMatch(nextMap);
          } else {
            setConversationByMatch({});
          }
        } else {
          setConversationByMatch({});
        }
      } catch (error) {
        console.error('Gallery/matches fetch error:', error);
        setGallery([]);
        setMatches([]);
        setConversationByMatch({});
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [userId]
  );

  useFocusEffect(
    useCallback(() => {
      fetchData();
    }, [fetchData])
  );

  const renderMatchCard = (item: MatchItem) => {
    const conversation = conversationByMatch[item.id];
    const canOpenChat = Boolean(conversation?.id);
    const score = item.compatibilityScore != null ? Math.round(item.compatibilityScore) : null;

    return (
      <View key={item.id} style={styles.matchCard}>
        {item.otherPortraitUrl ? (
          <Image source={{ uri: item.otherPortraitUrl }} style={styles.matchImage} />
        ) : (
          <View style={[styles.matchImage, styles.matchImagePlaceholder]}>
            <Text style={styles.matchInitial}>{item.otherName?.charAt(0) || '?'}</Text>
          </View>
        )}

        <Text numberOfLines={1} style={styles.matchName}>
          {item.otherName}
        </Text>
        <Text style={styles.matchMeta}>{score != null ? `${score}%` : 'Match'}</Text>

        <TouchableOpacity
          style={[styles.matchChatBtn, !canOpenChat && styles.matchChatBtnDisabled]}
          onPress={() => {
            if (!canOpenChat) return;
            runWithChatAccess(() =>
              navigation.navigate('Chat', {
                conversationId: conversation.id,
                otherName: conversation.otherName || item.otherName,
                otherPortraitUrl: conversation.otherPortraitUrl || item.otherPortraitUrl,
              })
            );
          }}
          disabled={!canOpenChat}
          activeOpacity={0.8}
        >
          <Text style={styles.matchChatBtnText}>{canOpenChat ? 'Chat' : 'Waiting'}</Text>
        </TouchableOpacity>
      </View>
    );
  };

  const renderPerson = ({ item }: { item: GalleryPerson }) => (
    <TouchableOpacity style={styles.galleryItem} onPress={() => setSelectedPerson(item)} activeOpacity={0.8} accessibilityRole="button" accessibilityLabel={`View ${item.displayName || 'profile'}`}>
      {item.portraitUrl ? (
        <Image source={{ uri: item.portraitUrl }} style={styles.galleryImage} />
      ) : (
        <View style={[styles.galleryImage, styles.placeholderImage]}>
          <Text style={styles.placeholderText}>{item.displayName?.charAt(0) || '?'}</Text>
        </View>
      )}
      <View style={styles.galleryOverlay}>
        <Text style={styles.gallerySigns}>
          ☉{item.sunSign?.slice(0, 3) || '?'} ☽{item.moonSign?.slice(0, 3) || '?'} ↑
          {item.risingSign?.slice(0, 3) || '?'}
        </Text>
      </View>
    </TouchableOpacity>
  );

  const renderHeader = () => (
    <View style={styles.listHeader}>
      <Text style={styles.subtitle}>
        {matches.length} matches · {gallery.length} souls
      </Text>
      {chatBlocked ? <Text style={styles.subscriptionWarning}>{CHAT_RENEW_WARNING_TEXT}</Text> : null}

      <View style={styles.section}>
        <View style={styles.sectionTopRow}>
          <Text style={styles.sectionTitle}>My Matches</Text>
          <TouchableOpacity onPress={() => runWithChatAccess(() => navigation.navigate('ChatList'))}>
            <Text style={styles.sectionAction}>Messages</Text>
          </TouchableOpacity>
        </View>

        {matches.length === 0 ? (
          <Text style={styles.sectionEmpty}>No matches yet. The system adds them automatically.</Text>
        ) : (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.matchesRow}
          >
            {matches.slice(0, 12).map(renderMatchCard)}
          </ScrollView>
        )}
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Souls Gallery</Text>
        <Text style={styles.sectionHint}>Mystery mode: no names, no details, only signs.</Text>
      </View>
    </View>
  );

  const renderProfileModal = () => {
    if (!selectedPerson) return null;

    return (
      <Modal transparent visible={Boolean(selectedPerson)} animationType="fade">
        <Pressable style={styles.modalOverlay} onPress={() => setSelectedPerson(null)}>
          <Pressable style={styles.profileModal} onPress={(e) => e.stopPropagation()}>
            {selectedPerson.portraitUrl ? (
              <Image source={{ uri: selectedPerson.portraitUrl }} style={styles.profileImage} />
            ) : (
              <View style={[styles.profileImage, styles.placeholderImage]}>
                <Text style={[styles.placeholderText, { fontSize: 80 }]}>
                  {selectedPerson.displayName?.charAt(0) || '?'}
                </Text>
              </View>
            )}

            <Text style={styles.profileTitle}>Soul Profile</Text>

            <View style={styles.signsRow}>
              <View style={styles.signBadge}>
                <Text style={styles.signIcon}>☉</Text>
                <Text style={styles.signText}>{selectedPerson.sunSign}</Text>
              </View>
              <View style={styles.signBadge}>
                <Text style={styles.signIcon}>☽</Text>
                <Text style={styles.signText}>{selectedPerson.moonSign}</Text>
              </View>
              <View style={styles.signBadge}>
                <Text style={styles.signIcon}>↑</Text>
                <Text style={styles.signText}>{selectedPerson.risingSign}</Text>
              </View>
            </View>

            <Text style={styles.privacyNote}>Identity is hidden. Matching is system-driven.</Text>

            <TouchableOpacity style={styles.closeButton} onPress={() => setSelectedPerson(null)}>
              <Text style={styles.closeButtonText}>Close</Text>
            </TouchableOpacity>
          </Pressable>
        </Pressable>
      </Modal>
    );
  };

  if (loading) {
    return (
      <View style={styles.container}>
        <SafeAreaView edges={['top']} style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
            <Text style={styles.backArrow}>←</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Soul Gallery</Text>
          <TouchableOpacity
            style={styles.headerAction}
            onPress={() => runWithChatAccess(() => navigation.navigate('ChatList'))}
          >
            <Text style={styles.headerActionText}>Chat</Text>
          </TouchableOpacity>
        </SafeAreaView>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.loadingText}>Loading souls...</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <SafeAreaView style={styles.header} edges={['top']}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Text style={styles.backArrow}>←</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Soul Gallery</Text>
        <TouchableOpacity
          style={styles.headerAction}
          onPress={() => runWithChatAccess(() => navigation.navigate('ChatList'))}
        >
          <Text style={styles.headerActionText}>Chat</Text>
        </TouchableOpacity>
      </SafeAreaView>

      <FlatList
        data={gallery}
        renderItem={renderPerson}
        keyExtractor={(item) => item.id}
        numColumns={GRID_COLUMNS}
        ListHeaderComponent={renderHeader}
        contentContainerStyle={styles.galleryGrid}
        columnWrapperStyle={styles.galleryRow}
        showsVerticalScrollIndicator={false}
        initialNumToRender={12}
        maxToRenderPerBatch={8}
        windowSize={5}
        removeClippedSubviews
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => fetchData(true)}
            tintColor={colors.primary}
          />
        }
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>No portraits yet</Text>
            <Text style={styles.emptySubtext}>Be the first to upload your photograph.</Text>
          </View>
        }
      />

      {renderProfileModal()}

      <ChatAccessRenewModal
        visible={modalVisible}
        renewing={renewing}
        onClose={closeRenewModal}
        onRenew={renewNow}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'transparent',
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
  headerAction: {
    minWidth: 56,
    paddingHorizontal: spacing.xs,
    height: 40,
    alignItems: 'flex-end',
    justifyContent: 'center',
  },
  headerActionText: {
    fontFamily: typography.sansSemiBold,
    fontSize: 14,
    color: colors.primary,
  },
  listHeader: {
    paddingBottom: spacing.md,
  },
  subtitle: {
    fontFamily: typography.sansRegular,
    fontSize: 14,
    color: colors.mutedText,
    textAlign: 'center',
    marginBottom: spacing.xs,
  },
  subscriptionWarning: {
    fontFamily: typography.sansSemiBold,
    fontSize: 12,
    color: colors.primary,
    textAlign: 'center',
    marginBottom: spacing.sm,
    paddingHorizontal: spacing.page,
  },
  section: {
    marginBottom: spacing.md,
  },
  sectionTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.xs,
  },
  sectionTitle: {
    fontFamily: typography.sansSemiBold,
    fontSize: 15,
    color: colors.text,
  },
  sectionAction: {
    fontFamily: typography.sansSemiBold,
    fontSize: 13,
    color: colors.primary,
  },
  sectionEmpty: {
    fontFamily: typography.sansRegular,
    fontSize: 13,
    color: colors.mutedText,
  },
  sectionHint: {
    marginTop: 2,
    fontFamily: typography.sansRegular,
    fontSize: 12,
    color: colors.mutedText,
  },
  matchesRow: {
    gap: spacing.sm,
    paddingRight: spacing.page,
  },
  matchCard: {
    width: 116,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    padding: spacing.sm,
    alignItems: 'center',
  },
  matchImage: {
    width: 84,
    height: 84,
    borderRadius: 42,
    marginBottom: spacing.xs,
  },
  matchImagePlaceholder: {
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  matchInitial: {
    fontFamily: typography.sansSemiBold,
    fontSize: 28,
    color: '#fff',
  },
  matchName: {
    width: '100%',
    textAlign: 'center',
    fontFamily: typography.sansSemiBold,
    fontSize: 12,
    color: colors.text,
  },
  matchMeta: {
    marginTop: 2,
    marginBottom: spacing.xs,
    fontFamily: typography.sansRegular,
    fontSize: 11,
    color: colors.mutedText,
  },
  matchChatBtn: {
    width: '100%',
    borderRadius: 999,
    backgroundColor: colors.primary,
    paddingVertical: 6,
    alignItems: 'center',
  },
  matchChatBtnDisabled: {
    backgroundColor: colors.border,
  },
  matchChatBtnText: {
    fontFamily: typography.sansSemiBold,
    fontSize: 11,
    color: '#fff',
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
    backgroundColor: colors.surface,
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
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.8)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  profileModal: {
    width: SCREEN_WIDTH - spacing.page * 2,
    backgroundColor: colors.surface,
    borderRadius: 24,
    padding: spacing.xl,
    alignItems: 'center',
  },
  profileImage: {
    width: 300,
    height: 300,
    borderRadius: 24,
    marginBottom: spacing.lg,
    borderWidth: 3,
    borderColor: colors.primary,
  },
  profileTitle: {
    fontFamily: typography.sansSemiBold,
    fontSize: 18,
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
    backgroundColor: colors.border,
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
  privacyNote: {
    fontFamily: typography.sansRegular,
    fontStyle: 'italic',
    fontSize: 12,
    color: colors.mutedText,
    textAlign: 'center',
    marginBottom: spacing.lg,
    paddingHorizontal: spacing.md,
  },
  closeButton: {
    width: '100%',
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.xl,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.text,
    borderRadius: 999,
    alignItems: 'center',
  },
  closeButtonText: {
    fontFamily: typography.sansSemiBold,
    fontSize: 14,
    color: colors.text,
  },
});

export default GalleryScreen;
