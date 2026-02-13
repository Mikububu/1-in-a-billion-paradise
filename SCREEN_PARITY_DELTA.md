# Screen Parity Delta (Source -> V2)

Generated: 2026-02-13T19:19:35.176Z

## Summary
- V2 screens: 46
- Source screens: 72
- Path-matched screens compared: 44
- V2-only screens (no source path match): 2
- Matched screens with dependency/navigation deltas: 42

## V2-only screens
- `home/GeneratingReadingScreen.tsx`
- `home/ReadingContentScreen.tsx`

## Deltas by screen

### `auth/SignInScreen.tsx`
- Line delta (V2 - source): -115
- Services added in V2: `@/services/payments`
- Outgoing routes removed from source: `BirthInfo`, `Home`

### `home/ComparePeopleScreen.tsx`
- Line delta (V2 - source): -174
- Outgoing routes added in V2: `EditBirthData`, `SystemsOverview`

### `home/EditBirthDataScreen.tsx`
- Line delta (V2 - source): -24
- Services added in V2: `@/services/peopleCloud`, `@/services/placementsCalculator`
- Services removed from source: `@/services/peopleService`

### `home/HomeScreen.tsx`
- Line delta (V2 - source): -834
- Contexts added in V2: `@/contexts/AudioContext`

### `home/JobDetailScreen.tsx`
- Line delta (V2 - source): 94
- Services added in V2: `@/services/artifactSignedUrlCache`, `@/services/jobArtifacts`
- Services removed from source: `@/services/artifactCacheService`, `@/services/nuclearReadingsService`
- Outgoing routes added in V2: `Home`, `MyLibrary`, `ReadingContent`
- Outgoing routes removed from source: `AudioPlayer`, `DeepReadingReader`, `JobDetail`, `OverlayReader`

### `home/MyLibraryScreen.tsx`
- Line delta (V2 - source): -3509
- Services added in V2: `@/services/jobStatus`
- Services removed from source: `@/services/audioDownload`, `@/services/coupleImageService`, `@/services/nuclearReadingsService`, `@/services/peopleService`, `@/services/placementsCalculator`, `@/services/supabase`
- Stores removed from source: `@/store/authStore`, `@/store/onboardingStore`
- Outgoing routes added in V2: `PeopleList`, `SystemsOverview`
- Outgoing routes removed from source: `FullReading`, `HookSequence`, `JobDetail`, `PartnerInfo`, `PersonReadings`, `SavedReading`, `Settings`, `SystemSelection`

### `home/NextStepScreen.tsx`
- Line delta (V2 - source): -10

### `home/PartnerCoreIdentitiesScreen.tsx`
- Line delta (V2 - source): -18
- Services removed from source: `@/services/supabase`

### `home/PartnerInfoScreen.tsx`
- Line delta (V2 - source): 50
- Outgoing routes added in V2: `HookSequence`

### `home/PartnerReadingsScreen.tsx`
- Line delta (V2 - source): 19
- Contexts added in V2: `@/contexts/AudioContext`
- Outgoing routes added in V2: `BirthInfo`, `PartnerInfo`

### `home/PeopleListScreen.tsx`
- Line delta (V2 - source): -102
- Outgoing routes removed from source: `SystemsOverview`

### `home/PersonalContextScreen.tsx`
- Line delta (V2 - source): -218
- Services removed from source: `@/services/peopleService`, `@/services/supabase`

### `home/PersonPhotoUploadScreen.tsx`
- Line delta (V2 - source): -21
- Services added in V2: `@/services/peopleService`
- Stores added in V2: `@/store/authStore`

### `home/PersonProfileScreen.tsx`
- Line delta (V2 - source): -500
- Stores removed from source: `@/store/onboardingStore`
- Outgoing routes added in V2: `PeopleList`, `PersonPhotoUpload`, `PersonReadings`
- Outgoing routes removed from source: `PartnerReadings`, `SavedReading`, `SystemOverview`, `SystemSelection`

### `home/PersonReadingsScreen.tsx`
- Line delta (V2 - source): -3319
- Services added in V2: `@/services/jobStatus`
- Services removed from source: `@/services/artifactCacheService`, `@/services/jobBuffer`, `@/services/nuclearReadingsService`, `@/services/realtimeArtifactSync`, `@/services/supabase`
- Outgoing routes added in V2: `PeopleList`, `PersonProfile`, `SystemsOverview`
- Outgoing routes removed from source: `AudioPlayer`

### `home/RelationshipContextScreen.tsx`
- Line delta (V2 - source): -210

### `home/SynastryOptionsScreen.tsx`
- Line delta (V2 - source): -74

### `home/SynastryPreviewScreen.tsx`
- Line delta (V2 - source): 114
- Stores added in V2: `@/store/profileStore`

### `home/SystemSelectionScreen.tsx`
- Line delta (V2 - source): -527
- Services removed from source: `@/services/supabase`
- Stores removed from source: `@/store/authStore`, `@/store/onboardingStore`
- Outgoing routes added in V2: `PersonalContext`, `RelationshipContext`
- Outgoing routes removed from source: `SystemExplainer`, `TreeOfLifeVideo`, `VoiceSelection`

### `home/SystemsOverviewScreen.tsx`
- Line delta (V2 - source): -76

### `home/TreeOfLifeVideoScreen.tsx`
- Line delta (V2 - source): -22

### `home/VoiceSelectionScreen.tsx`
- Line delta (V2 - source): -359
- Services removed from source: `@/services/ambientMusic`, `@/services/peopleService`, `@/services/supabase`

### `home/YourChartScreen.tsx`
- Line delta (V2 - source): -165

### `learn/SystemExplainerScreen.tsx`
- Line delta (V2 - source): -290
- Outgoing routes added in V2: `SystemSelection`

### `onboarding/AccountScreen.tsx`
- Line delta (V2 - source): -293
- Services added in V2: `@/services/compatibilityCloud`, `@/services/matchNotifications`, `@/services/payments`, `@/services/peopleCloud`, `@/services/userReadings`
- Services removed from source: `@/services/ambientMusic`
- Stores added in V2: `@/store/profileStore`
- Stores removed from source: `@/store/musicStore`
- Outgoing routes removed from source: `FreeReadingSelection`, `Intro`

### `onboarding/CoreIdentitiesIntroScreen.tsx`
- Line delta (V2 - source): -13
- Outgoing routes added in V2: `CoreIdentities`
- Outgoing routes removed from source: `HookSequence`

### `onboarding/CoreIdentitiesScreen.tsx`
- Line delta (V2 - source): -502
- Services removed from source: `@/services/hookAudioCloud`
- Stores removed from source: `@/store/profileStore`
- Hooks added in V2: `@/hooks/useHookReadings`
- Contexts added in V2: `@/contexts/AudioContext`

### `onboarding/HookSequenceScreen.tsx`
- Line delta (V2 - source): -1031
- Services removed from source: `@/services/hookAudioCloud`, `@/services/supabase`, `@/services/userReadings`
- Hooks removed from source: `@/hooks/useHookReadings`
- Contexts added in V2: `@/contexts/AudioContext`

### `onboarding/IntroScreen.tsx`
- Line delta (V2 - source): 1
- Services added in V2: `@/services/payments`
- Services removed from source: `@/services/api`

### `onboarding/LanguagesScreen.tsx`
- Line delta (V2 - source): -39
- Outgoing routes added in V2: `CoreIdentitiesIntro`
- Outgoing routes removed from source: `CoreIdentities`

### `onboarding/PostHookOfferScreen.tsx`
- Line delta (V2 - source): -41

### `onboarding/RelationshipScreen.tsx`
- Line delta (V2 - source): -26

### `settings/AboutScreen.tsx`
- Line delta (V2 - source): -103
- Outgoing routes removed from source: `DataPrivacy`, `PrivacyPolicy`, `TermsOfService`

### `settings/AccountDeletionScreen.tsx`
- Line delta (V2 - source): -232
- Outgoing routes added in V2: `Home`
- Outgoing routes removed from source: `Settings`

### `settings/ContactSupportScreen.tsx`
- Line delta (V2 - source): -83

### `settings/DataPrivacyScreen.tsx`
- Line delta (V2 - source): -169
- Outgoing routes removed from source: `AccountDeletion`

### `settings/PrivacyPolicyScreen.tsx`
- Line delta (V2 - source): -110

### `settings/SettingsScreen.tsx`
- Line delta (V2 - source): -2
- Services added in V2: `@/services/matchNotifications`

### `settings/TermsOfServiceScreen.tsx`
- Line delta (V2 - source): -152

### `social/ChatListScreen.tsx`
- Line delta (V2 - source): 33
- Hooks added in V2: `@/hooks/useChatAccessGate`

### `social/ChatScreen.tsx`
- Line delta (V2 - source): 31
- Hooks added in V2: `@/hooks/useChatAccessGate`

### `social/GalleryScreen.tsx`
- Line delta (V2 - source): 312
- Hooks added in V2: `@/hooks/useChatAccessGate`
- Outgoing routes added in V2: `Chat`, `ChatList`
