# Pre-Deploy Deep Audit (V2 vs Original)

Generated: 2026-02-12
Workspace: `/Users/michaelperinwogenburg/Desktop/big-challenge/1-in-a-billion-v2`
Baseline: `/Users/michaelperinwogenburg/Desktop/big-challenge/ONEINABILLIONAPP/1-in-a-billion-frontend`

## What Was Audited
- File-by-file parity against original source tree (`PREDEPLOY_PARITY_MATRIX.tsv`)
- Route declaration vs route usage integrity
- Media asset reference integrity (`require(...)` resolution)
- TypeScript compile gate
- Expo deploy/runtime health gate (`expo-doctor`)
- Payment/sign-up/sign-in/dashboard routing invariants

## High-Level Results
- TS typecheck: PASS (`npm run typecheck`)
- Route targets unresolved in V2: 0
- Local media references missing: 0
- Common files compared: 93
- Changed common files: 89
- Same common files: 4
- Missing in V2 (vs original): 96 files
- New in V2: 4 files

## Findings (Severity Ordered)

### P0 - Dashboard routing can regress to Intro for authenticated returning users
- Evidence: `RootNavigator` gates main app on `hasSession && showDashboard` only.
- `showDashboard` is non-persisted and defaults `false` after app restart.
- This means a valid signed-in session can still render onboarding intro instead of dashboard on cold launch.
- File refs:
  - `/Users/michaelperinwogenburg/Desktop/big-challenge/1-in-a-billion-v2/src/navigation/RootNavigator.tsx:487`
  - `/Users/michaelperinwogenburg/Desktop/big-challenge/1-in-a-billion-v2/src/store/onboardingStore.ts:178`
  - `/Users/michaelperinwogenburg/Desktop/big-challenge/1-in-a-billion-v2/src/store/onboardingStore.ts:373`

### P0 - Sign-in screen can bypass payment-gated onboarding policy
- Evidence: Sign-in success sets `setShowDashboard(true)` directly for email/OAuth flows.
- If OAuth creates a new auth user (or any unpaid account exists), the app can enter dashboard without passing PostHookOffer->payment->Account flow.
- File refs:
  - `/Users/michaelperinwogenburg/Desktop/big-challenge/1-in-a-billion-v2/src/screens/auth/SignInScreen.tsx:119`
  - `/Users/michaelperinwogenburg/Desktop/big-challenge/1-in-a-billion-v2/src/screens/auth/SignInScreen.tsx:144`
  - `/Users/michaelperinwogenburg/Desktop/big-challenge/1-in-a-billion-v2/src/screens/auth/SignInScreen.tsx:159`
  - `/Users/michaelperinwogenburg/Desktop/big-challenge/1-in-a-billion-v2/src/screens/auth/SignInScreen.tsx:240`

### P0 - Expo dependency gate fails for deployable builds
- `expo-doctor` failed with required peer dependencies missing as direct deps:
  - `react`
  - `react-native`
  - `react-native-screens`
  - `expo-font`
- Also reported SDK version mismatches:
  - `@react-native-community/datetimepicker` (`8.6.0` vs expected `8.4.4`)
  - `react-native-gesture-handler` (`2.30.0` vs expected `~2.28.0`)
  - `@types/react` mismatch
- File refs:
  - `/Users/michaelperinwogenburg/Desktop/big-challenge/1-in-a-billion-v2/package.json:5`

## Medium-Risk Observations

### P1 - Onboarding completion flag is set before payment/account finalization
- `CoreIdentitiesScreen` calls `setHasCompletedOnboarding(true)` before PostHookOffer and Account completion.
- This is not currently used for route gating in `RootNavigator`, but it weakens state invariants and can cause future regressions if that flag is reused.
- File refs:
  - `/Users/michaelperinwogenburg/Desktop/big-challenge/1-in-a-billion-v2/src/screens/onboarding/CoreIdentitiesScreen.tsx:289`

## Intentional Migration Delta (Not Auto-Flagged as Bugs)
- Old routes removed in V2 declaration set (23):
  - `AudioPlayer`, `Chat`, `DeepReadingReader`, `ExtendedReading`, `FreeReadingSelection`, `FullReading`, `Purchase`, `ReadingChapter`, `SavedReading`, `SystemOverview`, `WhyDifferent`, etc.
- Old navigation targets unresolved in V2 (12):
  - `AudioPlayer`, `Chat`, `DeepReadingReader`, `ExtendedReading`, `FreeReadingSelection`, `FullReading`, `OverlayReader`, `Purchase`, `ReadingChapter`, `SavedReading`, `SystemOverview`, `WhyDifferent`
- These are migration-scope gaps and may be intentional per product decisions; not runtime unresolved targets in current V2 code.

## Route Integrity Check (Current V2)
- Declared routes in RootNavigator: 44
- Targeted route names in code: 44
- Unresolved route names: 0

## Media Integrity Check (Current V2)
- Static `require(...)` media refs inspected: 19
- Missing local media assets: 0

## Pre-Deploy Gate Recommendation
Block deploy until all P0 findings are resolved.

## Suggested Fix Order
1. Fix RootNavigator gate to respect authenticated + completed state consistently.
2. Enforce entitlement/payment check before any dashboard entry in sign-in paths.
3. Align dependencies with Expo SDK (`expo install` set) and re-run `expo-doctor` until clean.
4. Re-run full gate: typecheck + expo-doctor + route/media checks.

## Post-Fix Verification (2026-02-12)
- `npm run typecheck`: PASS
- `npx expo-doctor`: PASS (`17/17 checks passed`)
- Implemented fixes:
  - `RootNavigator` now allows Main stack when session exists and either `showDashboard` or persisted onboarding completion is true.
  - `SignInScreen` now verifies paid entitlement before allowing dashboard access.
  - Dependency set aligned for Expo SDK 54 (React/React Native/screens/font and version alignment).
  - Removed premature onboarding-complete mutation in `CoreIdentitiesScreen`.

## Additional Hard-Lock (2026-02-12)
- Added root-level entitlement verification before rendering Main stack:
  - `/Users/michaelperinwogenburg/Desktop/big-challenge/1-in-a-billion-v2/src/navigation/RootNavigator.tsx`
  - Main stack now requires `entitlementStatus === 'active'` (unless `ALLOW_PAYMENT_BYPASS`).
  - Explicit inactive entitlement signs user out and clears onboarding/dashboard gate flags.
- Added Intro "My Secret Life" entitlement check:
  - `/Users/michaelperinwogenburg/Desktop/big-challenge/1-in-a-billion-v2/src/screens/onboarding/IntroScreen.tsx`
  - Logged-in users can only enter dashboard after backend entitlement verification.
