# Screen Migration Status (Live)

Generated: 2026-02-14 00:23 (+07 local audit run)

## Scope
- Source baseline: `/Users/michaelperinwogenburg/Desktop/big-challenge/ONEINABILLIONAPP/1-in-a-billion-frontend/src/screens`
- Destination: `/Users/michaelperinwogenburg/Desktop/big-challenge/1-in-a-billion-v2/src/screens`

## Current Live Counts
- Source screens (`.tsx`): 72
- V2 screens (`.tsx`): 46
- Registered V2 route entries (Onboarding + Main): 50
- Unique V2 route names: 46
- Missing vs source (`.tsx`): 28
- Extra/new in V2 (`.tsx`): 2

## Extra/New V2 Screens
- `home/GeneratingReadingScreen.tsx`
- `home/ReadingContentScreen.tsx`

## Missing In V2 (Compared To Source)
All entries below are currently treated as intentionally excluded by migration decisions and/or replaced by new flow equivalents:

- `home/AudioPlayerScreen.tsx`
- `home/ChartCalculationScreen.tsx`
- `home/CompleteReadingScreen.tsx`
- `home/DeepReadingReaderScreen.tsx`
- `home/ExtendedPromptScreen.tsx`
- `home/ExtendedReadingScreen.tsx`
- `home/FullReadingRedirectScreen.tsx`
- `home/FullReadingScreen.tsx`
- `home/HowMatchingWorksScreen.tsx` (replaced by overlay behavior)
- `home/MatchDetailScreen.tsx`
- `home/MatchesScreen.tsx`
- `home/OverlayReaderScreen.tsx`
- `home/PersonJobsListScreen.tsx`
- `home/PersonReadingChaptersFlowScreen.tsx`
- `home/ReadingChapterScreen.tsx`
- `home/ReadingOverviewScreen.tsx`
- `home/ReadingSummaryScreen.tsx`
- `home/SavedReadingScreen.tsx`
- `home/SystemOverviewScreen.tsx`
- `learn/WhyDifferentScreen.tsx`
- `onboarding/CurrentCityScreen.tsx`
- `onboarding/FreeReadingSelectionScreen.tsx`
- `onboarding/NameInputScreen.tsx`
- `onboarding/OnboardingCompleteScreen.tsx`
- `premium/PurchaseScreen.tsx`
- `social/MatchRevealScreen.tsx`
- `statements/ReadyToMatchScreen.tsx`
- `statements/WelcomeBackScreen.tsx`

## Live Route Reachability
- No unresolved `navigation.navigate(...)` targets in current V2 screens for registered routes.
- No unreferenced `*Screen.tsx` files in `src/screens` (all are imported/exported into active graph).
- Every registered route name has at least one live navigation call site outside `RootNavigator`.
- `ChatList` and `Chat` are present and registered.
- Partner flow is present and registered:
  - `AddThirdPersonPrompt -> PartnerInfo -> PartnerCoreIdentities -> PartnerReadings -> SynastryPreview -> PostHookOffer`.

## Status Summary
- Active screen migration for V2 route graph is effectively complete.
- Remaining work is behavior/performance hardening (audio UX, backend integration, prompt/ranking refinement), not bulk screen copy.

## Latest Hardening
- Restored rich media on `PostHookOfferScreen` in V2 (videos + systems icons) while keeping current V2 payment verification flow.
- Restored global leather texture in app shell (`TexturedBackground`) using shared tint token (`colors.background` / `VINTAGE_TINT`).
- Restored `HomeScreen` "produced by" logo block and migrated corresponding asset into V2.

## Authority
- Product behavior authority: `/Users/michaelperinwogenburg/Desktop/big-challenge/1-in-a-billion-v2/MIGRATION_DECISIONS.md`
- Vedic matching authority: `/Users/michaelperinwogenburg/Desktop/big-challenge/1-in-a-billion-v2/VEDIC_MATCHMAKING_SPEC.md`
