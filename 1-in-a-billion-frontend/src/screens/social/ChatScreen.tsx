/**
 * CHAT SCREEN
 * 
 * Individual chat conversation between two matched users.
 * Shows messages with the system welcome message at the top.
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  StyleSheet,
  Text,
  View,
  FlatList,
  TextInput,
  TouchableOpacity,
  Image,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { colors, spacing, typography } from '@/theme/tokens';
import { MainStackParamList } from '@/navigation/RootNavigator';
import { useAuthStore } from '@/store/authStore';
import { env } from '@/config/env';

type Props = NativeStackScreenProps<MainStackParamList, 'Chat'>;

interface Message {
  id: string;
  conversationId: string;
  senderId: string;
  content: string;
  messageType: string;
  isSystemMessage: boolean;
  readAt: string | null;
  createdAt: string;
}

export const ChatScreen = ({ navigation, route }: Props) => {
  const { conversationId, otherName, otherClaymationUrl } = route.params;
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const flatListRef = useRef<FlatList>(null);
  const userId = useAuthStore((s) => s.userId);

  const fetchMessages = useCallback(async () => {
    try {
      const response = await fetch(
        `${env.CORE_API_URL}/api/chat/conversations/${conversationId}/messages`,
        { headers: { 'X-User-Id': userId || '' } }
      );
      const data = await response.json();
      
      if (data.success) {
        setMessages(data.messages);
        
        // Mark as read
        fetch(`${env.CORE_API_URL}/api/chat/conversations/${conversationId}/read`, {
          method: 'POST',
          headers: { 'X-User-Id': userId || '' },
        });
      }
    } catch (error) {
      console.error('Messages fetch error:', error);
    } finally {
      setLoading(false);
    }
  }, [conversationId, userId]);

  useEffect(() => {
    fetchMessages();
    
    // Poll for new messages every 5 seconds
    const interval = setInterval(fetchMessages, 5000);
    return () => clearInterval(interval);
  }, [fetchMessages]);

  const handleSend = async () => {
    if (!newMessage.trim() || sending) return;

    setSending(true);
    const messageContent = newMessage.trim();
    setNewMessage('');

    // Optimistic update
    const tempMessage: Message = {
      id: `temp-${Date.now()}`,
      conversationId,
      senderId: userId || '',
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
            'X-User-Id': userId || '',
          },
          body: JSON.stringify({ content: messageContent }),
        }
      );
      const data = await response.json();
      
      if (data.success) {
        // Replace temp message with real one
        setMessages((prev) =>
          prev.map((m) => (m.id === tempMessage.id ? data.message : m))
        );
      }
    } catch (error) {
      console.error('Send message error:', error);
      // Remove temp message on error
      setMessages((prev) => prev.filter((m) => m.id !== tempMessage.id));
    } finally {
      setSending(false);
    }
  };

  const renderMessage = ({ item }: { item: Message }) => {
    const isOwnMessage = item.senderId === userId;
    const isSystem = item.isSystemMessage;

    if (isSystem) {
      return (
        <View style={styles.systemMessage}>
          <Text style={styles.systemIcon}>✨</Text>
          <Text style={styles.systemText}>{item.content}</Text>
        </View>
      );
    }

    return (
      <View style={[styles.messageBubble, isOwnMessage ? styles.ownMessage : styles.otherMessage]}>
        <Text style={[styles.messageText, isOwnMessage && styles.ownMessageText]}>
          {item.content}
        </Text>
        <Text style={[styles.messageTime, isOwnMessage && styles.ownMessageTime]}>
          {new Date(item.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </Text>
      </View>
    );
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Text style={styles.backArrow}>←</Text>
        </TouchableOpacity>
        
        <View style={styles.headerProfile}>
          {otherClaymationUrl ? (
            <Image source={{ uri: otherClaymationUrl }} style={styles.headerImage} />
          ) : (
            <View style={[styles.headerImage, styles.headerPlaceholder]}>
              <Text style={styles.headerInitial}>{otherName?.charAt(0) || '?'}</Text>
            </View>
          )}
          <Text style={styles.headerName}>{otherName}</Text>
        </View>
        
        <View style={{ width: 40 }} />
      </View>

      {/* Messages */}
      <FlatList
        ref={flatListRef}
        data={messages}
        renderItem={renderMessage}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.messagesList}
        showsVerticalScrollIndicator={false}
        onContentSizeChange={() => flatListRef.current?.scrollToEnd()}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>Start your conversation</Text>
          </View>
        }
      />

      {/* Input */}
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={0}
      >
        <View style={styles.inputContainer}>
          <TextInput
            style={styles.input}
            value={newMessage}
            onChangeText={setNewMessage}
            placeholder="Type a message..."
            placeholderTextColor={colors.mutedText}
            multiline
            maxLength={1000}
          />
          <TouchableOpacity
            style={[styles.sendButton, !newMessage.trim() && styles.sendButtonDisabled]}
            onPress={handleSend}
            disabled={!newMessage.trim() || sending}
          >
            <Text style={styles.sendIcon}>{sending ? '...' : '→'}</Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.pageBg,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  
  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    backgroundColor: colors.cardBg,
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
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerInitial: {
    fontFamily: typography.sansBold,
    fontSize: 16,
    color: '#fff',
  },
  headerName: {
    fontFamily: typography.sansSemiBold,
    fontSize: 16,
    color: colors.text,
  },
  
  // Messages
  messagesList: {
    padding: spacing.md,
    paddingBottom: spacing.xl,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: spacing.xxl,
  },
  emptyText: {
    fontFamily: typography.sansRegular,
    fontSize: 14,
    color: colors.mutedText,
  },
  
  systemMessage: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    padding: spacing.md,
    backgroundColor: 'rgba(139, 92, 246, 0.1)',
    borderRadius: 16,
    marginBottom: spacing.lg,
    borderLeftWidth: 3,
    borderLeftColor: '#8B5CF6',
  },
  systemIcon: {
    fontSize: 18,
  },
  systemText: {
    flex: 1,
    fontFamily: typography.sansItalic,
    fontSize: 14,
    color: colors.text,
    lineHeight: 22,
  },
  
  messageBubble: {
    maxWidth: '80%',
    padding: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: 18,
    marginBottom: spacing.sm,
  },
  ownMessage: {
    alignSelf: 'flex-end',
    backgroundColor: colors.primary,
    borderBottomRightRadius: 4,
  },
  otherMessage: {
    alignSelf: 'flex-start',
    backgroundColor: colors.cardBg,
    borderBottomLeftRadius: 4,
    borderWidth: 1,
    borderColor: colors.border,
  },
  messageText: {
    fontFamily: typography.sansRegular,
    fontSize: 15,
    color: colors.text,
    lineHeight: 21,
  },
  ownMessageText: {
    color: '#fff',
  },
  messageTime: {
    fontFamily: typography.sansRegular,
    fontSize: 10,
    color: colors.mutedText,
    marginTop: 4,
    alignSelf: 'flex-end',
  },
  ownMessageTime: {
    color: 'rgba(255,255,255,0.7)',
  },
  
  // Input
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    padding: spacing.md,
    paddingBottom: spacing.lg,
    gap: spacing.sm,
    backgroundColor: colors.cardBg,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  input: {
    flex: 1,
    fontFamily: typography.sansRegular,
    fontSize: 15,
    color: colors.text,
    backgroundColor: colors.pageBg,
    borderRadius: 20,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    maxHeight: 100,
  },
  sendButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  sendButtonDisabled: {
    backgroundColor: colors.border,
  },
  sendIcon: {
    fontFamily: typography.sansBold,
    fontSize: 18,
    color: '#fff',
  },
});

export default ChatScreen;
