import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Image,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { env } from '@/config/env';
import { MainStackParamList } from '@/navigation/RootNavigator';
import { useAuthStore } from '@/store/authStore';
import { colors, spacing, typography } from '@/theme/tokens';
import { ChatAccessRenewModal } from '@/components/ChatAccessRenewModal';
import { useChatAccessGate } from '@/hooks/useChatAccessGate';
import { CHAT_RENEW_WARNING_TEXT } from '@/utils/chatAccess';

type Props = NativeStackScreenProps<MainStackParamList, 'Chat'>;

type Message = {
  id: string;
  conversationId: string;
  senderId: string;
  content: string;
  messageType: string;
  isSystemMessage: boolean;
  readAt: string | null;
  createdAt: string;
};

export const ChatScreen = ({ navigation, route }: Props) => {
  const { conversationId, otherName, otherPortraitUrl } = route.params;

  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const flatListRef = useRef<FlatList<Message>>(null);

  const userId = useAuthStore((s) => s.session?.user?.id || s.user?.id || null);
  const {
    chatBlocked,
    showRenewModal,
    closeRenewModal,
    renewNow,
    renewing,
    modalVisible,
  } = useChatAccessGate();

  const fetchMessages = useCallback(async () => {
    if (!userId) {
      setMessages([]);
      setLoading(false);
      return;
    }

    try {
      const response = await fetch(
        `${env.CORE_API_URL}/api/chat/conversations/${conversationId}/messages`,
        { headers: { 'X-User-Id': userId } }
      );
      const data = await response.json();

      if (response.ok && data?.success) {
        setMessages(Array.isArray(data.messages) ? data.messages : []);

        fetch(`${env.CORE_API_URL}/api/chat/conversations/${conversationId}/read`, {
          method: 'POST',
          headers: { 'X-User-Id': userId },
        }).catch(() => {});
      } else {
        setMessages([]);
      }
    } catch (error) {
      console.error('Messages fetch error:', error);
      setMessages([]);
    } finally {
      setLoading(false);
    }
  }, [conversationId, userId]);

  useEffect(() => {
    fetchMessages();
    const interval = setInterval(fetchMessages, 5000);
    return () => clearInterval(interval);
  }, [fetchMessages]);

  const handleSend = useCallback(async () => {
    if (!userId || !newMessage.trim() || sending) return;
    if (chatBlocked) {
      showRenewModal();
      return;
    }

    setSending(true);
    const messageContent = newMessage.trim();
    setNewMessage('');

    const tempMessage: Message = {
      id: `temp-${Date.now()}`,
      conversationId,
      senderId: userId,
      content: messageContent,
      messageType: 'text',
      isSystemMessage: false,
      readAt: null,
      createdAt: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, tempMessage]);

    try {
      const response = await fetch(
        `${env.CORE_API_URL}/api/chat/conversations/${conversationId}/messages`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-User-Id': userId,
          },
          body: JSON.stringify({ content: messageContent }),
        }
      );

      const data = await response.json();
      if (response.ok && data?.success && data?.message) {
        setMessages((prev) => prev.map((m) => (m.id === tempMessage.id ? data.message : m)));
      } else {
        setMessages((prev) => prev.filter((m) => m.id !== tempMessage.id));
      }
    } catch (error) {
      console.error('Send message error:', error);
      setMessages((prev) => prev.filter((m) => m.id !== tempMessage.id));
    } finally {
      setSending(false);
    }
  }, [chatBlocked, conversationId, newMessage, sending, showRenewModal, userId]);

  const renderMessage = ({ item }: { item: Message }) => {
    const isOwnMessage = item.senderId === userId;

    if (item.isSystemMessage) {
      return (
        <View style={styles.systemMessage}>
          <Text style={styles.systemText}>{item.content}</Text>
        </View>
      );
    }

    return (
      <View style={[styles.messageBubble, isOwnMessage ? styles.myBubble : styles.otherBubble]}>
        <Text style={[styles.messageText, isOwnMessage && styles.myMessageText]}>{item.content}</Text>
        <Text style={[styles.messageTime, isOwnMessage && styles.myMessageTime]}>
          {new Date(item.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </Text>
      </View>
    );
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingWrap}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Text style={styles.backArrow}>&lt;</Text>
        </TouchableOpacity>

        <View style={styles.headerProfile}>
          {otherPortraitUrl ? (
            <Image source={{ uri: otherPortraitUrl }} style={styles.headerImage} />
          ) : (
            <View style={[styles.headerImage, styles.headerPlaceholder]}>
              <Text style={styles.headerInitial}>{otherName?.charAt(0) || '?'}</Text>
            </View>
          )}
          <Text style={styles.headerName}>{otherName}</Text>
        </View>

        <View style={styles.headerSpacer} />
      </View>

      {chatBlocked ? (
        <TouchableOpacity
          style={styles.warningWrap}
          onPress={showRenewModal}
          activeOpacity={0.8}
        >
          <Text style={styles.warningText}>{CHAT_RENEW_WARNING_TEXT}</Text>
        </TouchableOpacity>
      ) : null}

      <FlatList
        ref={flatListRef}
        data={messages}
        renderItem={renderMessage}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: true })}
        ListEmptyComponent={
          <View style={styles.emptyWrap}>
            <Text style={styles.emptyText}>Start your conversation</Text>
          </View>
        }
      />

      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={styles.inputRow}>
          <TextInput
            style={[styles.input, chatBlocked && styles.inputDisabled]}
            value={newMessage}
            onChangeText={setNewMessage}
            placeholder="Type a message..."
            placeholderTextColor={colors.mutedText}
            multiline
            maxLength={1000}
            editable={!chatBlocked}
          />
          <TouchableOpacity
            style={[
              styles.sendButton,
              (!newMessage.trim() || sending || chatBlocked) && styles.sendButtonDisabled,
            ]}
            onPress={handleSend}
            disabled={!newMessage.trim() || sending || chatBlocked}
          >
            <Text style={styles.sendText}>{sending ? '...' : '>'}</Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>

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
  header: {
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
  headerProfile: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  headerImage: {
    width: 36,
    height: 36,
    borderRadius: 18,
  },
  headerPlaceholder: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary,
  },
  headerInitial: {
    fontFamily: typography.sansSemiBold,
    fontSize: 16,
    color: '#fff',
  },
  headerName: {
    fontFamily: typography.sansSemiBold,
    fontSize: 16,
    color: colors.text,
  },
  headerSpacer: {
    width: 40,
  },
  warningWrap: {
    paddingHorizontal: spacing.page,
    paddingTop: spacing.xs,
    paddingBottom: spacing.sm,
  },
  warningText: {
    textAlign: 'center',
    fontFamily: typography.sansSemiBold,
    fontSize: 12,
    color: colors.primary,
  },
  listContent: {
    paddingHorizontal: spacing.page,
    paddingVertical: spacing.md,
    paddingBottom: spacing.xl,
  },
  emptyWrap: {
    paddingVertical: spacing.xl,
    alignItems: 'center',
  },
  emptyText: {
    fontFamily: typography.sansRegular,
    fontSize: 14,
    color: colors.mutedText,
  },
  systemMessage: {
    alignSelf: 'stretch',
    marginBottom: spacing.md,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  systemText: {
    fontFamily: typography.sansRegular,
    fontSize: 14,
    lineHeight: 21,
    color: colors.text,
  },
  messageBubble: {
    maxWidth: '80%',
    marginBottom: spacing.sm,
    borderRadius: 18,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  myBubble: {
    alignSelf: 'flex-end',
    backgroundColor: colors.primary,
    borderBottomRightRadius: 6,
  },
  otherBubble: {
    alignSelf: 'flex-start',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderBottomLeftRadius: 6,
  },
  messageText: {
    fontFamily: typography.sansRegular,
    fontSize: 15,
    lineHeight: 21,
    color: colors.text,
  },
  myMessageText: {
    color: '#fff',
  },
  messageTime: {
    marginTop: 4,
    alignSelf: 'flex-end',
    fontFamily: typography.sansRegular,
    fontSize: 10,
    color: colors.mutedText,
  },
  myMessageTime: {
    color: 'rgba(255,255,255,0.75)',
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingHorizontal: spacing.page,
    paddingTop: spacing.sm,
    paddingBottom: spacing.lg,
  },
  input: {
    flex: 1,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 20,
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    maxHeight: 100,
    fontFamily: typography.sansRegular,
    fontSize: 15,
    color: colors.text,
  },
  inputDisabled: {
    opacity: 0.7,
  },
  sendButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary,
  },
  sendButtonDisabled: {
    backgroundColor: colors.border,
  },
  sendText: {
    fontFamily: typography.sansSemiBold,
    fontSize: 18,
    color: '#fff',
    marginTop: -1,
  },
});

export default ChatScreen;
