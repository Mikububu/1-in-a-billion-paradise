import React from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { Button } from '@/components/Button';
import { colors, radii, spacing, typography } from '@/theme/tokens';
import {
  CHAT_RENEW_MODAL_MESSAGE,
  CHAT_RENEW_PRIMARY_LABEL,
  CHAT_RENEW_SECONDARY_LABEL,
} from '@/utils/chatAccess';

type ChatAccessRenewModalProps = {
  visible: boolean;
  renewing?: boolean;
  onRenew: () => void;
  onClose: () => void;
};

export function ChatAccessRenewModal({
  visible,
  renewing = false,
  onRenew,
  onClose,
}: ChatAccessRenewModalProps) {
  return (
    <Modal
      transparent
      visible={visible}
      animationType="fade"
      onRequestClose={onClose}
    >
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={styles.card} onPress={(e) => e.stopPropagation()}>
          <Text style={styles.message}>{CHAT_RENEW_MODAL_MESSAGE}</Text>
          <View style={styles.actions}>
            <Button
              label={CHAT_RENEW_PRIMARY_LABEL}
              onPress={onRenew}
              loading={renewing}
              style={styles.primaryBtn}
            />
            <Button
              label={CHAT_RENEW_SECONDARY_LABEL}
              onPress={onClose}
              disabled={renewing}
              variant="secondary"
              style={styles.secondaryBtn}
            />
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.48)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: spacing.page,
  },
  card: {
    width: '100%',
    maxWidth: 420,
    borderRadius: radii.modal,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.lg,
  },
  message: {
    fontFamily: typography.sansSemiBold,
    fontSize: 16,
    lineHeight: 22,
    color: colors.text,
    textAlign: 'center',
  },
  actions: {
    marginTop: spacing.lg,
    gap: spacing.sm,
  },
  primaryBtn: {
    width: '100%',
  },
  secondaryBtn: {
    width: '100%',
  },
});

export default ChatAccessRenewModal;
