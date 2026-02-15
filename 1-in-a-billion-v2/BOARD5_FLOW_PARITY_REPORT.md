# Board 5 Flow Parity Report (V2)

Generated: 2026-02-12

## Gates
- `npm run typecheck`: PASS
- `npx expo-doctor`: PASS (`17/17 checks passed`)
- Unresolved route targets in V2 navigation calls: `0`
- Missing local media from `require(...)`: `0`

## Core Journey Verdict

### 1) Onboarding + Payment Lock
Status: OK

Path in V2:
- `Intro -> Relationship -> BirthInfo -> Languages -> CoreIdentitiesIntro -> CoreIdentities -> HookSequence`
- `HookSequence -> AddThirdPersonPrompt` (`src/screens/onboarding/HookSequenceScreen.tsx:295`)
- YES path uses `replace` (prompt removed from history):
  - `AddThirdPersonPrompt -> PartnerInfo` (`src/screens/onboarding/AddThirdPersonPromptScreen.tsx:131`)
  - `AddThirdPersonPrompt -> PartnerReadings` reuse path (`src/screens/onboarding/AddThirdPersonPromptScreen.tsx:119`)
- NO path keeps prompt in history:
  - `AddThirdPersonPrompt -> PostHookOffer` (`src/screens/onboarding/AddThirdPersonPromptScreen.tsx:139`)
- Partner flow handoff:
  - `PartnerReadings -> SynastryPreview` with `onboardingNext: 'PostHookOffer'` (`src/screens/home/PartnerReadingsScreen.tsx:522`)
  - `SynastryPreview -> onboardingNext` (`src/screens/home/SynastryPreviewScreen.tsx:361`)
- Payment + account:
  - `PostHookOffer -> Account(fromPayment: true)` (`src/screens/onboarding/PostHookOfferScreen.tsx:127`)
  - `Account -> completeOnboarding()` (`src/screens/onboarding/AccountScreen.tsx:156`)

Hard lock now enforced:
- Root-level entitlement check before Main navigator (`src/navigation/RootNavigator.tsx:488`)
- Intro "My Secret Life" entitlement check (`src/screens/onboarding/IntroScreen.tsx:225`)

### 2) Soul Laboratory Hub
Status: OK

Path in V2:
- `Home -> NextStep` (`src/screens/home/HomeScreen.tsx:499`)
- `NextStep -> MyLibrary | ComparePeople | SystemsOverview | Home` (`src/screens/home/NextStepScreen.tsx:41`)

### 3) Explore Myself -> Speaker -> Tree of Life
Status: OK

Path in V2:
- `SystemsOverview -> SystemExplainer` (`src/screens/home/SystemsOverviewScreen.tsx:41`)
- `SystemExplainer -> purchaseFlow` (`src/screens/learn/SystemExplainerScreen.tsx:121`)
- `purchaseFlow -> PersonalContext | RelationshipContext` (`src/utils/purchaseFlow.ts:61`)
- `... -> VoiceSelection` (`src/screens/home/PersonalContextScreen.tsx:30`, `src/screens/home/RelationshipContextScreen.tsx:30`)
- `VoiceSelection -> TreeOfLifeVideo` (`src/screens/home/VoiceSelectionScreen.tsx:187`)
- `TreeOfLifeVideo -> GeneratingReading` (`src/screens/home/TreeOfLifeVideoScreen.tsx:38`)
- `GeneratingReading -> JobDetail | MyLibrary | Home` (`src/screens/home/GeneratingReadingScreen.tsx:233`)

### 4) People / Karmic Zoo / Portrait Upload
Status: OK

Path in V2:
- `ComparePeople` branch to individual or overlay generation (`src/screens/home/ComparePeopleScreen.tsx:67`, `src/screens/home/ComparePeopleScreen.tsx:81`)
- `PeopleList -> PersonProfile -> PersonReadings` (`src/screens/home/PeopleListScreen.tsx:26`, `src/screens/home/PersonProfileScreen.tsx:159`)
- Portrait square upload screen exists and is routed:
  - `PersonPhotoUploadScreen` with tap-in-square interaction (`src/screens/home/PersonPhotoUploadScreen.tsx:165`)

## Legacy Screens Not Migrated (Intentional)
These are in old navigator but not V2 navigator:
- `AudioPlayer`, `ChartCalculation`, `Chat`, `ChatList`, `CompleteReading`, `DeepReadingReader`, `ExtendedPrompt`, `ExtendedReading`, `FreeReadingSelection`, `FullReading`, `MatchDetail`, `MatchReveal`, `Matches`, `OverlayReader`, `PersonJobsList`, `ProfileSignIn`, `Purchase`, `ReadingChapter`, `ReadingOverview`, `ReadingSummary`, `SavedReading`, `WhyDifferent`

## Notes
- Media files can exist without proving a screen is active. In V2, activation is determined by:
  1. Screen registration in `RootNavigator`
  2. Reachable navigation calls
