/**
 * SESSION MONITOR
 *
 * Monitors API responses for 401 errors indicating expired sessions.
 * Redirects to sign-in when session is no longer valid.
 */

import { useEffect, useRef } from 'react';
import { Alert } from 'react-native';
import { useAuthStore } from '../store/authStore';
import { logger } from '../utils/logger';

/**
 * Hook that listens for session expiry events.
 * Should be used in RootNavigator or App.tsx.
 */
export function useSessionMonitor() {
  const signOut = useAuthStore((state) => state.signOut);
  const user = useAuthStore((state) => state.user);
  const hasAlerted = useRef(false);

  useEffect(() => {
    // Reset alert flag when user changes
    hasAlerted.current = false;
  }, [user?.id]);

  const handleSessionExpired = () => {
    if (hasAlerted.current) return;
    hasAlerted.current = true;

    logger.warn('Session expired, redirecting to sign-in');
    Alert.alert(
      'Session Expired',
      'Your session has expired. Please sign in again.',
      [
        {
          text: 'OK',
          onPress: () => {
            signOut();
          },
        },
      ]
    );
  };

  return { handleSessionExpired };
}
