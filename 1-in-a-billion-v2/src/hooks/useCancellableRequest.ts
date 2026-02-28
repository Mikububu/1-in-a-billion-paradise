/**
 * CANCELLABLE REQUEST HOOK
 *
 * Provides an AbortController that automatically cancels on unmount.
 * Prevents "Can't perform a React state update on an unmounted component".
 */

import { useRef, useEffect, useCallback } from 'react';

/**
 * Returns a function that creates AbortSignals.
 * All signals are automatically aborted when the component unmounts.
 */
export function useCancellableRequest() {
  const controllersRef = useRef<AbortController[]>([]);

  useEffect(() => {
    return () => {
      // Cancel all pending requests on unmount
      for (const controller of controllersRef.current) {
        controller.abort();
      }
      controllersRef.current = [];
    };
  }, []);

  const createSignal = useCallback((): AbortSignal => {
    const controller = new AbortController();
    controllersRef.current.push(controller);

    // Clean up completed controllers
    controllersRef.current = controllersRef.current.filter(
      (c) => !c.signal.aborted
    );

    return controller.signal;
  }, []);

  const cancelAll = useCallback(() => {
    for (const controller of controllersRef.current) {
      controller.abort();
    }
    controllersRef.current = [];
  }, []);

  return { createSignal, cancelAll };
}
