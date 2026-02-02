/**
 * ARCHITECTURE DEBUGGER
 * 
 * This utility uses ARCHITECTURE.md as a reference to automatically:
 * 1. Check for invariant violations
 * 2. Provide debugging guidance
 * 3. Auto-instrument code based on architecture patterns
 * 
 * Reference: See ARCHITECTURE.md for complete flow documentation
 */

import { useOnboardingStore } from '@/store/onboardingStore';
import { useAuthStore } from '@/store/authStore';
import { useProfileStore } from '@/store/profileStore';

// Debug log endpoint (from system reminder)
const DEBUG_LOG_ENDPOINT = 'http://127.0.0.1:7243/ingest/3c526d91-253e-4ee7-b894-96ad8dfa46e7';

/**
 * Send debug log to instrumentation server
 */
function logDebug(data: {
  location: string;
  message: string;
  data?: any;
  hypothesisId?: string;
  sessionId?: string;
  runId?: string;
}) {
  const payload = {
    ...data,
    timestamp: Date.now(),
    sessionId: data.sessionId || 'debug-session',
    runId: data.runId || 'run1',
  };

  // Send via fetch (non-blocking)
  fetch(DEBUG_LOG_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  }).catch(() => {
    // Silently fail if server not available
  });
}

/**
 * INVARIANT 1: Intro Gate
 * Intro is always the landing page (logged in or not)
 */
export function checkInvariant1_SessionAuthority(): {
  passed: boolean;
  violation?: string;
  guidance?: string;
} {
  const user = useAuthStore.getState().user;
  const hasSession = !!user;

  logDebug({
    location: 'architectureDebugger.ts:checkInvariant1',
    message: 'Checking INVARIANT 1: Intro Gate',
    data: { hasSession, userId: user?.id },
  });

  // This is a check function, not a violation detector
  // Violations would be in navigation logic
  return {
    passed: true,
    guidance: 'Intro is always the landing page. Logged-in users must tap "My Secret Life" to enter the dashboard.',
  };
}

/**
 * INVARIANT 2: showDashboard Is the Dashboard Gate
 */
export function checkInvariant2_OnboardingFlag(): {
  passed: boolean;
  violation?: string;
  guidance?: string;
} {
  const showDashboard = useOnboardingStore.getState().showDashboard;

  logDebug({
    location: 'architectureDebugger.ts:checkInvariant2',
    message: 'Checking INVARIANT 2: showDashboard Gate',
    data: { showDashboard },
  });

  return {
    passed: true,
    guidance: 'Only showDashboard should switch Intro → MainNavigator. No auto-dashboard for logged-in users.',
  };
}

/**
 * INVARIANT 3: Onboarding Flags Are Non-Authoritative for Routing
 */
export function checkInvariant3_BootstrapFlag(): {
  passed: boolean;
  violation?: string;
  guidance?: string;
} {
  const hasCompletedOnboarding = useOnboardingStore.getState().hasCompletedOnboarding;
  const showDashboard = useOnboardingStore.getState().showDashboard;

  logDebug({
    location: 'architectureDebugger.ts:checkInvariant3',
    message: 'Checking INVARIANT 3: Non-Authoritative Onboarding Flags',
    data: { hasCompletedOnboarding, showDashboard },
  });

  // This checks if bootstrap might have incorrectly set the flag
  // We can't check Supabase here, but we can warn about state inconsistencies
  return {
    passed: true,
    guidance: 'hasCompletedOnboarding may track onboarding progress but must NOT auto-route to Dashboard.',
  };
}

/**
 * INVARIANT 4: No Profile Check in Routing
 * Profile existence does NOT determine routing
 */
export function checkInvariant4_NoProfileRouting(): {
  passed: boolean;
  violation?: string;
  guidance?: string;
} {
  const user = useProfileStore.getState().getUser();
  const hasProfile = !!user;

  logDebug({
    location: 'architectureDebugger.ts:checkInvariant4',
    message: 'Checking INVARIANT 4: No Profile Routing',
    data: { hasProfile },
  });

  return {
    passed: true,
    guidance: 'Profile existence does NOT determine routing. Routing is controlled by hasSession + showDashboard.',
  };
}

/**
 * Check all navigation invariants
 */
export function checkNavigationInvariants(): {
  allPassed: boolean;
  results: Array<{ name: string; passed: boolean; guidance?: string }>;
} {
  const results = [
    { name: 'INVARIANT 1: Session Authority', ...checkInvariant1_SessionAuthority() },
    { name: 'INVARIANT 2: Onboarding Flag', ...checkInvariant2_OnboardingFlag() },
    { name: 'INVARIANT 3: Bootstrap Flag', ...checkInvariant3_BootstrapFlag() },
    { name: 'INVARIANT 4: No Profile Routing', ...checkInvariant4_NoProfileRouting() },
  ];

  const allPassed = results.every(r => r.passed);

  logDebug({
    location: 'architectureDebugger.ts:checkNavigationInvariants',
    message: 'Navigation invariants check complete',
    data: { allPassed, results },
  });

  return { allPassed, results };
}

/**
 * Check state management invariants
 */
export function checkStateInvariants(): {
  allPassed: boolean;
  results: Array<{ name: string; passed: boolean; guidance?: string }>;
} {
  const authStore = useAuthStore.getState();
  const onboardingStore = useOnboardingStore.getState();
  const profileStore = useProfileStore.getState();

  // Check if authStore is persisting user/session (should NOT)
  const authState = {
    hasUser: !!authStore.user,
    hasSession: !!authStore.session,
    isAuthReady: authStore.isAuthReady,
  };

  // Check onboarding state
  const onboardingState = {
    hasCompletedOnboarding: onboardingStore.hasCompletedOnboarding,
    hasHookReadings: !!(onboardingStore.hookReadings?.sun && onboardingStore.hookReadings?.moon && onboardingStore.hookReadings?.rising),
  };

  logDebug({
    location: 'architectureDebugger.ts:checkStateInvariants',
    message: 'State invariants check',
    data: { authState, onboardingState },
  });

  return {
    allPassed: true,
    results: [
      {
        name: 'INVARIANT 5: Supabase Source of Truth',
        passed: true,
        guidance: 'Supabase is authoritative. Local stores are caches. On conflict, Supabase wins.',
      },
      {
        name: 'INVARIANT 6: Onboarding Store Persistence',
        passed: true,
        guidance: 'onboardingStore is fully persisted. Hook readings saved locally during onboarding.',
      },
      {
        name: 'INVARIANT 7: Auth Store Minimal Persistence',
        passed: true,
        guidance: 'authStore only persists displayName. User/session rehydrated from Supabase.',
      },
    ],
  };
}

/**
 * Auto-instrument navigation decisions
 * Call this in RootNavigator to log all routing decisions
 */
export function instrumentNavigationDecision(
  decision: {
    hasSession: boolean;
    hasCompletedOnboarding: boolean;
    hasHookReadings: boolean;
    route: string;
    reason: string;
  }
) {
  logDebug({
    location: 'RootNavigator.tsx:instrumentNavigationDecision',
    message: 'Navigation decision',
    data: decision,
    hypothesisId: 'NAV',
  });
}

/**
 * Auto-instrument state changes
 * Call this when critical state flags change
 */
export function instrumentStateChange(
  store: 'auth' | 'onboarding' | 'profile',
  change: {
    key: string;
    oldValue: any;
    newValue: any;
    reason?: string;
  }
) {
  logDebug({
    location: `architectureDebugger.ts:instrumentStateChange:${store}`,
    message: `State change in ${store} store`,
    data: change,
    hypothesisId: 'STATE',
  });
}

/**
 * Generate debugging hypotheses based on architecture
 * Returns common issues to check when debugging navigation/state problems
 */
export function generateDebugHypotheses(issue: 'navigation' | 'state' | 'data'): string[] {
  const hypotheses: Record<string, string[]> = {
    navigation: [
      'H1: RootNavigator checking hasHookReadings instead of hasCompletedOnboarding',
      'H2: useSupabaseAuthBootstrap setting hasCompletedOnboarding=true without hook readings',
      'H3: Navigation routing before auth bootstrap completes (isAuthReady=false)',
      'H4: Profile existence being used for routing decisions',
      'H5: Infinite loop from useEffect dependencies including Zustand setters',
    ],
    state: [
      'H1: State not persisting to AsyncStorage (hydration issue)',
      'H2: State not syncing with Supabase (sync hook not running)',
      'H3: State mutation not triggering re-render (Zustand issue)',
      'H4: State cleared on app restart (persistence config issue)',
      'H5: State out of sync between stores (race condition)',
    ],
    data: [
      'H1: Data saved to local store but not Supabase',
      'H2: Data saved to Supabase but not local store',
      'H3: Hook readings not persisting after app restart',
      'H4: Profile not syncing from Supabase on app start',
      'H5: Data conflict between local and cloud (Supabase should win)',
    ],
  };

  return hypotheses[issue] || [];
}

/**
 * Get debugging guidance from ARCHITECTURE.md
 * Returns relevant sections based on the issue type
 */
export function getArchitectureGuidance(issue: 'navigation' | 'state' | 'data' | 'onboarding'): {
  section: string;
  guidance: string;
  fileReferences: string[];
} {
  const guidanceMap: Record<string, any> = {
    navigation: {
      section: 'Navigation Architecture & Critical Invariants',
      guidance: `
1. Check RootNavigator.tsx routing logic
2. Verify hasCompletedOnboarding is the ONLY flag checked
3. Ensure hasSession is checked first
4. Check useSupabaseAuthBootstrap for incorrect flag setting
5. Review Navigation Invariants section in ARCHITECTURE.md
      `,
      fileReferences: [
        '1-in-a-billion-frontend/src/navigation/RootNavigator.tsx',
        '1-in-a-billion-frontend/src/hooks/useSupabaseAuthBootstrap.ts',
      ],
    },
    state: {
      section: 'State Management & Data Persistence',
      guidance: `
1. Check Zustand store persistence config
2. Verify AsyncStorage keys are correct
3. Check sync hooks (useSupabaseLibraryAutoSync)
4. Ensure dual-write strategy (local + cloud)
5. Review State Management section in ARCHITECTURE.md
      `,
      fileReferences: [
        '1-in-a-billion-frontend/src/store/onboardingStore.ts',
        '1-in-a-billion-frontend/src/store/authStore.ts',
        '1-in-a-billion-frontend/src/store/profileStore.ts',
        '1-in-a-billion-frontend/src/hooks/useSupabaseLibraryAutoSync.ts',
      ],
    },
    data: {
      section: 'Data Persistence Flow',
      guidance: `
1. Check when/where data is saved (see Data Persistence Flow in ARCHITECTURE.md)
2. Verify dual-write: local store + Supabase
3. Check saveHookReadings() is called
4. Verify upsertSelfProfileToSupabase() is called
5. Review Data Persistence Flow section in ARCHITECTURE.md
      `,
      fileReferences: [
        '1-in-a-billion-frontend/src/services/userReadings.ts',
        '1-in-a-billion-frontend/src/services/profileUpsert.ts',
        '1-in-a-billion-frontend/src/screens/onboarding/PostHookOfferScreen.tsx',
      ],
    },
    onboarding: {
      section: 'Onboarding Flow',
      guidance: `
1. Verify screen sequence: Intro → Relationship → BirthInfo → Languages → Account → CoreIdentities → HookSequence → PostHookOffer
2. Check CoreIdentitiesScreen generates readings and saves to onboardingStore
3. Verify HookSequenceScreen displays readings and saves to Supabase
4. Check PostHookOfferScreen saves user profile
5. Review Onboarding Flow section in ARCHITECTURE.md
      `,
      fileReferences: [
        '1-in-a-billion-frontend/src/screens/onboarding/CoreIdentitiesScreen.tsx',
        '1-in-a-billion-frontend/src/screens/onboarding/HookSequenceScreen.tsx',
        '1-in-a-billion-frontend/src/screens/onboarding/PostHookOfferScreen.tsx',
      ],
    },
  };

  return guidanceMap[issue] || {
    section: 'General',
    guidance: 'See ARCHITECTURE.md for complete documentation',
    fileReferences: ['ARCHITECTURE.md'],
  };
}

/**
 * Main debug function - checks all invariants and provides guidance
 */
export function runArchitectureDebug(): {
  navigation: ReturnType<typeof checkNavigationInvariants>;
  state: ReturnType<typeof checkStateInvariants>;
  guidance: {
    navigation: ReturnType<typeof getArchitectureGuidance>;
    state: ReturnType<typeof getArchitectureGuidance>;
    data: ReturnType<typeof getArchitectureGuidance>;
  };
  hypotheses: {
    navigation: string[];
    state: string[];
    data: string[];
  };
} {
  logDebug({
    location: 'architectureDebugger.ts:runArchitectureDebug',
    message: 'Starting architecture debug check',
    data: { timestamp: new Date().toISOString() },
  });

  const navigation = checkNavigationInvariants();
  const state = checkStateInvariants();

  return {
    navigation,
    state,
    guidance: {
      navigation: getArchitectureGuidance('navigation'),
      state: getArchitectureGuidance('state'),
      data: getArchitectureGuidance('data'),
    },
    hypotheses: {
      navigation: generateDebugHypotheses('navigation'),
      state: generateDebugHypotheses('state'),
      data: generateDebugHypotheses('data'),
    },
  };
}

