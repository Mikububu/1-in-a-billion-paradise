# Screen Path Walk (V2 vs Original)

## Method
For each screen:
1. List all user interactions in that screen.
2. Trace every navigation/state branch.
3. Compare branch targets with original architecture.
4. Mark each branch as OK / Missing / Broken.
5. Move to next screen only after branch map is complete.

---

## Screen: onboarding/HookSequenceScreen.tsx

### Purpose
Display Sun/Moon/Rising hook readings and complete onboarding handoff.

### Interaction branches in V2
1. Swipe among reading pages.
2. Tap `Listen` to play per-reading audio.
3. Swipe to 4th page (`gateway`) and choose:
   - Continue with Google
   - Continue with Apple
4. On SIGNED_IN event:
   - save hook readings
   - completeOnboarding()
   - setRedirectAfterOnboarding('Home')
   - setShowDashboard(true)

### Architecture-expected branches (original)
1. Hook reading pages.
2. Swipe to handoff page.
3. Branch to third-person logic:
   - If partner already exists with full hooks -> PartnerReadings
   - Else -> AddThirdPersonPrompt
4. AddThirdPersonPrompt:
   - YES -> PartnerInfo (then partner core identities + partner hook sequence)
   - NO -> PostHookOffer

### Gap analysis
- Missing in active V2 flow:
  - AddThirdPersonPrompt branch
  - PartnerInfo / PartnerCoreIdentities / PartnerReadings onboarding branch
  - PostHookOffer handoff branch
- Current V2 HookSequence still contains auth gateway behavior, which diverges from the “another person” path architecture.

### Dependency notes
- HookSequence depends on onboardingStore.hookReadings/hookAudio + auth + Supabase auth callback.
- Current V2 file references legacy onboardingStore fields (`userData`) that are not part of V2 store model (unused but indicates old-logic residue).

### Status
NOT OK (branch coverage incomplete vs architecture)

### Next screen to walk
onboarding/AddThirdPersonPromptScreen.tsx (source in original app; not present in V2)


---

## Screen: onboarding/AddThirdPersonPromptScreen.tsx (original source)

### Purpose
Decision gate after first hook flow: add a third person or continue.

### Interaction branches (original)
1. Back -> `HookSequence` (rising page)
2. YES, ADD A PERSON:
   - If existing partner with full hooks -> `PartnerReadings`
   - Else -> `PartnerInfo` (mode: onboarding_hook)
3. NO, CONTINUE -> `PostHookOffer`

### Dependency notes
- Reads people from `profileStore` and checks `!isUser && hookReadings.length === 3`.
- Uses background image asset `assets/images/happy.png` (V2 currently only has `woman-happy.png`).
- Requires routes in navigator:
  - HookSequence
  - PartnerInfo
  - PartnerReadings
  - PostHookOffer

### Gap analysis in V2
- Screen file missing in V2.
- All branch targets above are not fully present in active V2 navigation.
- Asset mismatch (`happy.png` absent in V2).

### Status
MISSING (cannot execute branch)

### Next screen to walk
home/PartnerInfoScreen.tsx (original source)


---

## Screen: home/PartnerInfoScreen.tsx (original source)

### Purpose
Collect third-person birth data and route into partner hook-generation flow.

### Interaction branches (original)
1. Fill name/date/time/city and Continue.
2. Duplicate-name checks:
   - same person data -> reuse existing person
   - conflicting birth data -> block with alert
3. For add-person-only mode -> return to caller (ComparePeople/back)
4. Default onboarding hook mode -> navigate `PartnerCoreIdentities` with partner payload.

### Dependency notes
- Uses:
  - `searchCities` (exists in V2)
  - `calculatePlacements` (exists in V2)
  - `profileStore.addPerson/update/getUser` (exists in V2)
- Original also uses `insertPersonToSupabase` from `peopleService` (not present in V2 under same API).
- Requires navigator targets not currently active in V2:
  - PartnerCoreIdentities
  - PartnerReadings

### Gap analysis in V2
- Screen file missing in V2.
- Route types/stack entries for partner flow missing in V2 RootNavigator.
- Supabase sync call in original needs adapter to V2 service layer (`peopleCloud`/existing sync hooks).

### Status
MISSING (branch chain cannot proceed)

### Next screen to walk
home/PartnerCoreIdentitiesScreen.tsx (original source)


---

## Screen: home/PartnerCoreIdentitiesScreen.tsx (original source)

### Purpose
Partner version of the 3-step ARTS waiting/generation flow; ends by routing to partner hook-readings screen.

### Interaction branches (original)
1. Auto-run sequence (intro -> sun -> moon -> rising).
2. Fast-path reuse when existing partner placements/readings exist (non-onboarding mode).
3. Full generation path in onboarding mode:
   - generate partner hook readings + partner audio
   - save/update partner in profile store
   - navigate `PartnerReadings`

### Dependency notes
- Uses profile/onboarding/auth stores heavily.
- Uses `audioApi`, `uploadHookAudioBase64`, `calculatePlacements`-style data assumptions.
- Requires route target `PartnerReadings`.

### Gap analysis in V2
- Screen file missing in V2.
- Route `PartnerCoreIdentities` missing in V2 navigators.
- Route `PartnerReadings` missing in V2 navigators/screens.

### Status
MISSING (cannot execute partner waiting flow)

### Next screen to walk
home/PartnerReadingsScreen.tsx (original source)


---

## Screen: home/PartnerReadingsScreen.tsx (original source)

### Purpose
Display partner Sun/Moon/Rising readings + audio; gateway into compatibility preview.

### Interaction branches (original)
1. Swipe partner reading pages.
2. Play/stop partner audio per page.
3. Gateway page CTA `Compare Charts ->`:
   - If missing birth time for either person -> alert + route to EditBirthData
   - Else -> navigate `SynastryPreview` with `onboardingNext: 'PostHookOffer'`

### Dependency notes
- Requires partner flow stores + audio services + hook audio cloud sync.
- Uses video asset `assets/videos/excentric_couple.mp4`.
- Requires route targets:
  - SynastryPreview
  - PostHookOffer (handoff from preview)
  - EditBirthData

### Gap analysis in V2
- Screen missing in V2.
- Required downstream routes (`SynastryPreview`, `PostHookOffer`, `EditBirthData`) not active in V2.
- Gateway asset (`excentric_couple.mp4`) not present in V2 assets.

### Status
MISSING (branch cannot complete)

### Branch conclusion: "another person" path
As of current V2, the full branch after first HookSequence is not executable end-to-end.


---

## Cross-Screen Runtime Blockers Found During 20-Screen Pass

1. `onboarding/CoreIdentitiesScreen.tsx` uses onboardingStore selectors not present in V2 store:
   - `setIsOnboardingComplete`
   - `setHookAudioPath`
   - `people.find(p => p.isUser)` (V2 onboarding people use `isMainUser`)

2. `onboarding/HookSequenceScreen.tsx` reads `onboardingStore.userData` which does not exist in V2 store.

3. `home/NextStepScreen.tsx` navigates to unresolved active routes in V2:
   - `MyLibrary`
   - `ComparePeople`
   - `SystemsOverview`

4. `settings/SettingsScreen.tsx` navigates to unresolved active routes in V2:
   - `YourChart`
   - `MyLibrary`

Status: must be resolved before final refactor commit to prevent runtime navigation/store failures.

---

## Deep Path Audit: PartnerInfo -> PartnerCoreIdentities -> PartnerReadings -> SynastryPreview -> PostHookOffer

### Scope
Compare original implementation against active V2 for:
1. route availability
2. forward navigation
3. back/swipe navigation
4. media dependencies
5. service/store dependencies

### Original flow (confirmed)
1. `PartnerInfo`:
   - collects name/date/time/city
   - deduplicates existing person
   - creates/reuses person
   - forwards to `PartnerCoreIdentities` with `mode` passthrough
2. `PartnerCoreIdentities`:
   - 3-step waiting/generation sequence
   - in onboarding mode (`mode === 'onboarding_hook'`) routes with `replace('PartnerReadings')`
   - in non-onboarding mode routes to Home
3. `PartnerReadings`:
   - 3 hook pages + gateway page
   - gateway CTA -> `SynastryPreview` with `onboardingNext: 'PostHookOffer'`
4. `SynastryPreview`:
   - 3 pages (score, insights, gateway)
   - gateway CTA uses `onboardingNext` and navigates to `PostHookOffer`
5. `PostHookOffer`:
   - swipeable offer pages + pay CTA
   - opens RevenueCat yearly subscription
   - on successful purchase -> dashboard (`Home`)

### Back/swipe behavior (original, with current fix)
1. `AddThirdPersonPrompt` YES branch now uses `replace` (patched), so the prompt is removed from history.
2. `PartnerCoreIdentities` -> `PartnerReadings` already uses `replace`, so waiting screen is removed from history.
3. `PartnerReadings` and `SynastryPreview` back actions use `goBack`, so user can travel backward in the partner/post-hook chain.
4. `PostHookOffer` first-page swipe-back now uses `goBack`, preserving step-by-step reverse traversal (not a jump).
5. In onboarding mode, exiting `PartnerInfo` routes to `HookSequence` at `rising`, matching the requested return point.
6. When user returns to `HookSequence`, the index-3 gateway checks for existing third person and routes to `PartnerReadings`, not to `AddThirdPersonPrompt`.
7. Result: after handling YES path once, the add-third-person prompt does not reappear during back traversal.

### V2 status for this path
1. Screen chain now exists in V2:
   - `AddThirdPersonPrompt` -> `PartnerInfo` -> `PartnerCoreIdentities` -> `PartnerReadings` -> `SynastryPreview` -> `PostHookOffer`.
2. Routes are now active in `OnboardingStack` and `HookSequence` handoff now routes to add-third/partner branch.
3. `PostHookOffer` now includes RevenueCat purchase handoff and exits to `Home` (Secret Lives dashboard) on successful purchase.

### V2 media gaps for this path
Added in `/assets` (V2):
1. `images/happy.png`
2. `images/5_systems_transp.png`
3. `videos/excentric_couple.mp4`
4. `videos/want_the_full_picture.mp4`

Not required in current V2 implementation:
1. `offer_page*.mp4`, `we_search_for_you.mp4`, `lets_connet.mp4`
2. `images/systems/*`
Reason: V2 `PostHookOfferScreen` currently keeps simplified visuals but uses RevenueCat purchase logic.

### V2 dependency gaps for this path
1. `src/services/payments.ts` is still missing in V2, but no longer blocks this path because V2 `PostHookOfferScreen` does not depend on payments.
2. `Account` onboarding route remains inactive by design for V2 partner path (handoff now goes to `Home`).
3. Added compatibility bridge service: `src/services/peopleService.ts` delegates person sync to `peopleCloud`.

### Port order required (strict)
Completed for this path in current V2 working copy.

### Status
IMPLEMENTED IN V2 (with simplified post-hook offer flow and `Home` handoff).
