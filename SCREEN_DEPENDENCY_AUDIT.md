# Screen Dependency Audit (V2)

Generated: 2026-02-13T17:41:04.257Z

## Summary
- V2 screens audited: 46
- Registered route entries: 50
- Unique route names: 46
- Screens with source path match: 44
- Unresolved outgoing literal route refs: 0

Scope per screen: incoming callers, outgoing navigation, media refs, services/stores/hooks/contexts imports, source-path parity.

## `auth/SignInScreen.tsx`
- Route names: `SignIn`
- Source path parity: YES
- Incoming interactions: 1
  - `src/screens/onboarding/IntroScreen.tsx:222` via `navigate(SignIn)`
- Outgoing route targets: `Intro`
- Services: `@/services/ambientMusic`, `@/services/payments`, `@/services/supabase`
- Stores: `@/store/authStore`, `@/store/musicStore`, `@/store/onboardingStore`
- Hooks: _none_
- Contexts: _none_
- Media refs: `../../../assets/images/signin-poster.jpg`, `../../../assets/videos/signin-background.mp4`

## `home/ComparePeopleScreen.tsx`
- Route names: `ComparePeople`
- Source path parity: YES
- Incoming interactions: 5
  - `src/screens/home/GeneratingReadingScreen.tsx:204` via `navigate(ComparePeople)`
  - `src/screens/home/MyLibraryScreen.tsx:266` via `navigate(ComparePeople)`
  - `src/screens/home/NextStepScreen.tsx:45` via `navigate(ComparePeople)`
  - `src/screens/home/PartnerInfoScreen.tsx:208` via `navigate(ComparePeople)`
  - `src/screens/home/PartnerInfoScreen.tsx:301` via `navigate(ComparePeople)`
- Outgoing route targets: `EditBirthData`, `PartnerInfo`, `PersonPhotoUpload`, `SystemSelection`, `SystemsOverview`
- Services: `@/services/peopleService`
- Stores: `@/store/authStore`, `@/store/profileStore`
- Hooks: _none_
- Contexts: _none_
- Media refs: _none_

## `home/EditBirthDataScreen.tsx`
- Route names: `EditBirthData`
- Source path parity: YES
- Incoming interactions: 6
  - `src/screens/home/ComparePeopleScreen.tsx:62` via `navigate(EditBirthData)`
  - `src/screens/home/ComparePeopleScreen.tsx:77` via `navigate(EditBirthData)`
  - `src/screens/home/PartnerReadingsScreen.tsx:124` via `navigate(EditBirthData)`
  - `src/screens/home/PartnerReadingsScreen.tsx:131` via `navigate(EditBirthData)`
  - `src/screens/home/PersonProfileScreen.tsx:117` via `navigate(EditBirthData)`
  - `src/screens/home/YourChartScreen.tsx:112` via `navigate(EditBirthData)`
- Outgoing route targets: _none_
- Services: `@/services/geonames`, `@/services/peopleCloud`, `@/services/placementsCalculator`
- Stores: `@/store/authStore`, `@/store/onboardingStore`, `@/store/profileStore`
- Hooks: _none_
- Contexts: _none_
- Media refs: _none_

## `home/GeneratingReadingScreen.tsx`
- Route names: `GeneratingReading`
- Source path parity: NO
- Incoming interactions: 1
  - `src/screens/home/TreeOfLifeVideoScreen.tsx:38` via `replace(GeneratingReading)`
- Outgoing route targets: `ComparePeople`, `Home`, `JobDetail`, `MyLibrary`
- Services: `@/services/jobBuffer`, `@/services/jobStatus`
- Stores: `@/store/profileStore`
- Hooks: _none_
- Contexts: _none_
- Media refs: `../../../assets/videos/plastilin_pingpong.mp4`

## `home/HomeScreen.tsx`
- Route names: `Home`
- Source path parity: YES
- Incoming interactions: 6
  - `src/screens/home/GeneratingReadingScreen.tsx:208` via `navigate(Home)`
  - `src/screens/home/JobDetailScreen.tsx:268` via `navigate(Home)`
  - `src/screens/home/NextStepScreen.tsx:53` via `navigate(Home)`
  - `src/screens/home/PartnerCoreIdentitiesScreen.tsx:630` via `reset(Home)`
  - `src/screens/home/TreeOfLifeVideoScreen.tsx:34` via `replace(Home)`
  - `src/screens/settings/AccountDeletionScreen.tsx:49` via `reset(Home)`
- Outgoing route targets: `Gallery`, `NextStep`, `Settings`
- Services: `@/services/api`, `@/services/hookAudioCloud`, `@/services/placementsCalculator`, `@/services/supabase`
- Stores: `@/store/authStore`, `@/store/onboardingStore`, `@/store/profileStore`, `@/store/subscriptionStore`
- Hooks: _none_
- Contexts: `@/contexts/AudioContext`
- Media refs: _none_

## `home/JobDetailScreen.tsx`
- Route names: `JobDetail`
- Source path parity: YES
- Incoming interactions: 1
  - `src/screens/home/GeneratingReadingScreen.tsx:199` via `navigate(JobDetail)`
- Outgoing route targets: `Home`, `MyLibrary`, `ReadingContent`
- Services: `@/services/artifactSignedUrlCache`, `@/services/jobArtifacts`, `@/services/supabase`
- Stores: _none_
- Hooks: _none_
- Contexts: _none_
- Media refs: _none_

## `home/MyLibraryScreen.tsx`
- Route names: `MyLibrary`
- Source path parity: YES
- Incoming interactions: 4
  - `src/screens/home/GeneratingReadingScreen.tsx:192` via `navigate(MyLibrary)`
  - `src/screens/home/JobDetailScreen.tsx:264` via `navigate(MyLibrary)`
  - `src/screens/home/NextStepScreen.tsx:41` via `navigate(MyLibrary)`
  - `src/screens/settings/SettingsScreen.tsx:216` via `navigate(MyLibrary)`
- Outgoing route targets: `ComparePeople`, `PeopleList`, `PersonPhotoUpload`, `SystemsOverview`, `YourChart`
- Services: `@/services/jobStatus`
- Stores: `@/store/profileStore`
- Hooks: _none_
- Contexts: _none_
- Media refs: _none_

## `home/NextStepScreen.tsx`
- Route names: `NextStep`
- Source path parity: YES
- Incoming interactions: 1
  - `src/screens/home/HomeScreen.tsx:554` via `navigate(NextStep)`
- Outgoing route targets: `ComparePeople`, `Home`, `MyLibrary`, `SystemsOverview`
- Services: _none_
- Stores: _none_
- Hooks: _none_
- Contexts: _none_
- Media refs: `../../../assets/videos/hello_i_love_you.mp4`

## `home/PartnerCoreIdentitiesScreen.tsx`
- Route names: `PartnerCoreIdentities`
- Source path parity: YES
- Incoming interactions: 2
  - `src/screens/home/PartnerInfoScreen.tsx:215` via `navigate(PartnerCoreIdentities)`
  - `src/screens/home/PartnerInfoScreen.tsx:306` via `navigate(PartnerCoreIdentities)`
- Outgoing route targets: `Home`, `PartnerReadings`
- Services: `@/services/api`, `@/services/hookAudioCloud`
- Stores: `@/store/authStore`, `@/store/onboardingStore`, `@/store/profileStore`
- Hooks: _none_
- Contexts: _none_
- Media refs: _none_

## `home/PartnerInfoScreen.tsx`
- Route names: `PartnerInfo`
- Source path parity: YES
- Incoming interactions: 7
  - `src/screens/home/ComparePeopleScreen.tsx:178` via `navigate(PartnerInfo)`
  - `src/screens/home/PartnerReadingsScreen.tsx:122` via `navigate(PartnerInfo)`
  - `src/screens/home/PartnerReadingsScreen.tsx:126` via `navigate(PartnerInfo)`
  - `src/screens/home/PeopleListScreen.tsx:118` via `navigate(PartnerInfo)`
  - `src/screens/home/PeopleListScreen.tsx:85` via `navigate(PartnerInfo)`
  - `src/screens/home/SynastryOptionsScreen.tsx:83` via `navigate(PartnerInfo)`
  - `src/screens/onboarding/AddThirdPersonPromptScreen.tsx:131` via `replace(PartnerInfo)`
- Outgoing route targets: `ComparePeople`, `HookSequence`, `PartnerCoreIdentities`
- Services: `@/services/geonames`, `@/services/peopleService`, `@/services/placementsCalculator`
- Stores: `@/store/authStore`, `@/store/profileStore`
- Hooks: _none_
- Contexts: _none_
- Media refs: `../../../assets/images/5_systems_transp.png`

## `home/PartnerReadingsScreen.tsx`
- Route names: `PartnerReadings`
- Source path parity: YES
- Incoming interactions: 5
  - `src/screens/home/PartnerCoreIdentitiesScreen.tsx:227` via `replace(PartnerReadings)`
  - `src/screens/home/PartnerCoreIdentitiesScreen.tsx:602` via `replace(PartnerReadings)`
  - `src/screens/home/PartnerCoreIdentitiesScreen.tsx:651` via `replace(PartnerReadings)`
  - `src/screens/onboarding/AddThirdPersonPromptScreen.tsx:119` via `replace(PartnerReadings)`
  - `src/screens/onboarding/HookSequenceScreen.tsx:298` via `navigate(PartnerReadings)`
- Outgoing route targets: `BirthInfo`, `EditBirthData`, `PartnerInfo`, `SynastryPreview`
- Services: `@/services/api`, `@/services/hookAudioCloud`, `@/services/supabase`
- Stores: `@/store/authStore`, `@/store/onboardingStore`, `@/store/profileStore`
- Hooks: _none_
- Contexts: `@/contexts/AudioContext`
- Media refs: `@/../assets/videos/excentric_couple.mp4`

## `home/PeopleListScreen.tsx`
- Route names: `PeopleList`
- Source path parity: YES
- Incoming interactions: 4
  - `src/screens/home/MyLibraryScreen.tsx:260` via `navigate(PeopleList)`
  - `src/screens/home/PersonProfileScreen.tsx:229` via `navigate(PeopleList)`
  - `src/screens/home/PersonReadingsScreen.tsx:227` via `navigate(PeopleList)`
  - `src/screens/home/YourChartScreen.tsx:118` via `navigate(PeopleList)`
- Outgoing route targets: `PartnerInfo`, `PersonProfile`
- Services: `@/services/peopleService`
- Stores: `@/store/authStore`, `@/store/profileStore`
- Hooks: _none_
- Contexts: _none_
- Media refs: _none_

## `home/PersonPhotoUploadScreen.tsx`
- Route names: `PersonPhotoUpload`
- Source path parity: YES
- Incoming interactions: 4
  - `src/screens/home/ComparePeopleScreen.tsx:157` via `navigate(PersonPhotoUpload)`
  - `src/screens/home/MyLibraryScreen.tsx:176` via `navigate(PersonPhotoUpload)`
  - `src/screens/home/MyLibraryScreen.tsx:94` via `navigate(PersonPhotoUpload)`
  - `src/screens/home/PersonProfileScreen.tsx:151` via `navigate(PersonPhotoUpload)`
- Outgoing route targets: _none_
- Services: `@/services/peopleService`, `@/services/personPhotoService`
- Stores: `@/store/authStore`, `@/store/profileStore`
- Hooks: _none_
- Contexts: _none_
- Media refs: _none_

## `home/PersonProfileScreen.tsx`
- Route names: `PersonProfile`
- Source path parity: YES
- Incoming interactions: 2
  - `src/screens/home/PeopleListScreen.tsx:21` via `navigate(PersonProfile)`
  - `src/screens/home/PersonReadingsScreen.tsx:224` via `navigate(PersonProfile)`
- Outgoing route targets: `EditBirthData`, `PeopleList`, `PersonPhotoUpload`, `PersonReadings`, `SynastryOptions`, `SynastryPreview`
- Services: `@/services/peopleService`
- Stores: `@/store/authStore`, `@/store/profileStore`
- Hooks: _none_
- Contexts: _none_
- Media refs: _none_

## `home/PersonReadingsScreen.tsx`
- Route names: `PersonReadings`
- Source path parity: YES
- Incoming interactions: 1
  - `src/screens/home/PersonProfileScreen.tsx:159` via `navigate(PersonReadings)`
- Outgoing route targets: `PeopleList`, `PersonProfile`, `SystemsOverview`
- Services: `@/services/jobStatus`
- Stores: `@/store/profileStore`
- Hooks: _none_
- Contexts: _none_
- Media refs: _none_

## `home/PersonalContextScreen.tsx`
- Route names: `PersonalContext`
- Source path parity: YES
- Incoming interactions: 3
  - `src/screens/home/SynastryOptionsScreen.tsx:32` via `navigate(PersonalContext)`
  - `src/screens/home/SynastryOptionsScreen.tsx:47` via `navigate(PersonalContext)`
  - `src/screens/home/SystemSelectionScreen.tsx:142` via `navigate(PersonalContext)`
- Outgoing route targets: `SystemSelection`, `VoiceSelection`
- Services: _none_
- Stores: _none_
- Hooks: _none_
- Contexts: _none_
- Media refs: _none_

## `home/ReadingContentScreen.tsx`
- Route names: `ReadingContent`
- Source path parity: NO
- Incoming interactions: 2
  - `src/screens/home/JobDetailScreen.tsx:200` via `replace(ReadingContent)`
  - `src/screens/home/JobDetailScreen.tsx:256` via `navigate(ReadingContent)`
- Outgoing route targets: _none_
- Services: `@/services/artifactSignedUrlCache`, `@/services/jobArtifacts`, `@/services/supabase`
- Stores: _none_
- Hooks: _none_
- Contexts: _none_
- Media refs: _none_

## `home/RelationshipContextScreen.tsx`
- Route names: `RelationshipContext`
- Source path parity: YES
- Incoming interactions: 2
  - `src/screens/home/SynastryOptionsScreen.tsx:66` via `navigate(RelationshipContext)`
  - `src/screens/home/SystemSelectionScreen.tsx:140` via `navigate(RelationshipContext)`
- Outgoing route targets: `SystemSelection`, `VoiceSelection`
- Services: _none_
- Stores: _none_
- Hooks: _none_
- Contexts: _none_
- Media refs: _none_

## `home/SynastryOptionsScreen.tsx`
- Route names: `SynastryOptions`
- Source path parity: YES
- Incoming interactions: 2
  - `src/screens/home/PersonProfileScreen.tsx:173` via `navigate(SynastryOptions)`
  - `src/screens/home/SynastryPreviewScreen.tsx:474` via `navigate(SynastryOptions)`
- Outgoing route targets: `PartnerInfo`, `PersonalContext`, `RelationshipContext`
- Services: _none_
- Stores: _none_
- Hooks: _none_
- Contexts: _none_
- Media refs: _none_

## `home/SynastryPreviewScreen.tsx`
- Route names: `SynastryPreview`
- Source path parity: YES
- Incoming interactions: 2
  - `src/screens/home/PartnerReadingsScreen.tsx:141` via `navigate(SynastryPreview)`
  - `src/screens/home/PersonProfileScreen.tsx:205` via `navigate(SynastryPreview)`
- Outgoing route targets: `SynastryOptions`
- Services: _none_
- Stores: `@/store/authStore`, `@/store/onboardingStore`, `@/store/profileStore`
- Hooks: _none_
- Contexts: _none_
- Media refs: `@/../assets/videos/want_the_full_picture.mp4`

## `home/SystemSelectionScreen.tsx`
- Route names: `SystemSelection`
- Source path parity: YES
- Incoming interactions: 4
  - `src/screens/home/ComparePeopleScreen.tsx:81` via `navigate(SystemSelection)`
  - `src/screens/home/PersonalContextScreen.tsx:32` via `navigate(SystemSelection)`
  - `src/screens/home/RelationshipContextScreen.tsx:32` via `navigate(SystemSelection)`
  - `src/screens/learn/SystemExplainerScreen.tsx:121` via `navigate(SystemSelection)`
- Outgoing route targets: `PersonalContext`, `RelationshipContext`
- Services: _none_
- Stores: `@/store/profileStore`
- Hooks: _none_
- Contexts: _none_
- Media refs: _none_

## `home/SystemsOverviewScreen.tsx`
- Route names: `SystemsOverview`
- Source path parity: YES
- Incoming interactions: 4
  - `src/screens/home/ComparePeopleScreen.tsx:67` via `navigate(SystemsOverview)`
  - `src/screens/home/MyLibraryScreen.tsx:272` via `navigate(SystemsOverview)`
  - `src/screens/home/NextStepScreen.tsx:49` via `navigate(SystemsOverview)`
  - `src/screens/home/PersonReadingsScreen.tsx:156` via `navigate(SystemsOverview)`
- Outgoing route targets: `SystemExplainer`
- Services: _none_
- Stores: _none_
- Hooks: _none_
- Contexts: _none_
- Media refs: _none_

## `home/TreeOfLifeVideoScreen.tsx`
- Route names: `TreeOfLifeVideo`
- Source path parity: YES
- Incoming interactions: 1
  - `src/screens/home/VoiceSelectionScreen.tsx:189` via `replace(TreeOfLifeVideo)`
- Outgoing route targets: `GeneratingReading`, `Home`
- Services: _none_
- Stores: _none_
- Hooks: _none_
- Contexts: _none_
- Media refs: `../../../assets/videos/tree_of_life.mp4`

## `home/VoiceSelectionScreen.tsx`
- Route names: `VoiceSelection`
- Source path parity: YES
- Incoming interactions: 2
  - `src/screens/home/PersonalContextScreen.tsx:22` via `navigate(VoiceSelection)`
  - `src/screens/home/RelationshipContextScreen.tsx:22` via `navigate(VoiceSelection)`
- Outgoing route targets: `TreeOfLifeVideo`
- Services: _none_
- Stores: `@/store/authStore`, `@/store/onboardingStore`, `@/store/profileStore`
- Hooks: _none_
- Contexts: _none_
- Media refs: _none_

## `home/YourChartScreen.tsx`
- Route names: `YourChart`
- Source path parity: YES
- Incoming interactions: 2
  - `src/screens/home/MyLibraryScreen.tsx:169` via `navigate(YourChart)`
  - `src/screens/settings/SettingsScreen.tsx:209` via `navigate(YourChart)`
- Outgoing route targets: `EditBirthData`, `PeopleList`
- Services: _none_
- Stores: `@/store/onboardingStore`, `@/store/profileStore`
- Hooks: _none_
- Contexts: _none_
- Media refs: _none_

## `learn/SystemExplainerScreen.tsx`
- Route names: `SystemExplainer`
- Source path parity: YES
- Incoming interactions: 2
  - `src/screens/home/SystemsOverviewScreen.tsx:41` via `navigate(SystemExplainer)`
  - `src/screens/home/SystemsOverviewScreen.tsx:56` via `navigate(SystemExplainer)`
- Outgoing route targets: `SystemSelection`
- Services: _none_
- Stores: _none_
- Hooks: _none_
- Contexts: _none_
- Media refs: _none_

## `onboarding/AccountScreen.tsx`
- Route names: `Account`
- Source path parity: YES
- Incoming interactions: 3
  - `src/screens/onboarding/PostHookOfferScreen.tsx:127` via `navigate(Account)`
  - `src/screens/onboarding/PostHookOfferScreen.tsx:136` via `navigate(Account)`
  - `src/screens/onboarding/PostHookOfferScreen.tsx:145` via `navigate(Account)`
- Outgoing route targets: _none_
- Services: `@/services/compatibilityCloud`, `@/services/matchNotifications`, `@/services/payments`, `@/services/peopleCloud`, `@/services/supabase`, `@/services/userReadings`
- Stores: `@/store/authStore`, `@/store/onboardingStore`, `@/store/profileStore`
- Hooks: _none_
- Contexts: _none_
- Media refs: `../../../assets/images/signin-poster.jpg`, `../../../assets/videos/signin-background.mp4`

## `onboarding/AddThirdPersonPromptScreen.tsx`
- Route names: `AddThirdPersonPrompt`
- Source path parity: YES
- Incoming interactions: 1
  - `src/screens/onboarding/HookSequenceScreen.tsx:309` via `navigate(AddThirdPersonPrompt)`
- Outgoing route targets: `HookSequence`, `PartnerInfo`, `PartnerReadings`, `PostHookOffer`
- Services: _none_
- Stores: `@/store/profileStore`
- Hooks: _none_
- Contexts: _none_
- Media refs: `@/../assets/images/happy.png`

## `onboarding/BirthInfoScreen.tsx`
- Route names: `BirthInfo`
- Source path parity: YES
- Incoming interactions: 2
  - `src/screens/home/PartnerReadingsScreen.tsx:129` via `navigate(BirthInfo)`
  - `src/screens/onboarding/RelationshipScreen.tsx:98` via `navigate(BirthInfo)`
- Outgoing route targets: `Languages`
- Services: `@/services/ambientMusic`, `@/services/geonames`
- Stores: `@/store/musicStore`, `@/store/onboardingStore`
- Hooks: _none_
- Contexts: _none_
- Media refs: `../../../assets/images/cities/hongkong.png`, `../../../assets/images/cities/newyork.png`, `../../../assets/images/cities/vienna.png`, `../../../assets/images/cities/villach.png`

## `onboarding/CoreIdentitiesIntroScreen.tsx`
- Route names: `CoreIdentitiesIntro`
- Source path parity: YES
- Incoming interactions: 1
  - `src/screens/onboarding/LanguagesScreen.tsx:111` via `navigate(CoreIdentitiesIntro)`
- Outgoing route targets: `CoreIdentities`
- Services: _none_
- Stores: _none_
- Hooks: `@/hooks/useHookReadings`
- Contexts: _none_
- Media refs: _none_

## `onboarding/CoreIdentitiesScreen.tsx`
- Route names: `CoreIdentities`
- Source path parity: YES
- Incoming interactions: 1
  - `src/screens/onboarding/CoreIdentitiesIntroScreen.tsx:58` via `replace(CoreIdentities)`
- Outgoing route targets: `HookSequence`
- Services: `@/services/ambientMusic`, `@/services/api`
- Stores: `@/store/authStore`, `@/store/onboardingStore`
- Hooks: `@/hooks/useHookReadings`
- Contexts: `@/contexts/AudioContext`
- Media refs: _none_

## `onboarding/HookSequenceScreen.tsx`
- Route names: `HookSequence`
- Source path parity: YES
- Incoming interactions: 4
  - `src/screens/home/PartnerInfoScreen.tsx:358` via `navigate(HookSequence)`
  - `src/screens/home/PartnerInfoScreen.tsx:85` via `navigate(HookSequence)`
  - `src/screens/onboarding/AddThirdPersonPromptScreen.tsx:76` via `navigate(HookSequence)`
  - `src/screens/onboarding/CoreIdentitiesScreen.tsx:304` via `reset(HookSequence)`
- Outgoing route targets: `AddThirdPersonPrompt`, `PartnerReadings`
- Services: `@/services/api`
- Stores: `@/store/authStore`, `@/store/onboardingStore`, `@/store/profileStore`
- Hooks: _none_
- Contexts: `@/contexts/AudioContext`
- Media refs: _none_

## `onboarding/IntroScreen.tsx`
- Route names: `Intro`
- Source path parity: YES
- Incoming interactions: 3
  - `src/screens/auth/SignInScreen.tsx:140` via `navigate(Intro)`
  - `src/screens/auth/SignInScreen.tsx:339` via `navigate(Intro)`
  - `src/screens/onboarding/RelationshipScreen.tsx:53` via `reset(Intro)`
- Outgoing route targets: `Relationship`, `SignIn`
- Services: `@/services/ambientMusic`, `@/services/payments`, `@/services/supabase`
- Stores: `@/store/authStore`, `@/store/musicStore`, `@/store/onboardingStore`, `@/store/profileStore`
- Hooks: _none_
- Contexts: _none_
- Media refs: `../../../assets/images/woman-happy.png`

## `onboarding/LanguagesScreen.tsx`
- Route names: `Languages`
- Source path parity: YES
- Incoming interactions: 1
  - `src/screens/onboarding/BirthInfoScreen.tsx:184` via `navigate(Languages)`
- Outgoing route targets: `CoreIdentitiesIntro`
- Services: `@/services/ambientMusic`
- Stores: `@/store/musicStore`, `@/store/onboardingStore`
- Hooks: _none_
- Contexts: _none_
- Media refs: `../../../assets/images/mouth-veo-transparent_1.gif`

## `onboarding/PostHookOfferScreen.tsx`
- Route names: `PostHookOffer`
- Source path parity: YES
- Incoming interactions: 1
  - `src/screens/onboarding/AddThirdPersonPromptScreen.tsx:139` via `navigate(PostHookOffer)`
- Outgoing route targets: `Account`
- Services: `@/services/payments`
- Stores: `@/store/authStore`
- Hooks: _none_
- Contexts: _none_
- Media refs: _none_

## `onboarding/RelationshipScreen.tsx`
- Route names: `Relationship`
- Source path parity: YES
- Incoming interactions: 1
  - `src/screens/onboarding/IntroScreen.tsx:332` via `navigate(Relationship)`
- Outgoing route targets: `BirthInfo`, `Intro`
- Services: `@/services/ambientMusic`
- Stores: `@/store/authStore`, `@/store/musicStore`, `@/store/onboardingStore`
- Hooks: _none_
- Contexts: _none_
- Media refs: `../../../assets/videos/couple-laughing-small.gif`

## `settings/AboutScreen.tsx`
- Route names: `About`
- Source path parity: YES
- Incoming interactions: 1
  - `src/screens/settings/SettingsScreen.tsx:274` via `navigate(About)`
- Outgoing route targets: _none_
- Services: _none_
- Stores: _none_
- Hooks: _none_
- Contexts: _none_
- Media refs: _none_

## `settings/AccountDeletionScreen.tsx`
- Route names: `AccountDeletion`
- Source path parity: YES
- Incoming interactions: 1
  - `src/screens/settings/SettingsScreen.tsx:298` via `navigate(AccountDeletion)`
- Outgoing route targets: `Home`
- Services: `@/services/accountDeletion`
- Stores: `@/store/onboardingStore`, `@/store/profileStore`
- Hooks: _none_
- Contexts: _none_
- Media refs: _none_

## `settings/ContactSupportScreen.tsx`
- Route names: `ContactSupport`
- Source path parity: YES
- Incoming interactions: 1
  - `src/screens/settings/SettingsScreen.tsx:268` via `navigate(ContactSupport)`
- Outgoing route targets: _none_
- Services: _none_
- Stores: _none_
- Hooks: _none_
- Contexts: _none_
- Media refs: _none_

## `settings/DataPrivacyScreen.tsx`
- Route names: `DataPrivacy`
- Source path parity: YES
- Incoming interactions: 1
  - `src/screens/settings/SettingsScreen.tsx:245` via `navigate(DataPrivacy)`
- Outgoing route targets: _none_
- Services: _none_
- Stores: _none_
- Hooks: _none_
- Contexts: _none_
- Media refs: _none_

## `settings/PrivacyPolicyScreen.tsx`
- Route names: `PrivacyPolicy`
- Source path parity: YES
- Incoming interactions: 1
  - `src/screens/settings/SettingsScreen.tsx:251` via `navigate(PrivacyPolicy)`
- Outgoing route targets: _none_
- Services: _none_
- Stores: _none_
- Hooks: _none_
- Contexts: _none_
- Media refs: _none_

## `settings/SettingsScreen.tsx`
- Route names: `Settings`
- Source path parity: YES
- Incoming interactions: 1
  - `src/screens/home/HomeScreen.tsx:494` via `navigate(Settings)`
- Outgoing route targets: `About`, `AccountDeletion`, `ContactSupport`, `DataPrivacy`, `MyLibrary`, `PrivacyPolicy`, `TermsOfService`, `YourChart`
- Services: `@/services/matchNotifications`, `@/services/peopleCloud`, `@/services/supabase`
- Stores: `@/store/authStore`, `@/store/onboardingStore`, `@/store/profileStore`, `@/store/subscriptionStore`
- Hooks: _none_
- Contexts: _none_
- Media refs: _none_

## `settings/TermsOfServiceScreen.tsx`
- Route names: `TermsOfService`
- Source path parity: YES
- Incoming interactions: 1
  - `src/screens/settings/SettingsScreen.tsx:257` via `navigate(TermsOfService)`
- Outgoing route targets: _none_
- Services: _none_
- Stores: _none_
- Hooks: _none_
- Contexts: _none_
- Media refs: _none_

## `social/ChatListScreen.tsx`
- Route names: `ChatList`
- Source path parity: YES
- Incoming interactions: 3
  - `src/screens/social/GalleryScreen.tsx:235` via `navigate(ChatList)`
  - `src/screens/social/GalleryScreen.tsx:315` via `navigate(ChatList)`
  - `src/screens/social/GalleryScreen.tsx:337` via `navigate(ChatList)`
- Outgoing route targets: `Chat`, `Gallery`
- Services: _none_
- Stores: `@/store/authStore`
- Hooks: `@/hooks/useChatAccessGate`
- Contexts: _none_
- Media refs: _none_

## `social/ChatScreen.tsx`
- Route names: `Chat`
- Source path parity: YES
- Incoming interactions: 2
  - `src/screens/social/ChatListScreen.tsx:116` via `navigate(Chat)`
  - `src/screens/social/GalleryScreen.tsx:191` via `navigate(Chat)`
- Outgoing route targets: _none_
- Services: _none_
- Stores: `@/store/authStore`
- Hooks: `@/hooks/useChatAccessGate`
- Contexts: _none_
- Media refs: _none_

## `social/GalleryScreen.tsx`
- Route names: `Gallery`
- Source path parity: YES
- Incoming interactions: 3
  - `src/screens/home/HomeScreen.tsx:534` via `navigate(Gallery)`
  - `src/screens/home/HomeScreen.tsx:567` via `navigate(Gallery)`
  - `src/screens/social/ChatListScreen.tsx:201` via `navigate(Gallery)`
- Outgoing route targets: `Chat`, `ChatList`
- Services: _none_
- Stores: `@/store/authStore`
- Hooks: `@/hooks/useChatAccessGate`
- Contexts: _none_
- Media refs: _none_

