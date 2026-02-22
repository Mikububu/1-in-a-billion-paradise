# Screen Agent Audit

Generated: 2026-02-11T11:57:56.936Z

## Active Routes (parsed from RootNavigator without comments)
- Onboarding: Intro(IntroScreen), SignIn(SignInScreenWrapper), CoreIdentitiesIntro(CoreIdentitiesIntroScreen), CoreIdentities(CoreIdentitiesScreen), HookSequence(HookSequenceScreen)
- Main: Home(HomeScreen), NextStep(NextStepScreen), Gallery(GalleryScreen), Settings(SettingsScreen), PrivacyPolicy(PrivacyPolicyScreen), TermsOfService(TermsOfServiceScreen), DataPrivacy(DataPrivacyScreen), About(AboutScreen), ContactSupport(ContactSupportScreen), AccountDeletion(AccountDeletionScreen)

## Summary
- Total V2 screens: 19
- Active-routed screens: 15
- Not currently routed: 4
- Screens with matching original path: 19

## Agent ONBOARDING

### onboarding/BirthInfoScreen.tsx
- Active route: NO
- Implemented in original same path: YES
- Diff vs original: 1 file changed, 427 insertions(+), 427 deletions(-)
- Incoming from: none
- Navigates to: Languages
- Stores: onboardingStore, musicStore
- Services: geonames, ambientMusic
- Hooks: none
- Expo libs: none
- Media: ../../../assets/images/cities/hongkong.png, ../../../assets/images/cities/villach.png, ../../../assets/images/cities/vienna.png, ../../../assets/images/cities/newyork.png

### onboarding/CoreIdentitiesIntroScreen.tsx
- Active route: CoreIdentitiesIntro
- Implemented in original same path: YES
- Diff vs original: 1 file changed, 182 insertions(+), 182 deletions(-)
- Incoming from: onboarding/FreeReadingSelectionScreen.tsx
- Navigates to: CoreIdentities
- Stores: none
- Services: none
- Hooks: useHookReadings
- Expo libs: none
- Media: none

### onboarding/CoreIdentitiesScreen.tsx
- Active route: CoreIdentities
- Implemented in original same path: YES
- Diff vs original: 1 file changed, 371 insertions(+), 884 deletions(-)
- Incoming from: onboarding/CoreIdentitiesIntroScreen.tsx
- Navigates to: HookSequence
- Stores: onboardingStore, authStore
- Services: api, hookAudioCloud, ambientMusic
- Hooks: useHookReadings
- Expo libs: expo-linear-gradient, expo-haptics, expo-av
- Media: none

### onboarding/FreeReadingSelectionScreen.tsx
- Active route: NO
- Implemented in original same path: YES
- Diff vs original: 1 file changed, 184 insertions(+), 181 deletions(-)
- Incoming from: none
- Navigates to: CoreIdentitiesIntro
- Stores: authStore, onboardingStore
- Services: api
- Hooks: none
- Expo libs: none
- Media: none

### onboarding/HookSequenceScreen.tsx
- Active route: HookSequence
- Implemented in original same path: YES
- Diff vs original: 1 file changed, 421 insertions(+), 1323 deletions(-)
- Incoming from: onboarding/CoreIdentitiesScreen.tsx
- Navigates to: #
- Stores: onboardingStore, profileStore, authStore
- Services: api, supabase, userReadings, hookAudioCloud
- Hooks: none
- Expo libs: expo-web-browser, expo-auth-session, expo-auth-session/providers/google, expo-apple-authentication, expo-av
- Media: none

### onboarding/IntroScreen.tsx
- Active route: Intro
- Implemented in original same path: YES
- Diff vs original: 1 file changed, 1 insertion(+), 17 deletions(-)
- Incoming from: auth/SignInScreen.tsx, onboarding/RelationshipScreen.tsx
- Navigates to: SignIn, Relationship
- Stores: onboardingStore, authStore, profileStore, musicStore
- Services: ambientMusic, supabase
- Hooks: none
- Expo libs: none
- Media: ../../../assets/images/woman-happy.png

### onboarding/LanguagesScreen.tsx
- Active route: NO
- Implemented in original same path: YES
- Diff vs original: 1 file changed, 156 insertions(+), 195 deletions(-)
- Incoming from: none
- Navigates to: FreeReadingSelection
- Stores: onboardingStore, musicStore
- Services: ambientMusic
- Hooks: none
- Expo libs: none
- Media: ../../../assets/images/mouth-veo-transparent_1.gif

### onboarding/RelationshipScreen.tsx
- Active route: NO
- Implemented in original same path: YES
- Diff vs original: 1 file changed, 159 insertions(+), 185 deletions(-)
- Incoming from: none
- Navigates to: BirthInfo, Intro
- Stores: onboardingStore, authStore, musicStore
- Services: ambientMusic
- Hooks: none
- Expo libs: expo-haptics
- Media: ../../../assets/videos/couple-laughing-small.gif

## Agent AUTH

### auth/SignInScreen.tsx
- Active route: SignIn
- Implemented in original same path: YES
- Diff vs original: 1 file changed, 513 insertions(+), 681 deletions(-)
- Incoming from: onboarding/IntroScreen.tsx
- Navigates to: Intro, #
- Stores: authStore, onboardingStore, musicStore
- Services: supabase, ambientMusic
- Hooks: none
- Expo libs: expo-apple-authentication, expo-web-browser, expo-av
- Media: ../../../assets/images/signin-poster.jpg, ../../../assets/videos/signin-background.mp4

## Agent HOME

### home/HomeScreen.tsx
- Active route: Home
- Implemented in original same path: YES
- Diff vs original: 1 file changed, 195 insertions(+), 1278 deletions(-)
- Incoming from: home/NextStepScreen.tsx, settings/AccountDeletionScreen.tsx
- Navigates to: Settings, Gallery, NextStep
- Stores: authStore, onboardingStore, profileStore, subscriptionStore
- Services: placementsCalculator, supabase, hookAudioCloud, api
- Hooks: none
- Expo libs: expo-av
- Media: none

### home/NextStepScreen.tsx
- Active route: NextStep
- Implemented in original same path: YES
- Diff vs original: 1 file changed, 121 insertions(+), 131 deletions(-)
- Incoming from: home/HomeScreen.tsx
- Navigates to: MyLibrary, ComparePeople, SystemsOverview, Home
- Stores: none
- Services: none
- Hooks: none
- Expo libs: expo-av
- Media: ../../../assets/videos/hello_i_love_you.mp4

## Agent SOCIAL

### social/GalleryScreen.tsx
- Active route: Gallery
- Implemented in original same path: YES
- Diff vs original: 1 file changed, 358 insertions(+), 313 deletions(-)
- Incoming from: home/HomeScreen.tsx
- Navigates to: none
- Stores: authStore
- Services: none
- Hooks: none
- Expo libs: none
- Media: none

## Agent SETTINGS

### settings/AboutScreen.tsx
- Active route: About
- Implemented in original same path: YES
- Diff vs original: 1 file changed, 84 insertions(+), 187 deletions(-)
- Incoming from: settings/SettingsScreen.tsx
- Navigates to: none
- Stores: none
- Services: none
- Hooks: none
- Expo libs: none
- Media: none

### settings/AccountDeletionScreen.tsx
- Active route: AccountDeletion
- Implemented in original same path: YES
- Diff vs original: 1 file changed, 142 insertions(+), 374 deletions(-)
- Incoming from: settings/SettingsScreen.tsx
- Navigates to: Home
- Stores: onboardingStore, profileStore
- Services: accountDeletion
- Hooks: none
- Expo libs: none
- Media: none

### settings/ContactSupportScreen.tsx
- Active route: ContactSupport
- Implemented in original same path: YES
- Diff vs original: 1 file changed, 122 insertions(+), 205 deletions(-)
- Incoming from: settings/SettingsScreen.tsx
- Navigates to: none
- Stores: none
- Services: none
- Hooks: none
- Expo libs: none
- Media: none

### settings/DataPrivacyScreen.tsx
- Active route: DataPrivacy
- Implemented in original same path: YES
- Diff vs original: 1 file changed, 68 insertions(+), 237 deletions(-)
- Incoming from: settings/SettingsScreen.tsx
- Navigates to: none
- Stores: none
- Services: none
- Hooks: none
- Expo libs: none
- Media: none

### settings/PrivacyPolicyScreen.tsx
- Active route: PrivacyPolicy
- Implemented in original same path: YES
- Diff vs original: 1 file changed, 103 insertions(+), 213 deletions(-)
- Incoming from: settings/SettingsScreen.tsx
- Navigates to: none
- Stores: none
- Services: none
- Hooks: none
- Expo libs: none
- Media: none

### settings/SettingsScreen.tsx
- Active route: Settings
- Implemented in original same path: YES
- Diff vs original: 1 file changed, 325 insertions(+), 407 deletions(-)
- Incoming from: home/HomeScreen.tsx
- Navigates to: YourChart, MyLibrary, DataPrivacy, PrivacyPolicy, TermsOfService, ContactSupport, About, AccountDeletion
- Stores: onboardingStore, profileStore, authStore, subscriptionStore
- Services: peopleCloud, supabase
- Hooks: none
- Expo libs: none
- Media: none

### settings/TermsOfServiceScreen.tsx
- Active route: TermsOfService
- Implemented in original same path: YES
- Diff vs original: 1 file changed, 91 insertions(+), 243 deletions(-)
- Incoming from: settings/SettingsScreen.tsx
- Navigates to: none
- Stores: none
- Services: none
- Hooks: none
- Expo libs: none
- Media: none

## Navigation Gaps
- home/NextStepScreen.tsx -> MyLibrary (target not active in navigator)
- home/NextStepScreen.tsx -> ComparePeople (target not active in navigator)
- home/NextStepScreen.tsx -> SystemsOverview (target not active in navigator)
- onboarding/BirthInfoScreen.tsx -> Languages (target not active in navigator)
- onboarding/IntroScreen.tsx -> Relationship (target not active in navigator)
- onboarding/LanguagesScreen.tsx -> FreeReadingSelection (target not active in navigator)
- onboarding/RelationshipScreen.tsx -> BirthInfo (target not active in navigator)
- settings/SettingsScreen.tsx -> YourChart (target not active in navigator)
- settings/SettingsScreen.tsx -> MyLibrary (target not active in navigator)

