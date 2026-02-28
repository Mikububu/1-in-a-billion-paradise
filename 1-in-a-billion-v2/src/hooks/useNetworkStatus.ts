/**
 * NETWORK STATUS HOOK
 *
 * Detects online/offline state.
 * Uses a simple polling approach since @react-native-community/netinfo
 * may not be installed yet.
 */

import { useState, useEffect, useRef } from 'react';
import { AppState, AppStateStatus } from 'react-native';
import { logger } from '../utils/logger';

/**
 * Returns whether the device appears to be online.
 * Falls back to assuming online if detection fails.
 */
export function useNetworkStatus() {
  const [isConnected, setIsConnected] = useState(true);
  const appState = useRef(AppState.currentState);

  useEffect(() => {
    // Check connectivity when app comes to foreground
    const handleAppStateChange = (nextAppState: AppStateStatus) => {
      if (appState.current.match(/inactive|background/) && nextAppState === 'active') {
        checkConnectivity();
      }
      appState.current = nextAppState;
    };

    const subscription = AppState.addEventListener('change', handleAppStateChange);

    // Initial check
    checkConnectivity();

    return () => {
      subscription.remove();
    };
  }, []);

  async function checkConnectivity() {
    try {
      // Simple connectivity check - try to reach the backend health endpoint
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 5000);

      const response = await fetch('https://1-in-a-billion-backend.fly.dev/health', {
        method: 'HEAD',
        signal: controller.signal,
      });
      clearTimeout(timeout);

      const online = response.ok;
      if (!online && isConnected) {
        logger.warn('Network appears offline');
      }
      setIsConnected(online);
    } catch {
      setIsConnected(false);
    }
  }

  return { isConnected };
}
