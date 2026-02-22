# Deploy QA Checklist (V2)

Updated: 2026-02-14
Scope: static code QA only (no simulator/device runtime in this pass)
Project: `/Users/michaelperinwogenburg/Desktop/big-challenge/1-in-a-billion-v2`

## 1) Onboarding + Payment + Dashboard

- `PASS`: Intro -> onboarding start is wired.
  - `Get Started` goes to `Relationship` in `/Users/michaelperinwogenburg/Desktop/big-challenge/1-in-a-billion-v2/src/screens/onboarding/IntroScreen.tsx`.
- `PASS`: Birth flow chain is wired.
  - `BirthInfo -> Languages` in `/Users/michaelperinwogenburg/Desktop/big-challenge/1-in-a-billion-v2/src/screens/onboarding/BirthInfoScreen.tsx`.
- `PASS`: Registration now starts immediately after language selection.
  - `Languages -> Account (captureOnly)` in `/Users/michaelperinwogenburg/Desktop/big-challenge/1-in-a-billion-v2/src/screens/onboarding/LanguagesScreen.tsx`.
  - Pre-payment account signup returns to `CoreIdentitiesIntro` in `/Users/michaelperinwogenburg/Desktop/big-challenge/1-in-a-billion-v2/src/screens/onboarding/AccountScreen.tsx`.
- `PASS`: Post-languages re-entry lock is wired.
  - `hasPassedLanguages` persisted in `/Users/michaelperinwogenburg/Desktop/big-challenge/1-in-a-billion-v2/src/store/onboardingStore.ts`.
  - `BirthInfo` and `Languages` auto-forward when lock is set:
    - `/Users/michaelperinwogenburg/Desktop/big-challenge/1-in-a-billion-v2/src/screens/onboarding/BirthInfoScreen.tsx`
    - `/Users/michaelperinwogenburg/Desktop/big-challenge/1-in-a-billion-v2/src/screens/onboarding/LanguagesScreen.tsx`
- `PASS`: Hook flow chain remains wired after account capture.
  - `CoreIdentitiesIntro -> CoreIdentities` auto-forward in `/Users/michaelperinwogenburg/Desktop/big-challenge/1-in-a-billion-v2/src/screens/onboarding/CoreIdentitiesIntroScreen.tsx`.
  - `HookSequence -> AddThirdPersonPrompt` in `/Users/michaelperinwogenburg/Desktop/big-challenge/1-in-a-billion-v2/src/screens/onboarding/HookSequenceScreen.tsx`.
  - `AddThirdPersonPrompt -> PostHookOffer` in `/Users/michaelperinwogenburg/Desktop/big-challenge/1-in-a-billion-v2/src/screens/onboarding/AddThirdPersonPromptScreen.tsx`.
- `PASS`: Payment gate into dashboard is enforced.
  - `PostHookOffer` routes to `Account` after purchase/verification path in `/Users/michaelperinwogenburg/Desktop/big-challenge/1-in-a-billion-v2/src/screens/onboarding/PostHookOfferScreen.tsx`.
  - `AccountScreen` has paid-finalization path (`fromPayment`) and capture-only path in `/Users/michaelperinwogenburg/Desktop/big-challenge/1-in-a-billion-v2/src/screens/onboarding/AccountScreen.tsx`.
- `PASS`: After paid finalization, dashboard handoff is wired.
  - `completeOnboarding()` sets `showDashboard: true` in `/Users/michaelperinwogenburg/Desktop/big-challenge/1-in-a-billion-v2/src/store/onboardingStore.ts`.
  - Root uses `hasSession && (showDashboard || hasCompletedOnboarding)` in `/Users/michaelperinwogenburg/Desktop/big-challenge/1-in-a-billion-v2/src/navigation/RootNavigator.tsx`.

## 2) Reading Flow (System -> Context -> Voice -> Tree -> Generation -> Result)

- `PASS`: System-to-context flow is wired.
  - `SystemSelection -> PersonalContext/RelationshipContext` in `/Users/michaelperinwogenburg/Desktop/big-challenge/1-in-a-billion-v2/src/screens/home/SystemSelectionScreen.tsx`.
  - Context screens route to `VoiceSelection` in:
    - `/Users/michaelperinwogenburg/Desktop/big-challenge/1-in-a-billion-v2/src/screens/home/PersonalContextScreen.tsx`
    - `/Users/michaelperinwogenburg/Desktop/big-challenge/1-in-a-billion-v2/src/screens/home/RelationshipContextScreen.tsx`
- `PASS`: Voice-to-job flow is wired.
  - `VoiceSelection` starts `/api/jobs/v2/start` then `replace('TreeOfLifeVideo')` in `/Users/michaelperinwogenburg/Desktop/big-challenge/1-in-a-billion-v2/src/screens/home/VoiceSelectionScreen.tsx`.
- `PASS`: Tree-of-life transition is wired.
  - `TreeOfLifeVideo -> replace('GeneratingReading')` in `/Users/michaelperinwogenburg/Desktop/big-challenge/1-in-a-billion-v2/src/screens/home/TreeOfLifeVideoScreen.tsx`.
- `PASS`: Generation-to-live-status flow is wired.
  - `GeneratingReading` offers `JobDetail` jump in `/Users/michaelperinwogenburg/Desktop/big-challenge/1-in-a-billion-v2/src/screens/home/GeneratingReadingScreen.tsx`.
- `PASS`: Live-status-to-content flow is wired with readiness gate.
  - `JobDetail` auto-opens `ReadingContent` only when Text + Audio + Song + PDF are ready in `/Users/michaelperinwogenburg/Desktop/big-challenge/1-in-a-billion-v2/src/screens/home/JobDetailScreen.tsx`.

## 3) Subscription Expiry + Chat Gate Behavior

- `PASS`: Expired subscriptions do not lock app navigation for paid users.
  - Intro + SignIn gate dashboard access when onboarding/payment is incomplete in:
    - `/Users/michaelperinwogenburg/Desktop/big-challenge/1-in-a-billion-v2/src/screens/onboarding/IntroScreen.tsx`
    - `/Users/michaelperinwogenburg/Desktop/big-challenge/1-in-a-billion-v2/src/screens/auth/SignInScreen.tsx`
- `PASS`: Warning text shown in dashboard/gallery/chat list.
  - Uses `CHAT_RENEW_WARNING_TEXT` in:
    - `/Users/michaelperinwogenburg/Desktop/big-challenge/1-in-a-billion-v2/src/screens/home/HomeScreen.tsx`
    - `/Users/michaelperinwogenburg/Desktop/big-challenge/1-in-a-billion-v2/src/screens/social/GalleryScreen.tsx`
    - `/Users/michaelperinwogenburg/Desktop/big-challenge/1-in-a-billion-v2/src/screens/social/ChatListScreen.tsx`
    - `/Users/michaelperinwogenburg/Desktop/big-challenge/1-in-a-billion-v2/src/screens/social/ChatScreen.tsx`
- `PASS`: Chat entry is renewal-gated.
  - `useChatAccessGate` blocks when entitlement is `inactive` and shows renewal flow in `/Users/michaelperinwogenburg/Desktop/big-challenge/1-in-a-billion-v2/src/hooks/useChatAccessGate.ts`.
  - Renewal purchase path in `/Users/michaelperinwogenburg/Desktop/big-challenge/1-in-a-billion-v2/src/services/chatRenewal.ts`.

## 4) Build + Wiring Integrity

- `PASS`: TypeScript compile check passed.
  - `npm run typecheck`.
- `PASS`: Route wiring audit clean.
  - `npm run audit:screens` reports 0 unresolved navigation calls, 0 unreferenced screens.
- `PASS`: Expo bundle/export check passed.
  - `npx expo export --platform ios --platform android --output-dir /tmp/oiab-v2-export --clear`.

## 5) Codebase Hygiene

- `PASS`: Removed orphaned, unused modules from V2:
  - `src/store/subscriptionStore.ts`
  - `src/config/subscriptions.ts`
  - `src/components/UpsellModal.tsx`
  - `src/services/vedicMatchmaking.ts`
- `PASS`: Prompt layer registry no longer contains legacy `western-*` alias IDs.

## Blockers

- `NONE` found in static code QA for these 3 flows.

## Pending Manual Device QA (before release)

- `PENDING`: RevenueCat sheet behavior on iOS + successful entitlement roundtrip.
- `PENDING`: OAuth redirects (Google/Apple) in a real build.
- `PENDING`: End-to-end audio UX latency on real network/device.
