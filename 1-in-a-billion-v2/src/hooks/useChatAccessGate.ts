import { useCallback, useRef, useState } from 'react';
import { Alert } from 'react-native';
import { useAuthStore } from '@/store/authStore';
import { renewChatAccess } from '@/services/chatRenewal';
import { isChatAccessBlocked } from '@/utils/chatAccess';

export function useChatAccessGate() {
  const entitlementState = useAuthStore((s) => s.entitlementState);
  const setEntitlementState = useAuthStore((s) => s.setEntitlementState);
  const userId = useAuthStore((s) => s.session?.user?.id || s.user?.id || null);

  const [modalVisible, setModalVisible] = useState(false);
  const [renewing, setRenewing] = useState(false);
  const pendingActionRef = useRef<(() => void) | null>(null);

  const chatBlocked = isChatAccessBlocked(entitlementState);

  const closeRenewModal = useCallback(() => {
    pendingActionRef.current = null;
    setModalVisible(false);
  }, []);

  const showRenewModal = useCallback(() => {
    setModalVisible(true);
  }, []);

  const runWithChatAccess = useCallback(
    (action: () => void) => {
      if (chatBlocked) {
        pendingActionRef.current = action;
        setModalVisible(true);
        return;
      }
      action();
    },
    [chatBlocked]
  );

  const renewNow = useCallback(async () => {
    if (renewing) return;

    setRenewing(true);
    try {
      const result = await renewChatAccess(userId);
      if (result.success && result.active) {
        setEntitlementState('active');
        setModalVisible(false);

        const pending = pendingActionRef.current;
        pendingActionRef.current = null;
        pending?.();
        return;
      }

      if (result.cancelled) {
        return;
      }

      Alert.alert('Renewal failed', result.error || 'Could not reactivate subscription.');
    } finally {
      setRenewing(false);
    }
  }, [renewing, setEntitlementState, userId]);

  return {
    chatBlocked,
    runWithChatAccess,
    showRenewModal,
    closeRenewModal,
    renewNow,
    modalVisible,
    renewing,
  };
}
