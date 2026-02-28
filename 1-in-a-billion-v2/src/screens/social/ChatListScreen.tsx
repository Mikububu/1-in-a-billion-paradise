import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Image,
  RefreshControl,
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

type Props = NativeStackScreenProps<MainStackParamList, 'ChatList'>;

type Conversation = {
  id: string;
  matchId: string;
  otherName: string;
  otherPortraitUrl: string | null;
  lastMessageAt: string | null;
  lastMessagePreview: string | null;
  unreadCount: number;
  status: string;
};

export const ChatListScreen = ({ navigation }: Props) => {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [totalUnread, setTotalUnread] = useState(0);

  const userId = useAuthStore((s) => s.session?.user?.id || s.user?.id || null);
  const {
    chatBlocked,
    runWithChatAccess,
    closeRenewModal,
    renewNow,
    renewing,
    modalVisible,
  } = useChatAccessGate();

  const fetchConversations = useCallback(
    async (isRefresh = false) => {
      if (!userId) {
        setConversations([]);
        setTotalUnread(0);
        setLoading(false);
        setRefreshing(false);
        return;
      }

      if (isRefresh) setRefreshing(true);
      else setLoading(true);

      try {
        const response = await fetch(`${env.CORE_API_URL}/api/chat/conversations`, {
          headers: { ...getAuthHeaders() },
        });
        const data = await response.json();

        if (response.ok && data?.success) {
          setConversations(Array.isArray(data.conversations) ? data.conversations : []);
          setTotalUnread(Number(data.totalUnread || 0));
        } else {
          setConversations([]);
          setTotalUnread(0);
        }
      } catch (error) {
        console.error('Conversations fetch error:', error);
        setConversations([]);
        setTotalUnread(0);
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [userId]
  );

  useFocusEffect(
    useCallback(() => {
      fetchConversations();
    }, [fetchConversations])
  );

  const formatTime = (dateStr: string | null) => {
    if (!dateStr) return '';

    const date = new Date(dateStr);
    const now = new Date();
    const diffDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));

    if (diffDays <= 0) {
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return date.toLocaleDateString([], { weekday: 'short' });
    return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
  };

  const renderConversation = ({ item }: { item: Conversation }) => (
    <TouchableOpacity
      style={styles.conversationItem}
      onPress={() =>
        runWithChatAccess(() =>
          navigation.navigate('Chat', {
            conversationId: item.id,
            otherName: item.otherName,
            otherPortraitUrl: item.otherPortraitUrl,
          })
        )
      }
      activeOpacity={0.75}
    >
      {item.otherPortraitUrl ? (
        <Image source={{ uri: item.otherPortraitUrl }} style={styles.avatar} />
      ) : (
        <View style={[styles.avatar, styles.avatarPlaceholder]}>
          <Text style={styles.avatarInitial}>{item.otherName?.charAt(0) || '?'}</Text>
        </View>
      )}

      <View style={styles.content}>
        <View style={styles.headerRow}>
          <Text style={styles.name}>{item.otherName}</Text>
          <Text style={styles.time}>{formatTime(item.lastMessageAt)}</Text>
        </View>
        <View style={styles.footerRow}>
          <Text style={styles.preview} numberOfLines={1}>
            {item.lastMessagePreview || 'Start a conversation...'}
          </Text>
          {item.unreadCount > 0 ? (
            <View style={styles.unreadBadge}>
              <Text style={styles.unreadText}>{item.unreadCount}</Text>
            </View>
          ) : null}
        </View>
      </View>
    </TouchableOpacity>
  );

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingWrap}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.loadingText}>Loading conversations...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.topBar}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Text style={styles.backArrow}>&lt;</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Messages</Text>
        <View style={styles.rightSlot}>
          {totalUnread > 0 ? (
            <View style={styles.headerBadge}>
              <Text style={styles.headerBadgeText}>{totalUnread}</Text>
            </View>
          ) : null}
        </View>
      </View>

      {chatBlocked ? <Text style={styles.warning}>{CHAT_RENEW_WARNING_TEXT}</Text> : null}

      <FlatList
        data={conversations}
        renderItem={renderConversation}
        keyExtractor={(item) => item.id}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.listContent}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => fetchConversations(true)}
            tintColor={colors.primary}
          />
        }
        ListEmptyComponent={
          <View style={styles.emptyWrap}>
            <Text style={styles.emptyTitle}>No conversations yet</Text>
            <Text style={styles.emptySub}>When a mutual match is available, it appears here.</Text>
            <TouchableOpacity
              style={styles.galleryButton}
              onPress={() => navigation.navigate('Gallery')}
              activeOpacity={0.8}
            >
              <Text style={styles.galleryButtonText}>Browse Soul Gallery</Text>
            </TouchableOpacity>
          </View>
        }
      />

      <ChatAccessRenewModal
        visible={modalVisible}
        renewing={renewing}
        onClose={closeRenewModal}
        onRenew={renewNow}
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  loadingWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    marginTop: spacing.md,
    fontFamily: typography.sansRegular,
    fontSize: 14,
    color: colors.mutedText,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.page,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  backButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  backArrow: {
    fontFamily: typography.sansSemiBold,
    fontSize: 26,
    color: colors.text,
    marginTop: -2,
  },
  title: {
    fontFamily: typography.sansBold,
    fontSize: 20,
    color: colors.text,
  },
  rightSlot: {
    width: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerBadge: {
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    paddingHorizontal: 6,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerBadgeText: {
    fontFamily: typography.sansSemiBold,
    fontSize: 11,
    color: '#fff',
  },
  warning: {
    marginTop: spacing.xs,
    marginBottom: spacing.sm,
    paddingHorizontal: spacing.page,
    textAlign: 'center',
    fontFamily: typography.sansSemiBold,
    fontSize: 12,
    color: colors.primary,
  },
  listContent: {
    flexGrow: 1,
  },
  separator: {
    height: 1,
    backgroundColor: colors.border,
    marginLeft: 76,
  },
  conversationItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.page,
    paddingVertical: spacing.md,
    gap: spacing.md,
  },
  avatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
  },
  avatarPlaceholder: {
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarInitial: {
    fontFamily: typography.sansBold,
    fontSize: 22,
    color: '#fff',
  },
  content: {
    flex: 1,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  name: {
    fontFamily: typography.sansSemiBold,
    fontSize: 16,
    color: colors.text,
  },
  time: {
    fontFamily: typography.sansRegular,
    fontSize: 12,
    color: colors.mutedText,
  },
  footerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  preview: {
    flex: 1,
    marginRight: spacing.sm,
    fontFamily: typography.sansRegular,
    fontSize: 14,
    color: colors.mutedText,
  },
  unreadBadge: {
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    paddingHorizontal: 6,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  unreadText: {
    fontFamily: typography.sansSemiBold,
    fontSize: 11,
    color: '#fff',
  },
  emptyWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.xxl,
  },
  emptyTitle: {
    fontFamily: typography.sansSemiBold,
    fontSize: 18,
    color: colors.text,
    marginBottom: spacing.sm,
  },
  emptySub: {
    fontFamily: typography.sansRegular,
    fontSize: 14,
    color: colors.mutedText,
    textAlign: 'center',
    marginBottom: spacing.lg,
  },
  galleryButton: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: 999,
    backgroundColor: colors.primary,
  },
  galleryButtonText: {
    fontFamily: typography.sansSemiBold,
    fontSize: 14,
    color: '#fff',
  },
});

export default ChatListScreen;
