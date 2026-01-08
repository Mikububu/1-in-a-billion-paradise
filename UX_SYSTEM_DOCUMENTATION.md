# 1-in-a-Billion: Complete UX System Documentation

**Version:** 1.0  
**Date:** January 2025  
**Purpose:** Complete mapping of all screens, navigation flows, and backend interactions

---

## Table of Contents

1. [Screen Numbering System](#screen-numbering-system)
2. [Navigation Flow Maps](#navigation-flow-maps)
3. [Backend Interactions](#backend-interactions)
4. [Fly.io / Supabase / PDF Pipeline](#flyio--supabase--pdf-pipeline)
5. [Screen Handlers Reference](#screen-handlers-reference)

---

## Screen Numbering System

### ONBOARDING FLOW (Screens 1-9)

**Screen 1: Intro** (`IntroScreen`)
- **Handler:** `S1_INTRO`
- **Purpose:** Welcome screen, app introduction
- **Navigation From:** App launch (if no session)
- **Navigation To:** 
  - `S2_RELATIONSHIP` (Continue button)
  - `S2_SIGNIN` (if user taps sign in)
- **Backend:** None
- **Data Stored:** None

**Screen 2: Relationship** (`RelationshipScreen`)
- **Handler:** `S2_RELATIONSHIP`
- **Purpose:** Collect relationship intensity (0-10) and mode (sensual/romantic/platonic)
- **Navigation From:** `S1_INTRO`
- **Navigation To:** `S3_BIRTHINFO` (Continue button)
- **Backend:** None
- **Data Stored:** `onboardingStore.relationshipIntensity`, `onboardingStore.relationshipMode`

**Screen 3: Birth Info** (`BirthInfoScreen`)
- **Handler:** `S3_BIRTHINFO`
- **Purpose:** Collect birth date, time, and city (with timezone/lat/lon)
- **Navigation From:** `S2_RELATIONSHIP`
- **Navigation To:** `S4_LANGUAGES` (Continue button)
- **Backend:** 
  - `GET /api/cities/search` - Google Places API for city suggestions
- **Data Stored:** `onboardingStore.birthDate`, `onboardingStore.birthTime`, `onboardingStore.birthCity`

**Screen 4: Languages** (`LanguagesScreen`)
- **Handler:** `S4_LANGUAGES`
- **Purpose:** Select primary language (required) and secondary language (optional), plus importance (0-10)
- **Navigation From:** `S3_BIRTHINFO`
- **Navigation To:** `S5_ACCOUNT` (Continue button)
- **Backend:** None
- **Data Stored:** `onboardingStore.primaryLanguage`, `onboardingStore.secondaryLanguage`, `onboardingStore.languageImportance`

**Screen 5: Account** (`AccountScreen`)
- **Handler:** `S5_ACCOUNT`
- **Purpose:** User signup/login (Email, Google, Apple)
- **Navigation From:** `S4_LANGUAGES`
- **Navigation To:** 
  - `S6_CORE_IDENTITIES` (after successful signup)
  - `S1_INTRO` (if signup fails/cancelled)
- **Backend:** 
  - `POST /api/auth/signup` - Email signup
  - Supabase OAuth (Google/Apple) - handled client-side
  - Creates Supabase auth user
- **Data Stored:** 
  - Supabase auth session
  - `authStore.user`, `authStore.session`
  - On signup success, saves onboarding data to Supabase `profiles` table

**Screen 6: Core Identities** (`CoreIdentitiesScreen`)
- **Handler:** `S6_CORE_IDENTITIES`
- **Purpose:** Waiting screen - generates Sun/Moon/Rising hook readings and Sun audio
- **Navigation From:** `S5_ACCOUNT` (after signup)
- **Navigation To:** `S7_HOOK_SEQUENCE` (auto-navigate when Sun audio ready)
- **Backend:** 
  - `POST /api/reading/sun?provider=deepseek` - Generate Sun reading
  - `POST /api/reading/moon?provider=deepseek` - Generate Moon reading (parallel)
  - `POST /api/reading/rising?provider=deepseek` - Generate Rising reading (parallel)
  - `POST /api/audio/hook-audio/generate` - Generate Sun audio (stored in Supabase Storage)
- **Data Stored:** 
  - `onboardingStore.hookReadings.sun/moon/rising` (reading text)
  - `onboardingStore.hookAudio.sun` (URL from Supabase Storage)
  - User placements (sunSign, moonSign, risingSign) saved to `profileStore`
- **Fly.io Impact:** 
  - Backend calculates astro placements using Swiss Ephemeris
  - Calls DeepSeek API for LLM text generation
  - Calls RunPod (Chatterbox TTS) for audio generation
  - Uploads audio to Supabase Storage bucket `library`
- **Supabase Impact:** 
  - Stores audio file at `hook-audio/{userId}/sun.mp3`
  - Returns public URL for playback
- **PDF Impact:** None (hook readings don't generate PDFs)

**Screen 7: Hook Sequence** (`HookSequenceScreen`)
- **Handler:** `S7_HOOK_SEQUENCE`
- **Purpose:** Interactive carousel showing Sun → Moon → Rising readings with audio playback
- **Navigation From:** `S6_CORE_IDENTITIES` (auto-navigate)
- **Navigation To:** 
  - `S8_POST_HOOK_OFFER` (after viewing all 3 readings)
  - `S5_ACCOUNT` (if user taps sign in on gateway page)
- **Backend:** 
  - `POST /api/audio/hook-audio/generate` - Pre-renders Moon audio (while on Sun page)
  - `POST /api/audio/hook-audio/generate` - Pre-renders Rising audio (while on Moon page)
  - `POST /api/reading/{type}?provider={provider}` - Regenerate readings (if user changes provider)
- **Data Stored:** 
  - `onboardingStore.hookAudio.moon` (URL, pre-rendered)
  - `onboardingStore.hookAudio.rising` (URL, pre-rendered)
- **Fly.io Impact:** 
  - Same as S6 for audio generation (RunPod TTS)
- **Supabase Impact:** 
  - Stores Moon audio at `hook-audio/{userId}/moon.mp3`
  - Stores Rising audio at `hook-audio/{userId}/rising.mp3`
- **PDF Impact:** None

**Screen 8: Post Hook Offer** (`PostHookOfferScreen`)
- **Handler:** `S8_POST_HOOK_OFFER`
- **Purpose:** Ask user if they want to add a partner (3rd person) for compatibility readings
- **Navigation From:** `S7_HOOK_SEQUENCE` (after all 3 readings viewed)
- **Navigation To:** 
  - `S10_HOME` (if "No" - completes onboarding)
  - `S9_PARTNER_INFO` (if "Yes" - via `redirectAfterOnboarding` flag)
- **Backend:** 
  - `POST /api/user-readings` - Saves hook readings to Supabase `user_readings` table
- **Data Stored:** 
  - `onboardingStore.hasCompletedOnboarding = true`
  - `onboardingStore.redirectAfterOnboarding = 'PartnerInfo'` (if Yes)
- **Fly.io Impact:** None
- **Supabase Impact:** 
  - Inserts rows into `user_readings` table (sun, moon, rising)
  - Audio URLs already stored in Storage from S6/S7
- **PDF Impact:** None

**Screen 9: Partner Info** (`PartnerInfoScreen`) - Optional
- **Handler:** `S9_PARTNER_INFO`
- **Purpose:** Collect partner's birth info (date, time, city)
- **Navigation From:** `S8_POST_HOOK_OFFER` (if user said Yes)
- **Navigation To:** 
  - `S10_PARTNER_CORE_IDENTITIES` (Continue button)
  - `S10_HOME` (Skip button)
- **Backend:** 
  - `GET /api/cities/search` - Google Places API for city suggestions
- **Data Stored:** 
  - `profileStore.people[]` - Creates new person entry
  - Partner birth data stored locally
- **Fly.io Impact:** None
- **Supabase Impact:** None (stored locally until readings generated)
- **PDF Impact:** None

---

### MAIN DASHBOARD FLOW (Screens 10+)

**Screen 10: Home / Secret Life Dashboard** (`HomeScreen`)
- **Handler:** `S10_HOME`
- **Purpose:** Main dashboard with hook reading carousel, overlay cards, navigation
- **Navigation From:** 
  - `S8_POST_HOOK_OFFER` (onboarding complete)
  - `S9_PARTNER_INFO` (if skipped partner)
  - App launch (if session exists)
- **Navigation To:** 
  - `S11_YOUR_CHART` (Your Chart button)
  - `S12_MY_LIBRARY` (Library button)
  - `S13_MATCHES` (Matches button)
  - `S14_PARTNER_CORE_IDENTITIES` (if partner added from S9)
  - `S15_PERSON_PROFILE` (tap on person card)
  - `S16_SYSTEM_SELECTION` (tap "Get Reading" on overlay card)
  - `S17_AUDIO_PLAYER` (tap play on hook audio)
  - `S18_SETTINGS` (Settings button)
- **Backend:** 
  - `GET /api/jobs/v2/user/:userId/jobs` - Fetch user's jobs (for overlay cards)
  - Reads `hookAudio` from `onboardingStore` (URLs from Supabase Storage)
- **Data Stored:** None (reads from stores)
- **Fly.io Impact:** None (read-only)
- **Supabase Impact:** 
  - Queries `jobs` table for user's completed/processing jobs
  - Reads audio URLs from Storage (already generated in S6/S7)
- **PDF Impact:** None (displays existing PDFs from jobs)

**Screen 11: Your Chart** (`YourChartScreen`)
- **Handler:** `S11_YOUR_CHART`
- **Purpose:** Display user's birth chart visualization
- **Navigation From:** `S10_HOME`
- **Navigation To:** `S10_HOME` (Back button)
- **Backend:** 
  - `POST /api/astrology/calculate-chart` - Calculate chart data
- **Data Stored:** None
- **Fly.io Impact:** 
  - Swiss Ephemeris calculates planetary positions
- **Supabase Impact:** None
- **PDF Impact:** None

**Screen 12: My Library** (`MyLibraryScreen`)
- **Handler:** `S12_MY_LIBRARY`
- **Purpose:** Browse all saved readings, people, and compatibility overlays
- **Navigation From:** `S10_HOME`
- **Navigation To:** 
  - `S19_PERSON_READINGS` (tap on person)
  - `S20_OVERLAY_READER` (tap on overlay card)
  - `S17_AUDIO_PLAYER` (tap play on audio)
  - `S10_HOME` (Back button)
- **Backend:** 
  - `GET /api/jobs/v2/user/:userId/jobs` - Fetch all user jobs
  - Reads artifacts from Supabase Storage
- **Data Stored:** None
- **Fly.io Impact:** None (read-only)
- **Supabase Impact:** 
  - Queries `jobs` table
  - Reads PDF/audio artifacts from Storage buckets
- **PDF Impact:** Displays PDF download links from Storage

**Screen 13: Matches** (`MatchesScreen`)
- **Handler:** `S13_MATCHES`
- **Purpose:** Browse potential matches (future dating feature)
- **Navigation From:** `S10_HOME`
- **Navigation To:** 
  - `S21_MATCH_DETAIL` (tap on match)
  - `S10_HOME` (Back button)
- **Backend:** 
  - `POST /api/match/preview` - Get match previews
- **Data Stored:** None
- **Fly.io Impact:** 
  - Vedic matching engine calculates compatibility
- **Supabase Impact:** 
  - Queries `profiles` table for matching candidates
- **PDF Impact:** None

**Screen 14: Partner Core Identities** (`PartnerCoreIdentitiesScreen`)
- **Handler:** `S14_PARTNER_CORE_IDENTITIES`
- **Purpose:** Waiting screen - generates partner's Sun/Moon/Rising readings and audio
- **Navigation From:** 
  - `S9_PARTNER_INFO` (after entering partner data)
  - `S10_HOME` (if partner added later)
- **Navigation To:** `S22_PARTNER_READINGS` (auto-navigate when complete)
- **Backend:** 
  - `POST /api/reading/sun?provider=deepseek` - Partner Sun reading
  - `POST /api/reading/moon?provider=deepseek` - Partner Moon reading
  - `POST /api/reading/rising?provider=deepseek` - Partner Rising reading
  - `POST /api/audio/hook-audio/generate` - Partner Sun audio
- **Data Stored:** 
  - `profileStore.people[partnerId].hookReadings`
  - `profileStore.people[partnerId].hookAudioPaths` (Storage paths)
- **Fly.io Impact:** Same as S6 (Swiss Ephemeris + DeepSeek + RunPod)
- **Supabase Impact:** 
  - Stores partner audio at `hook-audio/{userId}/partner_{partnerId}_sun.mp3`
  - Saves partner data to `profiles` table
- **PDF Impact:** None

**Screen 15: Person Profile** (`PersonProfileScreen`)
- **Handler:** `S15_PERSON_PROFILE`
- **Purpose:** View/edit a person's profile (user or partner)
- **Navigation From:** 
  - `S10_HOME` (tap person card)
  - `S12_MY_LIBRARY` (tap person)
- **Navigation To:** 
  - `S19_PERSON_READINGS` (View Readings button)
  - `S16_SYSTEM_SELECTION` (Get Reading button)
  - `S23_EDIT_BIRTH_DATA` (Edit button)
  - `S10_HOME` (Back button)
- **Backend:** None (reads from `profileStore`)
- **Data Stored:** None
- **Fly.io Impact:** None
- **Supabase Impact:** None
- **PDF Impact:** None

**Screen 16: System Selection** (`SystemSelectionScreen`)
- **Handler:** `S16_SYSTEM_SELECTION`
- **Purpose:** Choose astrological system(s) and product type for reading
- **Navigation From:** 
  - `S10_HOME` (tap "Get Reading")
  - `S15_PERSON_PROFILE` (Get Reading button)
  - `S24_SYSTEM_EXPLAINER` (after learning about system)
- **Navigation To:** 
  - `S25_RELATIONSHIP_CONTEXT` (if overlay reading)
  - `S26_PERSONAL_CONTEXT` (if individual reading)
  - `S27_VOICE_SELECTION` (if voice selection needed)
  - `S28_GENERATING_READING` (directly if no context needed)
- **Backend:** None (UI only)
- **Data Stored:** 
  - Selected system(s) and product type in navigation params
- **Fly.io Impact:** None
- **Supabase Impact:** None
- **PDF Impact:** None

**Screen 17: Audio Player** (`AudioPlayerScreen`)
- **Handler:** `S17_AUDIO_PLAYER`
- **Purpose:** Play audio readings with controls
- **Navigation From:** 
  - `S10_HOME` (tap play on hook audio)
  - `S12_MY_LIBRARY` (tap play)
  - `S19_PERSON_READINGS` (tap play)
- **Navigation To:** Previous screen (Back button)
- **Backend:** 
  - Fetches audio from Supabase Storage URLs
- **Data Stored:** None
- **Fly.io Impact:** None
- **Supabase Impact:** 
  - Streams audio from Storage bucket
- **PDF Impact:** None

**Screen 18: Settings** (`SettingsScreen`)
- **Handler:** `S18_SETTINGS`
- **Purpose:** App settings, account management
- **Navigation From:** `S10_HOME`
- **Navigation To:** 
  - `S29_ACCOUNT_DELETION` (Delete Account)
  - `S30_PRIVACY_POLICY` (Privacy Policy)
  - `S31_TERMS_OF_SERVICE` (Terms)
  - `S32_DATA_PRIVACY` (Data Privacy)
  - `S33_CONTACT_SUPPORT` (Support)
  - `S34_ABOUT` (About)
  - `S10_HOME` (Back button)
- **Backend:** 
  - `DELETE /api/account/purge` - Delete account (S29)
- **Data Stored:** None
- **Fly.io Impact:** None
- **Supabase Impact:** 
  - Deletes user data from `profiles`, `user_readings`, `jobs` tables
  - Deletes Storage artifacts
- **PDF Impact:** None

**Screen 19: Person Readings** (`PersonReadingsScreen`)
- **Handler:** `S19_PERSON_READINGS`
- **Purpose:** View all readings for a person (individual or overlay)
- **Navigation From:** 
  - `S15_PERSON_PROFILE` (View Readings)
  - `S12_MY_LIBRARY` (tap person)
- **Navigation To:** 
  - `S35_DEEP_READING_READER` (tap on reading)
  - `S20_OVERLAY_READER` (tap on overlay)
  - `S17_AUDIO_PLAYER` (tap play)
  - `S10_HOME` (Back button)
- **Backend:** 
  - `GET /api/jobs/v2/:jobId` - Fetch job details
  - `GET /api/jobs/v2/:jobId/tasks` - Fetch task status
- **Data Stored:** None
- **Fly.io Impact:** None (read-only)
- **Supabase Impact:** 
  - Queries `jobs` and `job_tasks` tables
  - Reads artifacts from Storage
- **PDF Impact:** Displays PDF download links

**Screen 20: Overlay Reader** (`OverlayReaderScreen`)
- **Handler:** `S20_OVERLAY_READER`
- **Purpose:** View compatibility overlay reading (synastry)
- **Navigation From:** 
  - `S12_MY_LIBRARY` (tap overlay card)
  - `S19_PERSON_READINGS` (tap overlay)
- **Navigation To:** 
  - `S17_AUDIO_PLAYER` (tap play)
  - `S10_HOME` (Back button)
- **Backend:** 
  - `GET /api/jobs/v2/:jobId` - Fetch overlay job
- **Data Stored:** None
- **Fly.io Impact:** None (read-only)
- **Supabase Impact:** 
  - Reads overlay reading from `jobs` table
  - Reads PDF/audio from Storage
- **PDF Impact:** Displays overlay PDF

**Screen 21: Match Detail** (`MatchDetailScreen`)
- **Handler:** `S21_MATCH_DETAIL`
- **Purpose:** View detailed match compatibility
- **Navigation From:** `S13_MATCHES`
- **Navigation To:** `S13_MATCHES` (Back button)
- **Backend:** 
  - `POST /api/match/detail` - Get match details
- **Data Stored:** None
- **Fly.io Impact:** 
  - Vedic matching engine calculates detailed compatibility
- **Supabase Impact:** 
  - Queries `profiles` table
- **PDF Impact:** None

**Screen 22: Partner Readings** (`PartnerReadingsScreen`)
- **Handler:** `S22_PARTNER_READINGS`
- **Purpose:** View partner's hook readings (Sun/Moon/Rising)
- **Navigation From:** `S14_PARTNER_CORE_IDENTITIES` (auto-navigate)
- **Navigation To:** 
  - `S36_SYNASTRY_PREVIEW` (View Compatibility button)
  - `S10_HOME` (Back button)
- **Backend:** None (reads from `profileStore`)
- **Data Stored:** None
- **Fly.io Impact:** None
- **Supabase Impact:** None
- **PDF Impact:** None

**Screen 23: Edit Birth Data** (`EditBirthDataScreen`)
- **Handler:** `S23_EDIT_BIRTH_DATA`
- **Purpose:** Edit a person's birth information
- **Navigation From:** `S15_PERSON_PROFILE` (Edit button)
- **Navigation To:** `S15_PERSON_PROFILE` (Save/Back button)
- **Backend:** 
  - `GET /api/cities/search` - City suggestions
- **Data Stored:** 
  - Updates `profileStore.people[id].birthData`
- **Fly.io Impact:** None
- **Supabase Impact:** 
  - Updates `profiles` table (if synced)
- **PDF Impact:** None

**Screen 24: System Explainer** (`SystemExplainerScreen`)
- **Handler:** `S24_SYSTEM_EXPLAINER`
- **Purpose:** Learn about an astrological system before purchasing
- **Navigation From:** 
  - `S16_SYSTEM_SELECTION` (tap "Learn More")
  - `S37_WHY_DIFFERENT` (tap system)
- **Navigation To:** 
  - `S16_SYSTEM_SELECTION` (Back, with preselected system)
  - `S38_PURCHASE` (Buy button)
- **Backend:** None
- **Data Stored:** None
- **Fly.io Impact:** None
- **Supabase Impact:** None
- **PDF Impact:** None

**Screen 25: Relationship Context** (`RelationshipContextScreen`)
- **Handler:** `S25_RELATIONSHIP_CONTEXT`
- **Purpose:** Add relationship context for overlay readings
- **Navigation From:** `S16_SYSTEM_SELECTION` (if overlay reading)
- **Navigation To:** 
  - `S16_SYSTEM_SELECTION` (Back, with context)
  - `S28_GENERATING_READING` (Continue)
- **Backend:** None
- **Data Stored:** Context in navigation params
- **Fly.io Impact:** None
- **Supabase Impact:** None
- **PDF Impact:** None

**Screen 26: Personal Context** (`PersonalContextScreen`)
- **Handler:** `S26_PERSONAL_CONTEXT`
- **Purpose:** Add personal context for individual readings
- **Navigation From:** `S16_SYSTEM_SELECTION` (if individual reading)
- **Navigation To:** 
  - `S16_SYSTEM_SELECTION` (Back, with context)
  - `S28_GENERATING_READING` (Continue)
- **Backend:** None
- **Data Stored:** Context in navigation params
- **Fly.io Impact:** None
- **Supabase Impact:** None
- **PDF Impact:** None

**Screen 27: Voice Selection** (`VoiceSelectionScreen`)
- **Handler:** `S27_VOICE_SELECTION`
- **Purpose:** Choose narrator voice for audio generation
- **Navigation From:** `S16_SYSTEM_SELECTION` (if voice selection needed)
- **Navigation To:** 
  - `S16_SYSTEM_SELECTION` (Back, with selected voice)
  - `S28_GENERATING_READING` (Continue)
- **Backend:** 
  - `GET /api/voices/samples` - Fetch voice samples
- **Data Stored:** Selected voice in navigation params
- **Fly.io Impact:** None
- **Supabase Impact:** 
  - Reads voice samples from Storage
- **PDF Impact:** None

**Screen 28: Generating Reading** (`GeneratingReadingScreen`)
- **Handler:** `S28_GENERATING_READING`
- **Purpose:** Waiting screen - shows job progress while reading generates
- **Navigation From:** 
  - `S16_SYSTEM_SELECTION` (after selection)
  - `S25_RELATIONSHIP_CONTEXT` (Continue)
  - `S26_PERSONAL_CONTEXT` (Continue)
- **Navigation To:** 
  - `S35_DEEP_READING_READER` (auto-navigate when complete)
  - `S20_OVERLAY_READER` (if overlay, auto-navigate)
  - `S39_JOB_DETAIL` (View Details button)
- **Backend:** 
  - `POST /api/jobs/v2/start` - Start reading generation job
  - `GET /api/jobs/v2/:jobId` - Poll job status
  - `GET /api/jobs/v2/:jobId/tasks` - Poll task progress
- **Data Stored:** 
  - Job ID in navigation params
- **Fly.io Impact:** 
  - **CRITICAL SCREEN** - This triggers the entire generation pipeline:
    1. Backend receives job request
    2. Creates job row in Supabase `jobs` table
    3. Enqueues tasks in Supabase `job_queue` table
    4. Text worker (on Fly.io) claims tasks, calls DeepSeek API
    5. PDF worker (on Fly.io) generates PDFs, uploads to Storage
    6. Audio worker (RunPod GPU) generates audio, uploads to Storage
- **Supabase Impact:** 
  - Creates `jobs` row with status `processing`
  - Creates `job_tasks` rows (text_generation, pdf_generation, audio_generation)
  - Workers update task status as they complete
  - Final artifacts stored in Storage buckets (`library` for PDFs, `library` for audio)
- **PDF Impact:** 
  - **PDF GENERATION HAPPENS HERE**
  - PDF worker generates PDF from reading text
  - Uploads to Supabase Storage at `library/{jobId}/document_{docNum}.pdf`
  - Updates job artifact metadata

**Screen 29: Account Deletion** (`AccountDeletionScreen`)
- **Handler:** `S29_ACCOUNT_DELETION`
- **Purpose:** Delete user account and all data
- **Navigation From:** `S18_SETTINGS`
- **Navigation To:** `S18_SETTINGS` (Back/Cancel)
- **Backend:** 
  - `DELETE /api/account/purge` - Delete all user data
- **Data Stored:** 
  - Clears all local stores (AsyncStorage)
- **Fly.io Impact:** None
- **Supabase Impact:** 
  - Deletes from `profiles`, `user_readings`, `jobs`, `job_tasks` tables
  - Deletes all Storage artifacts
  - Revokes auth session
- **PDF Impact:** Deletes all user PDFs from Storage

**Screen 30-34: Settings Sub-screens**
- **S30:** Privacy Policy (`PrivacyPolicyScreen`)
- **S31:** Terms of Service (`TermsOfServiceScreen`)
- **S32:** Data Privacy (`DataPrivacyScreen`)
- **S33:** Contact Support (`ContactSupportScreen`)
- **S34:** About (`AboutScreen`)
- **Navigation:** All from `S18_SETTINGS`, back to `S18_SETTINGS`
- **Backend:** None
- **Fly.io/Supabase/PDF Impact:** None

**Screen 35: Deep Reading Reader** (`DeepReadingReaderScreen`)
- **Handler:** `S35_DEEP_READING_READER`
- **Purpose:** View full reading text with chapters
- **Navigation From:** 
  - `S28_GENERATING_READING` (auto-navigate when complete)
  - `S19_PERSON_READINGS` (tap reading)
- **Navigation To:** 
  - `S17_AUDIO_PLAYER` (tap play)
  - `S10_HOME` (Back button)
- **Backend:** 
  - `GET /api/jobs/v2/:jobId` - Fetch reading text
- **Data Stored:** None
- **Fly.io Impact:** None (read-only)
- **Supabase Impact:** 
  - Reads reading text from `jobs` table or Storage
- **PDF Impact:** Displays PDF download link

**Screen 36: Synastry Preview** (`SynastryPreviewScreen`)
- **Handler:** `S36_SYNASTRY_PREVIEW`
- **Purpose:** Preview compatibility calculation (free)
- **Navigation From:** `S22_PARTNER_READINGS`
- **Navigation To:** 
  - `S40_SYNASTRY_OPTIONS` (Continue to paid readings)
  - `S10_HOME` (Back)
- **Backend:** 
  - `POST /api/compatibility/calculate` - Calculate basic compatibility
- **Data Stored:** None
- **Fly.io Impact:** 
  - Vedic matching engine calculates compatibility score
- **Supabase Impact:** 
  - Queries both profiles from `profiles` table
- **PDF Impact:** None

**Screen 37: Why Different** (`WhyDifferentScreen`)
- **Handler:** `S37_WHY_DIFFERENT`
- **Purpose:** Learn why different systems give different results
- **Navigation From:** Various (Learn More links)
- **Navigation To:** `S24_SYSTEM_EXPLAINER` (tap system)
- **Backend:** None
- **Fly.io/Supabase/PDF Impact:** None

**Screen 38: Purchase** (`PurchaseScreen`)
- **Handler:** `S38_PURCHASE`
- **Purpose:** Purchase reading products
- **Navigation From:** 
  - `S24_SYSTEM_EXPLAINER` (Buy button)
  - `S16_SYSTEM_SELECTION` (after selection)
- **Navigation To:** 
  - `S28_GENERATING_READING` (after purchase)
  - Previous screen (Cancel)
- **Backend:** 
  - Payment processing (Stripe/Apple Pay)
  - `POST /api/jobs/v2/start` - Start job after payment
- **Data Stored:** Purchase record
- **Fly.io Impact:** Same as S28 (triggers generation pipeline)
- **Supabase Impact:** 
  - Records purchase in database
  - Creates job (same as S28)
- **PDF Impact:** Same as S28 (PDF generation)

**Screen 39: Job Detail** (`JobDetailScreen`)
- **Handler:** `S39_JOB_DETAIL`
- **Purpose:** View detailed job status and artifacts
- **Navigation From:** 
  - `S28_GENERATING_READING` (View Details)
  - `S12_MY_LIBRARY` (tap job)
- **Navigation To:** 
  - `S35_DEEP_READING_READER` (View Reading)
  - `S17_AUDIO_PLAYER` (Play Audio)
  - `S10_HOME` (Back)
- **Backend:** 
  - `GET /api/jobs/v2/:jobId` - Fetch job details
  - `GET /api/jobs/v2/:jobId/tasks` - Fetch task details
- **Data Stored:** None
- **Fly.io Impact:** None (read-only)
- **Supabase Impact:** 
  - Queries `jobs` and `job_tasks` tables
  - Lists artifacts from Storage
- **PDF Impact:** Shows PDF download links

**Screen 40: Synastry Options** (`SynastryOptionsScreen`)
- **Handler:** `S40_SYNASTRY_OPTIONS`
- **Purpose:** Choose synastry reading type (overlay vs individual)
- **Navigation From:** `S36_SYNASTRY_PREVIEW`
- **Navigation To:** 
  - `S16_SYSTEM_SELECTION` (Continue)
  - `S10_HOME` (Back)
- **Backend:** None
- **Data Stored:** Selection in navigation params
- **Fly.io/Supabase/PDF Impact:** None

---

## Navigation Flow Maps

### Primary Onboarding Flow
```
S1_INTRO → S2_RELATIONSHIP → S3_BIRTHINFO → S4_LANGUAGES → S5_ACCOUNT 
→ S6_CORE_IDENTITIES → S7_HOOK_SEQUENCE → S8_POST_HOOK_OFFER 
→ [S9_PARTNER_INFO (optional)] → S10_HOME
```

### Reading Generation Flow
```
S10_HOME → S15_PERSON_PROFILE → S16_SYSTEM_SELECTION 
→ [S25_RELATIONSHIP_CONTEXT (if overlay)] 
→ [S26_PERSONAL_CONTEXT (if individual)]
→ [S27_VOICE_SELECTION (optional)]
→ S28_GENERATING_READING → S35_DEEP_READING_READER
```

### Partner Onboarding Flow
```
S9_PARTNER_INFO → S14_PARTNER_CORE_IDENTITIES → S22_PARTNER_READINGS 
→ S36_SYNASTRY_PREVIEW → S40_SYNASTRY_OPTIONS → S16_SYSTEM_SELECTION 
→ S28_GENERATING_READING → S20_OVERLAY_READER
```

### Library Browsing Flow
```
S10_HOME → S12_MY_LIBRARY → S19_PERSON_READINGS → S35_DEEP_READING_READER
```

---

## Backend Interactions

### API Endpoints by Screen

**S3_BIRTHINFO, S9_PARTNER_INFO, S23_EDIT_BIRTH_DATA:**
- `GET /api/cities/search` - Google Places API for city search

**S5_ACCOUNT:**
- `POST /api/auth/signup` - Email signup
- Supabase OAuth (Google/Apple) - Client-side

**S6_CORE_IDENTITIES, S14_PARTNER_CORE_IDENTITIES:**
- `POST /api/reading/sun?provider=deepseek` - Generate Sun reading
- `POST /api/reading/moon?provider=deepseek` - Generate Moon reading
- `POST /api/reading/rising?provider=deepseek` - Generate Rising reading
- `POST /api/audio/hook-audio/generate` - Generate hook audio

**S7_HOOK_SEQUENCE:**
- `POST /api/audio/hook-audio/generate` - Pre-render Moon/Rising audio
- `POST /api/reading/{type}?provider={provider}` - Regenerate readings

**S8_POST_HOOK_OFFER:**
- `POST /api/user-readings` - Save hook readings to Supabase

**S10_HOME, S12_MY_LIBRARY:**
- `GET /api/jobs/v2/user/:userId/jobs` - Fetch user's jobs

**S11_YOUR_CHART:**
- `POST /api/astrology/calculate-chart` - Calculate birth chart

**S13_MATCHES, S21_MATCH_DETAIL:**
- `POST /api/match/preview` - Get match previews
- `POST /api/match/detail` - Get match details

**S17_AUDIO_PLAYER:**
- Fetches audio from Supabase Storage URLs (no API call)

**S19_PERSON_READINGS, S20_OVERLAY_READER, S35_DEEP_READING_READER, S39_JOB_DETAIL:**
- `GET /api/jobs/v2/:jobId` - Fetch job details
- `GET /api/jobs/v2/:jobId/tasks` - Fetch task status

**S27_VOICE_SELECTION:**
- `GET /api/voices/samples` - Fetch voice samples

**S28_GENERATING_READING, S38_PURCHASE:**
- `POST /api/jobs/v2/start` - Start reading generation job
- `GET /api/jobs/v2/:jobId` - Poll job status
- `GET /api/jobs/v2/:jobId/tasks` - Poll task progress

**S29_ACCOUNT_DELETION:**
- `DELETE /api/account/purge` - Delete all user data

**S36_SYNASTRY_PREVIEW:**
- `POST /api/compatibility/calculate` - Calculate compatibility

---

## Fly.io / Supabase / PDF Pipeline

### How Jobs Work (S28_GENERATING_READING)

1. **Frontend calls:** `POST /api/jobs/v2/start`
2. **Backend (Fly.io):**
   - Creates job row in Supabase `jobs` table
   - Creates task rows in Supabase `job_queue` table
   - Returns `jobId` to frontend

3. **Text Worker (Fly.io, no GPU):**
   - Polls Supabase `job_queue` for `text_generation` tasks
   - Claims task, calls DeepSeek API
   - Writes reading text to Supabase `jobs.reading_text` column
   - Marks task as `completed`

4. **PDF Worker (Fly.io, no GPU):**
   - Polls for `pdf_generation` tasks
   - Generates PDF from reading text (using PDF library)
   - Uploads PDF to Supabase Storage: `library/{jobId}/document_{docNum}.pdf`
   - Updates `jobs.artifacts` JSON with PDF metadata
   - Marks task as `completed`

5. **Audio Worker (RunPod GPU):**
   - Polls for `audio_generation` tasks
   - Calls RunPod endpoint (Chatterbox TTS)
   - Receives audio buffer
   - Uploads to Supabase Storage: `library/{jobId}/audio_{docNum}.mp3`
   - Updates `jobs.artifacts` JSON with audio metadata
   - Marks task as `completed`

6. **Frontend polls:** `GET /api/jobs/v2/:jobId`
   - Checks if all tasks are `completed`
   - When complete, navigates to reading screen

### Hook Audio Pipeline (S6, S7, S14)

1. **Frontend calls:** `POST /api/audio/hook-audio/generate`
2. **Backend (Fly.io):**
   - Calls RunPod (Chatterbox TTS) with text
   - Receives audio buffer
   - Uploads to Supabase Storage: `hook-audio/{userId}/{type}.mp3`
   - Returns public URL to frontend
3. **Frontend stores:** URL in `onboardingStore.hookAudio[type]`
4. **No PDF generated** (hook readings are text-only)

### Supabase Storage Buckets

- **`library` bucket:**
  - PDFs: `library/{jobId}/document_{docNum}.pdf`
  - Audio: `library/{jobId}/audio_{docNum}.mp3`
  - Songs: `library/{jobId}/song_{docNum}.mp3`

- **`hook-audio` bucket (or `library/hook-audio`):**
  - User hook audio: `hook-audio/{userId}/sun.mp3`
  - Partner hook audio: `hook-audio/{userId}/partner_{partnerId}_sun.mp3`

### Database Tables

- **`jobs` table:**
  - Stores job metadata, reading text, artifact references
  - Status: `pending`, `processing`, `completed`, `failed`

- **`job_queue` table:**
  - Stores individual tasks (text_generation, pdf_generation, audio_generation)
  - Workers claim tasks, update status

- **`profiles` table:**
  - User and partner profiles
  - Birth data, placements, hook audio paths

- **`user_readings` table:**
  - Stores hook readings (Sun/Moon/Rising) text
  - Links to audio URLs in Storage

---

## Screen Handlers Reference

Use these handlers when discussing navigation:

- `S1_INTRO` - IntroScreen
- `S2_RELATIONSHIP` - RelationshipScreen
- `S3_BIRTHINFO` - BirthInfoScreen
- `S4_LANGUAGES` - LanguagesScreen
- `S5_ACCOUNT` - AccountScreen
- `S6_CORE_IDENTITIES` - CoreIdentitiesScreen
- `S7_HOOK_SEQUENCE` - HookSequenceScreen
- `S8_POST_HOOK_OFFER` - PostHookOfferScreen
- `S9_PARTNER_INFO` - PartnerInfoScreen
- `S10_HOME` - HomeScreen (Dashboard)
- `S11_YOUR_CHART` - YourChartScreen
- `S12_MY_LIBRARY` - MyLibraryScreen
- `S13_MATCHES` - MatchesScreen
- `S14_PARTNER_CORE_IDENTITIES` - PartnerCoreIdentitiesScreen
- `S15_PERSON_PROFILE` - PersonProfileScreen
- `S16_SYSTEM_SELECTION` - SystemSelectionScreen
- `S17_AUDIO_PLAYER` - AudioPlayerScreen
- `S18_SETTINGS` - SettingsScreen
- `S19_PERSON_READINGS` - PersonReadingsScreen
- `S20_OVERLAY_READER` - OverlayReaderScreen
- `S21_MATCH_DETAIL` - MatchDetailScreen
- `S22_PARTNER_READINGS` - PartnerReadingsScreen
- `S23_EDIT_BIRTH_DATA` - EditBirthDataScreen
- `S24_SYSTEM_EXPLAINER` - SystemExplainerScreen
- `S25_RELATIONSHIP_CONTEXT` - RelationshipContextScreen
- `S26_PERSONAL_CONTEXT` - PersonalContextScreen
- `S27_VOICE_SELECTION` - VoiceSelectionScreen
- `S28_GENERATING_READING` - GeneratingReadingScreen ⚠️ **CRITICAL: Triggers PDF/Audio generation**
- `S29_ACCOUNT_DELETION` - AccountDeletionScreen
- `S30-S34` - Settings sub-screens
- `S35_DEEP_READING_READER` - DeepReadingReaderScreen
- `S36_SYNASTRY_PREVIEW` - SynastryPreviewScreen
- `S37_WHY_DIFFERENT` - WhyDifferentScreen
- `S38_PURCHASE` - PurchaseScreen
- `S39_JOB_DETAIL` - JobDetailScreen
- `S40_SYNASTRY_OPTIONS` - SynastryOptionsScreen

---

## Key Takeaways

1. **S28_GENERATING_READING is the critical screen** - This is where all PDF and audio generation happens via the Fly.io/Supabase queue system.

2. **Hook audio (S6, S7, S14) uses a simpler pipeline** - Direct RunPod call, stores in Supabase Storage, returns URL immediately.

3. **PDFs are always generated as part of paid readings** - Never for hook readings (Sun/Moon/Rising).

4. **Supabase Storage structure:**
   - `library/{jobId}/` - Paid reading artifacts
   - `hook-audio/{userId}/` - Free hook audio

5. **Navigation is session-based** - If no Supabase session exists, user sees onboarding (S1). If session exists, user sees dashboard (S10).

---

**End of Documentation**
