type AuthProvider = 'google' | 'apple' | 'email';
type AuthOutcome = 'cancel' | 'error';

/**
 * Dev-only auth failure/cancel logger.
 * Intentionally invisible to users (no UI).
 */
export function logAuthIssue(event: {
  provider: AuthProvider;
  outcome: AuthOutcome;
  detail?: string;
  context?: string;
}) {
  if (!__DEV__) return;

  const payload = {
    ...event,
    ts: Date.now(),
  };

  // Primary sink: Metro logs (fast, always available in dev).
  // eslint-disable-next-line no-console
  console.log('🔐 AUTH_ISSUE', payload);

  // Secondary sink: optional dev instrumentation (best-effort).
  // import('@/utils/architectureDebugger')... removed for v2 migration
}

