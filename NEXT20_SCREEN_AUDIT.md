# Next 20 Screen Audit

Generated: 2026-02-11T12:22:29.951Z

## Scope
- Audited screens: 20
- Compare baseline: original frontend vs V2

## onboarding/AccountScreen.tsx
- Present in original: YES
- Present in V2: NO
- Active route in original: LIKELY
- Active route in V2: NO/UNKNOWN
- Stores: musicStore, onboardingStore, authStore
- Services: supabase, ambientMusic
- Hooks: none
- Expo libs: expo-av, expo-apple-authentication, expo-web-browser
- Media: ../../../assets/images/signin-poster.jpg, ../../../assets/videos/signin-background.mp4
- Navigates to: Intro, FreeReadingSelection
- Missing route targets in V2: FreeReadingSelection

## onboarding/PostHookOfferScreen.tsx
- Present in original: YES
- Present in V2: NO
- Active route in original: LIKELY
- Active route in V2: NO/UNKNOWN
- Stores: authStore
- Services: payments
- Hooks: none
- Expo libs: expo-av
- Media: @/../assets/videos/offer_page1.mp4, @/../assets/videos/offer_page2.mp4, @/../assets/videos/offer_page3.mp4, @/../assets/images/systems/western.png, @/../assets/images/systems/vedic.png, @/../assets/images/systems/human-design.png, @/../assets/images/systems/gene-keys.png, @/../assets/images/systems/Kabbalah.png, @/../assets/videos/we_search_for_you.mp4, @/../assets/videos/lets_connet.mp4
- Navigates to: Account, HookSequence, Western Astrology, Jyotish (Vedic), Human Design, Gene Keys, Kabbalah
- Missing route targets in V2: Western Astrology, Jyotish (Vedic), Human Design, Gene Keys, Kabbalah

## home/PartnerInfoScreen.tsx
- Present in original: YES
- Present in V2: NO
- Active route in original: LIKELY
- Active route in V2: NO/UNKNOWN
- Stores: profileStore, authStore
- Services: geonames, placementsCalculator, peopleService
- Hooks: none
- Expo libs: none
- Media: ../../../assets/images/5_systems_transp.png
- Navigates to: ComparePeople, PartnerCoreIdentities
- Missing route targets in V2: PartnerCoreIdentities

## home/PartnerCoreIdentitiesScreen.tsx
- Present in original: YES
- Present in V2: NO
- Active route in original: LIKELY
- Active route in V2: NO/UNKNOWN
- Stores: profileStore, onboardingStore, authStore
- Services: api, hookAudioCloud, supabase
- Hooks: none
- Expo libs: none
- Media: none
- Navigates to: PartnerReadings, Home
- Missing route targets in V2: PartnerReadings

## home/PartnerReadingsScreen.tsx
- Present in original: YES
- Present in V2: NO
- Active route in original: LIKELY
- Active route in V2: NO/UNKNOWN
- Stores: profileStore, onboardingStore, authStore
- Services: api, hookAudioCloud, supabase
- Hooks: none
- Expo libs: expo-av
- Media: @/../assets/videos/excentric_couple.mp4
- Navigates to: EditBirthData, SynastryPreview
- Missing route targets in V2: EditBirthData, SynastryPreview

## home/SynastryPreviewScreen.tsx
- Present in original: YES
- Present in V2: NO
- Active route in original: LIKELY
- Active route in V2: NO/UNKNOWN
- Stores: onboardingStore, authStore
- Services: none
- Hooks: none
- Expo libs: expo-av
- Media: @/../assets/videos/want_the_full_picture.mp4
- Navigates to: SynastryOptions
- Missing route targets in V2: SynastryOptions

## home/ComparePeopleScreen.tsx
- Present in original: YES
- Present in V2: NO
- Active route in original: LIKELY
- Active route in V2: NO/UNKNOWN
- Stores: profileStore, authStore
- Services: peopleService
- Hooks: none
- Expo libs: none
- Media: none
- Navigates to: SystemSelection, PartnerInfo, PersonPhotoUpload
- Missing route targets in V2: SystemSelection, PartnerInfo, PersonPhotoUpload

## home/MyLibraryScreen.tsx
- Present in original: YES
- Present in V2: NO
- Active route in original: LIKELY
- Active route in V2: NO/UNKNOWN
- Stores: profileStore, onboardingStore, authStore
- Services: audioDownload, peopleService, supabase, nuclearReadingsService, placementsCalculator, coupleImageService
- Hooks: none
- Expo libs: expo-av
- Media: none
- Navigates to: SystemSelection, YourChart, PersonReadings, JobDetail, HookSequence, SavedReading, PartnerInfo, FullReading, Settings, PersonPhotoUpload, ComparePeople, Added: ${added.join(, Updated: ${updated.join(, Western, Vedic, Human Design, Gene Keys, Kabbalah, Stas, Shofia, Luca, Martina, Iya, Jonathan, Eva, Fabrice Renaudin, ${c.card.person1} & ${c.card.person2}
- Missing route targets in V2: SystemSelection, PersonReadings, JobDetail, SavedReading, PartnerInfo, FullReading, PersonPhotoUpload, Added: ${added.join(, Updated: ${updated.join(, Western, Vedic, Human Design, Gene Keys, Kabbalah, Stas, Shofia, Luca, Martina, Iya, Jonathan, Eva, Fabrice Renaudin, ${c.card.person1} & ${c.card.person2}

## home/SystemsOverviewScreen.tsx
- Present in original: YES
- Present in V2: NO
- Active route in original: LIKELY
- Active route in V2: NO/UNKNOWN
- Stores: none
- Services: none
- Hooks: none
- Expo libs: none
- Media: none
- Navigates to: SystemExplainer, Western Astrology, Jyotish (Vedic), Human Design, Gene Keys, Kabbalah
- Missing route targets in V2: SystemExplainer, Western Astrology, Jyotish (Vedic), Human Design, Gene Keys, Kabbalah

## home/YourChartScreen.tsx
- Present in original: YES
- Present in V2: NO
- Active route in original: LIKELY
- Active route in V2: NO/UNKNOWN
- Stores: onboardingStore, profileStore
- Services: none
- Hooks: none
- Expo libs: expo-haptics
- Media: none
- Navigates to: EditBirthData, PeopleList
- Missing route targets in V2: EditBirthData, PeopleList

## home/HomeScreen.tsx
- Present in original: YES
- Present in V2: YES
- Active route in original: LIKELY
- Active route in V2: LIKELY
- Stores: authStore, onboardingStore, profileStore, subscriptionStore
- Services: placementsCalculator, supabase, hookAudioCloud, api
- Hooks: none
- Expo libs: expo-av
- Media: ../../../assets/images/forbidden-yoga-logo-white.png
- Navigates to: Settings, Gallery, NextStep
- Missing route targets in V2: none

## home/NextStepScreen.tsx
- Present in original: YES
- Present in V2: YES
- Active route in original: LIKELY
- Active route in V2: LIKELY
- Stores: none
- Services: none
- Hooks: none
- Expo libs: expo-av
- Media: ../../../assets/videos/hello_i_love_you.mp4
- Navigates to: MyLibrary, ComparePeople, SystemsOverview, Home
- Missing route targets in V2: none

## social/GalleryScreen.tsx
- Present in original: YES
- Present in V2: YES
- Active route in original: LIKELY
- Active route in V2: LIKELY
- Stores: authStore
- Services: none
- Hooks: none
- Expo libs: none
- Media: none
- Navigates to: none
- Missing route targets in V2: none

## settings/SettingsScreen.tsx
- Present in original: YES
- Present in V2: YES
- Active route in original: LIKELY
- Active route in V2: LIKELY
- Stores: onboardingStore, profileStore, authStore, subscriptionStore
- Services: peopleCloud, supabase
- Hooks: none
- Expo libs: none
- Media: none
- Navigates to: YourChart, MyLibrary, DataPrivacy, PrivacyPolicy, TermsOfService, ContactSupport, About, AccountDeletion
- Missing route targets in V2: none

## settings/AccountDeletionScreen.tsx
- Present in original: YES
- Present in V2: YES
- Active route in original: LIKELY
- Active route in V2: LIKELY
- Stores: onboardingStore, profileStore
- Services: accountDeletion
- Hooks: none
- Expo libs: none
- Media: none
- Navigates to: Settings, Home
- Missing route targets in V2: none

## settings/AboutScreen.tsx
- Present in original: YES
- Present in V2: YES
- Active route in original: LIKELY
- Active route in V2: LIKELY
- Stores: none
- Services: none
- Hooks: none
- Expo libs: none
- Media: none
- Navigates to: PrivacyPolicy, TermsOfService, DataPrivacy
- Missing route targets in V2: none

## settings/PrivacyPolicyScreen.tsx
- Present in original: YES
- Present in V2: YES
- Active route in original: LIKELY
- Active route in V2: LIKELY
- Stores: none
- Services: none
- Hooks: none
- Expo libs: none
- Media: none
- Navigates to: none
- Missing route targets in V2: none

## settings/TermsOfServiceScreen.tsx
- Present in original: YES
- Present in V2: YES
- Active route in original: LIKELY
- Active route in V2: LIKELY
- Stores: none
- Services: none
- Hooks: none
- Expo libs: none
- Media: none
- Navigates to: none
- Missing route targets in V2: none

## social/ChatListScreen.tsx
- Present in original: YES
- Present in V2: NO
- Active route in original: LIKELY
- Active route in V2: NO/UNKNOWN
- Stores: authStore
- Services: none
- Hooks: none
- Expo libs: none
- Media: none
- Navigates to: Chat, Gallery
- Missing route targets in V2: Chat

## social/ChatScreen.tsx
- Present in original: YES
- Present in V2: NO
- Active route in original: LIKELY
- Active route in V2: NO/UNKNOWN
- Stores: authStore
- Services: none
- Hooks: none
- Expo libs: none
- Media: none
- Navigates to: none
- Missing route targets in V2: none

## Aggregate Findings
- Missing screens in V2 (out of 20): 12
- Screens with branch targets unresolved in V2: 11
