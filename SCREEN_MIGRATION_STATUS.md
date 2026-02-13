# Screen Migration Status (Auto)

Generated: 2026-02-11T20:51:28.379Z

## Status Note
- This file is a historical auto-snapshot and can be stale.
- Source of truth for keep/remove decisions is:
  - `/Users/michaelperinwogenburg/Desktop/big-challenge/1-in-a-billion-v2/MIGRATION_DECISIONS.md`
- Latest decisions explicitly keep out legacy/non-required screens such as:
  - `WhyDifferent`, standalone `Purchase`, `FreeReadingSelection`, `OnboardingComplete`, legacy deep-reading output screens.

## Current V2 Routing
- Routed screens: 48
- Unique route targets referenced in code: 45
- Unresolved route targets: 0

## Screen Inventory
- Screens in original: 72
- Screens in V2: 44
- Missing in V2: 30
- Missing in V2 (non-legacy candidate list): 15
- Extra/new in V2: 2

## Missing in V2 (Non-Legacy Candidates)
- home/ChartCalculationScreen.tsx
- home/HowMatchingWorksScreen.tsx
- home/MatchDetailScreen.tsx
- home/MatchesScreen.tsx
- learn/WhyDifferentScreen.tsx
- onboarding/CurrentCityScreen.tsx
- onboarding/FreeReadingSelectionScreen.tsx
- onboarding/NameInputScreen.tsx
- onboarding/OnboardingCompleteScreen.tsx
- premium/PurchaseScreen.tsx
- social/ChatListScreen.tsx
- social/ChatScreen.tsx
- social/MatchRevealScreen.tsx
- statements/ReadyToMatchScreen.tsx
- statements/WelcomeBackScreen.tsx

## Missing in V2 (Legacy Excluded by Decision)
- home/AudioPlayerScreen.tsx
- home/CompleteReadingScreen.tsx
- home/DeepReadingReaderScreen.tsx
- home/ExtendedPromptScreen.tsx
- home/ExtendedReadingScreen.tsx
- home/FullReadingRedirectScreen.tsx
- home/FullReadingScreen.tsx
- home/OverlayReaderScreen.tsx
- home/PersonJobsListScreen.tsx
- home/PersonReadingChaptersFlowScreen.tsx
- home/ReadingChapterScreen.tsx
- home/ReadingOverviewScreen.tsx
- home/ReadingSummaryScreen.tsx
- home/SavedReadingScreen.tsx

## Extra/New V2 Screens
- home/GeneratingReadingScreen.tsx
- home/ReadingContentScreen.tsx

## Media Resolve Check
- Missing local require() assets: 0

## Notes
- This report is generated from current code only (no runtime execution).
- Legacy deep-reading output screens are listed separately and not treated as blockers.
