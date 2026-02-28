/**
 * GLOBAL ERROR HANDLER
 *
 * Catches unhandled promise rejections and JS errors
 * that escape React's ErrorBoundary.
 */

import { logger } from './logger';
import { Alert, Platform } from 'react-native';

let isInitialized = false;

/**
 * Initialize global error handlers.
 * Call once in App.tsx on mount.
 */
export function initGlobalErrorHandler() {
  if (isInitialized) return;
  isInitialized = true;

  // Catch unhandled promise rejections
  const originalHandler = (global as any).ErrorUtils?.getGlobalHandler?.();

  (global as any).ErrorUtils?.setGlobalHandler?.((error: Error, isFatal?: boolean) => {
    logger.error('Global error caught', { message: error.message, isFatal, stack: error.stack });

    if (isFatal) {
      Alert.alert(
        'Unexpected Error',
        'The app encountered an unexpected error. Please restart the app.',
        [{ text: 'OK' }]
      );
    }

    // Call the original handler
    originalHandler?.(error, isFatal);
  });

  // Unhandled promise rejections (React Native)
  if (Platform.OS !== 'web') {
    const tracking = require('promise/setimmediate/rejection-tracking');
    tracking.enable({
      allRejections: true,
      onUnhandled: (id: number, error: Error) => {
        logger.error('Unhandled promise rejection', { id, message: error?.message });
      },
      onHandled: () => {},
    });
  }
}
