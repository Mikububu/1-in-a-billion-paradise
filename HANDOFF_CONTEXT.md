# V2 Handoff Context

Updated: 2026-02-13

## Project Topology
- Destination (active migration target): `/Users/michaelperinwogenburg/Desktop/big-challenge/1-in-a-billion-v2`
- Source (read-only reference): `/Users/michaelperinwogenburg/Desktop/big-challenge/ONEINABILLIONAPP`

## Non-Negotiables
- Never write into source folder.
- Migrate screen-by-screen with dependency checks.
- Remove orphan/unused legacy paths unless explicitly kept.

## Latest Commits (V2)
- `e46cc28` - layered prompts + bundle terminology migration
- `cca9267` - VEDIC_MATCHMAKING spec recorded as migration authority
- `e13c3f7` - spice preference lens injected + unified context circle screens
- `d347b15` - Vedic spice soft-ranking spec + migration decision
- `b00c1ff` - migrated V2 backend Vedic matchmaking runtime + spice soft-ranking module
- `5a44ad8` - added V2 backend Vedic service contracts/entrypoints (match/score/rank)
- `61132e1` - reading audio player uses dual preloaded sounds (narration+song) for faster play
- `f361dd8` - added V2 backend transport-agnostic Vedic HTTP handler wrappers
- `83f48bd` - refreshed live screen migration status snapshot (active routes vs intentional removals)
- `eb05dc4` - SynastryPreview now sends relationship preference scale to compatibility API
- `b605de5` - createIncludedReading now propagates relationship preference scale
- `88a0d05` - added frontend Vedic matchmaking API client (`/api/vedic/*` wrappers)
- `2f752e8` - hardened partner gateway continue flow (single-tap navigation guard + stable hook-reading hydration key)
- `fe9cda1` - added long-form output-length contract to layered prompt composition + shared style layer
- `b427fe9` - made JobDetail progress telemetry-first (removed misleading artifact-based fake percentage fallback)
- `a4e4d20` - removed prompt-engine legacy alias/fallback layer IDs
- `a76e222` - reverted V2 deep-reading job buffer cap back to 40
- `2fbd733` - reset PartnerReadings synastry-gateway lock state on refocus (prevents sticky disabled continue button)
- `fed299f` - replaced fixed receipt cap with modern cache policy (90-day retention + 200 hard max)

## Canonical Decision Files
- `/Users/michaelperinwogenburg/Desktop/big-challenge/1-in-a-billion-v2/MIGRATION_DECISIONS.md`
- `/Users/michaelperinwogenburg/Desktop/big-challenge/1-in-a-billion-v2/VEDIC_MATCHMAKING_SPEC.md`

## Prompt Architecture (Current)
- Shared writing style: `/Users/michaelperinwogenburg/Desktop/big-challenge/1-in-a-billion-v2/backend/prompt-layers/style/writing-style-guide.md`
- System layers: `individual` + `synastry` MD per system
- Final bundle synthesis layer: `/Users/michaelperinwogenburg/Desktop/big-challenge/1-in-a-billion-v2/backend/prompt-layers/verdict/final-verdict.md`

## Naming Contract
- Product types:
  - `bundle_5_readings`
  - `bundle_16_readings`
- Job type for final bundle synthesis:
  - `bundle_verdict`
- Prompt modes:
  - `individual`, `synastry`, `verdict`

## Spice + Context Contract
- `relationshipPreferenceScale (1..10)` is injected into deep-reading prompt composition.
- It is interpreted as relationship-desire lens (not prose intensity dial).
- Context circle is unified across systems (Kabbalah-specific variant removed).

## Vedic Matchmaking + Spice
- Core Vedic eligibility remains hard authority (Ashtakoota + Dosha rules).
- Spice is soft ranking only (distance-based preference alignment).
- No spice-based hard exclusion.
- No spice override of Ashtakoota/Dosha.

## Quick Recovery Checklist For New Agent
1. Read `MIGRATION_DECISIONS.md`.
2. Read `VEDIC_MATCHMAKING_SPEC.md`.
3. Confirm working only in `1-in-a-billion-v2`.
4. Keep naming contract unchanged.
5. Continue migration path + ask only necessary single questions.

## Big Picture Rehydration Protocol (Required Every New Session)

Before writing code, always reload these files in this order:

1. `/Users/michaelperinwogenburg/Desktop/big-challenge/1-in-a-billion-v2/HANDOFF_CONTEXT.md`
2. `/Users/michaelperinwogenburg/Desktop/big-challenge/1-in-a-billion-v2/MIGRATION_DECISIONS.md`
3. `/Users/michaelperinwogenburg/Desktop/big-challenge/1-in-a-billion-v2/VEDIC_MATCHMAKING_SPEC.md`
4. `/Users/michaelperinwogenburg/Desktop/big-challenge/1-in-a-billion-v2/SCREEN_PATH_WALK.md`
5. `/Users/michaelperinwogenburg/Desktop/big-challenge/1-in-a-billion-v2/SCREEN_MIGRATION_STATUS.md`

If anything conflicts:
- `MIGRATION_DECISIONS.md` wins for product behavior.
- `VEDIC_MATCHMAKING_SPEC.md` wins for Vedic matching behavior.

## North-Star Flow (Do Not Drift)

### Onboarding and monetization
- Intro -> Sign In
- Relationship/Birth/Languages
- Account creation (full: name + email + auth method)
- 3 core identity waiting/read screens
- 3 hook readings
- 3 compatibility screens
- 3 post-hook offer screens
- RevenueCat purchase
- Dashboard (Secret Lives)

### Onboarding lock rules
- After passing `Languages`, users cannot re-enter `BirthInfo`/`Languages`.
- Unpaid users stay in onboarding/hook area and can resume there indefinitely.
- Dashboard unlock remains payment-gated.
- Hook readings for authenticated users are persisted pre-payment.

### Post-onboarding behavior
- Dashboard remains accessible even if subscription expires.
- Expired subscription blocks chat entry only (shows renewal prompt).
- Match/gallery history remains visible (read-only).

### Context and preference injection
- Context circle text is system-agnostic (single behavior for all systems).
- `relationshipPreferenceScale (1..10)` is always injected as relationship-desire lens.
- This scale must shape interpretation and compatibility fit language.

## Folder Safety Rule

- Source folder is read-only reference:
  - `/Users/michaelperinwogenburg/Desktop/big-challenge/ONEINABILLIONAPP`
- All edits must stay in destination:
  - `/Users/michaelperinwogenburg/Desktop/big-challenge/1-in-a-billion-v2`

## Checkpoint 2026-02-13 (commit `46c90c4`)

### Audio Contract Hardening (V2 only)
- Replaced legacy hook-audio Base64 download flow in Home modal playback with storage-path probing + signed URL check.
- Partner hook readings now persist/play from source paths (storage path or URL), not persisted Base64.
- Deterministic cloud path probe for partner hook audio: `hook-audio/{userId}/{partnerId}/{type}.mp3`.
- Removed unused `downloadHookAudioBase64` helper from `src/services/hookAudioCloud.ts`.

### Files touched
- `/Users/michaelperinwogenburg/Desktop/big-challenge/1-in-a-billion-v2/src/screens/home/HomeScreen.tsx`
- `/Users/michaelperinwogenburg/Desktop/big-challenge/1-in-a-billion-v2/src/screens/home/PartnerReadingsScreen.tsx`
- `/Users/michaelperinwogenburg/Desktop/big-challenge/1-in-a-billion-v2/src/screens/home/PartnerCoreIdentitiesScreen.tsx`
- `/Users/michaelperinwogenburg/Desktop/big-challenge/1-in-a-billion-v2/src/services/hookAudioCloud.ts`
- `/Users/michaelperinwogenburg/Desktop/big-challenge/1-in-a-billion-v2/src/store/onboardingStore.ts`

### Verification
- `npm run typecheck` passes in `/Users/michaelperinwogenburg/Desktop/big-challenge/1-in-a-billion-v2`.

## Checkpoint 2026-02-13 (commit `43acca9`)

### Onboarding Hook Audio Cleanup
- `CoreIdentitiesScreen` now prefers `audioApi.generateHookAudio` (storagePath/audioUrl) and no longer persists base64 fallback in onboarding state.
- `HookSequenceScreen` now generates hook audio via `generateHookAudio` first, with TTS URL-only fallback; no base64 writes to `hookAudio`.
- `useSecureOnboardingSync` simplified to path mirroring only (removed legacy base64 upload retry branch).

### Verification
- `npm run typecheck` passes in `/Users/michaelperinwogenburg/Desktop/big-challenge/1-in-a-billion-v2`.

## Checkpoint 2026-02-14 (route audit + orphan check)

### Screen Wiring Audit
- Added repeatable audit command: `npm run audit:screens`.
- New script: `/Users/michaelperinwogenburg/Desktop/big-challenge/1-in-a-billion-v2/scripts/audit-screen-wiring.mjs`.
- Latest audit result:
  - Screen files: 46
  - Route entries: 50
  - Unique route names: 46
  - Unresolved navigation calls: 0
  - Unreferenced screen files: 0
  - Routes with zero external callers: 0

### Status Doc Refresh
- Updated `/Users/michaelperinwogenburg/Desktop/big-challenge/1-in-a-billion-v2/SCREEN_MIGRATION_STATUS.md` with current route counts and explicit no-orphan/no-unresolved-call result.

## Checkpoint 2026-02-14 (deep per-screen dependency audit)

### New repeatable audit
- Added `npm run audit:depscreens`.
- Script: `/Users/michaelperinwogenburg/Desktop/big-challenge/1-in-a-billion-v2/scripts/audit-screen-dependencies.mjs`.
- Output report: `/Users/michaelperinwogenburg/Desktop/big-challenge/1-in-a-billion-v2/SCREEN_DEPENDENCY_AUDIT.md`.

### Current result snapshot
- Audited screens: 46
- Registered route entries: 50 (46 unique names)
- Unresolved outgoing literal route references: 0
- Source-path parity matches: 44/46 (new V2-only screens: `GeneratingReadingScreen`, `ReadingContentScreen`)

### Report content per screen
- Route registration names
- Incoming interaction callsites (screen + line + nav method)
- Outgoing route targets
- Services/Stores/Hooks/Contexts imports
- Media references (imports + require assets)
- Source-path parity flag

## Checkpoint 2026-02-14 (source-vs-V2 screen parity delta)

### New repeatable parity audit
- Added `npm run audit:parity`.
- Script: `/Users/michaelperinwogenburg/Desktop/big-challenge/1-in-a-billion-v2/scripts/audit-screen-parity.mjs`.
- Report: `/Users/michaelperinwogenburg/Desktop/big-challenge/1-in-a-billion-v2/SCREEN_PARITY_DELTA.md`.

### Current snapshot
- V2 screens: 46
- Source screens: 72
- Path-matched compared: 44
- V2-only screens: 2 (`GeneratingReadingScreen`, `ReadingContentScreen`)
- Path-matched screens with deltas: 42

### Purpose
- Makes drift explicit per screen: dependency changes, media changes, outgoing route changes.
- Supports one-question-at-a-time product decisions before final migration lock.

## Checkpoint 2026-02-14 (media parity hardening)

### Restored PostHookOffer rich media in V2
- Replaced simplified text-only `PostHookOfferScreen` with rich source-style media flow while keeping V2 payment verification behavior.
- Added V2 assets:
  - `assets/videos/offer_page1.mp4`
  - `assets/videos/offer_page2.mp4`
  - `assets/videos/offer_page3.mp4`
  - `assets/videos/we_search_for_you.mp4`
  - `assets/videos/lets_connet.mp4`
  - `assets/images/systems/western.png`
  - `assets/images/systems/vedic.png`
  - `assets/images/systems/human-design.png`
  - `assets/images/systems/gene-keys.png`
  - `assets/images/systems/Kabbalah.png`

### Global leather background restored

## Checkpoint 2026-02-14 (PDF pipeline hardening module in V2 backend)

### What was added
- New V2 backend PDF module:
  - `/Users/michaelperinwogenburg/Desktop/big-challenge/1-in-a-billion-v2/backend/src/pdf/config.ts`
  - `/Users/michaelperinwogenburg/Desktop/big-challenge/1-in-a-billion-v2/backend/src/pdf/contracts.ts`
  - `/Users/michaelperinwogenburg/Desktop/big-challenge/1-in-a-billion-v2/backend/src/pdf/service.ts`
  - `/Users/michaelperinwogenburg/Desktop/big-challenge/1-in-a-billion-v2/backend/src/pdf/index.ts`
- Export surface updated:
  - `/Users/michaelperinwogenburg/Desktop/big-challenge/1-in-a-billion-v2/backend/src/index.ts`
- Backend package dependencies updated for real PDF/image runtime:
  - `pdfkit`, `sharp`, `@types/pdfkit`

### Behavior contract
- Strict "one content field per chapter" validation (`person1Reading`/`person2Reading`/`overlayReading`/`verdict`).
- Garamond-first typography with safe fallback font if Garamond asset path is unavailable.
- Portrait/couple image embedding with resize/compression before PDF insertion.
- In-memory PDF generation (`Buffer`) to avoid temp-file accumulation issues.

### Integration note
- This module is migration-ready for worker/API wiring in V2 backend.
- Source backend remains read-only reference; no source-folder writes were performed.
- Added `assets/images/white-leather-texture.jpg` to V2.
- `TexturedBackground` now uses the real texture layer with shared tint authority from `colors.background` (`VINTAGE_TINT`).
- This removes the need for per-screen duplicated leather background requires.

### Home screen media parity fix
- Restored "produced by" logo block in `HomeScreen`.
- Added `assets/images/forbidden-yoga-logo-white.png` to V2.

### Verification
- `npm run typecheck` passes.
- `npm run audit:depscreens` and `npm run audit:parity` regenerated successfully.

## Checkpoint 2026-02-14 (active-screen UX hardening)

### JobDetail progress integrity
- `JobDetailScreen` no longer fakes numeric percent from status-only fallback.
- Percent is shown only when backend task counts exist (`progress.totalTasks/completedTasks` or explicit task arrays).
- Added explicit unknown-progress hint while waiting for backend counts.
- Headline updated to `Preparing Your Reading` (keeps in-between screen intent).

### Voice selection parity
- Restored voice sample preview playback in `VoiceSelectionScreen` (play/stop per voice).
- Added static sample URLs to V2 voice config (`src/config/voices.ts`) for the core 5 voices.
- Preview audio unloads safely on voice switch, start, and unmount.

### Verification
- `npm run typecheck` passes.
- Broken local `require(...)` asset audit: 0 missing files.

## Checkpoint 2026-02-14 (flow + prompt naming alignment)

### Job open-flow alignment
- `MyLibrary` and `PersonReadings` now always open `JobDetail` first (no direct list -> `ReadingContent` jump).
- `JobDetail` remains the single in-between status screen and auto-jumps to `ReadingContent` once strict readiness is met.

### Preference wording cleanup
- Safe↔Spicy descriptors were rewritten to reflect relationship-dynamic preference (not prose-intensity control).
- Removed misleading legacy `intensity` field from `onboardingStore` reading record type.
- Privacy text updated to "safe-to-spicy relationship dynamic preference".

### Prompt naming alignment (Western -> Hellenistic)
- Prompt files renamed:
  - `backend/prompt-layers/systems/hellenistic-individual.md`
  - `backend/prompt-layers/systems/hellenistic-synastry.md`
- Frontend directive defaults now send:
  - `hellenistic-individual-v1`
  - `hellenistic-synastry-v1`
- Backend keeps `western-*` layer IDs as aliases for compatibility.

### Flow hardening (SynastryOptions -> SystemSelection)
- Partner-reading option now forwards partner birth data in canonical route params and includes `person1Override`.
- `SystemSelection` also has a partner fallback branch (`forPartner + partnerBirth*`) so partner reading cannot silently resolve to self.

### Payload cleanup
- `VoiceSelection` no longer sends legacy `style: 'production'`; prompt composition is controlled via `promptLayerDirective`.
- Partner hook reading payloads no longer send stale `relationshipMode`.
- Current V2 payload baseline uses: `promptLayerDirective`, `relationshipPreferenceScale`, optional context fields, and person birth data.

### Verification
- `npm run typecheck` passes in `/Users/michaelperinwogenburg/Desktop/big-challenge/1-in-a-billion-v2`.
- `npm run audit:screens` passes (0 unresolved, 0 unreferenced).

## Checkpoint 2026-02-14 (entitlement lifecycle hardening)

### Foreground entitlement refresh
- Added AppState-based entitlement refresh in `RootNavigator`.
- On app resume (`active`), V2 re-verifies entitlement with backend and updates auth entitlement state:
  - success + active -> `active`
  - success + inactive -> `inactive`
- Transient verification failures during foreground refresh do not downgrade a previously known `active/inactive` state.

### Why this matters
- Prevents stale long-lived sessions from keeping outdated chat/matching access state.
- Keeps product behavior unchanged: inactive users still access dashboard, but chat access remains renewal-gated.

### Verification
- `npm run typecheck` passes.
- `npm run audit:screens` passes (0 unresolved navigation / 0 unreferenced screens).

## Checkpoint 2026-02-14 (startup simplification)

### Startup buffer trim removal
- Removed `enforceJobBufferCap()` call from `RootNavigator` startup path.
- This keeps app shell boot focused on auth/onboarding/navigation concerns only.

### Why this matters
- Reduces startup side effects and unnecessary local-buffer maintenance.
- Aligns with V2 stream-first media architecture and per-item download controls.

### Verification
- `npm run typecheck` passes.
- `npm run audit:screens` passes.

## Checkpoint 2026-02-14 (prompt source sync)

### Synced latest authored prompt layers into V2
- Replaced V2 files with latest authored markdown from Downloads:
  - `backend/prompt-layers/systems/kabbalah-individual.md`
  - `backend/prompt-layers/systems/kabbalah-synastry.md`
  - `backend/prompt-layers/systems/hellenistic-individual.md`
  - `backend/prompt-layers/systems/hellenistic-synastry.md`
- Verified byte-identical sync after copy.

### Token-safety check
- Layer file sizes remain within configured char budgets used by prompt composer.
- Largest current system layer: `hellenistic-individual.md` (~11.6k chars) under `systemKnowledge` cap (20k chars).

## Checkpoint 2026-02-14 (continue-tap hardening)

### Birth-data submit tap reliability
- Updated `BirthInfoScreen` to reduce first-tap loss when keyboard is open:
  - `keyboardShouldPersistTaps` set to `always`
  - `handleContinue()` now dismisses keyboard and closes city suggestions before validation/navigation.

### Verification
- `npm run typecheck` passes.
- `npm run audit:screens` passes.

## Checkpoint 2026-02-14 (post-languages route lock)

### Account back behavior hardened
- `AccountScreen` now enforces post-languages lock:
  - if `hasPassedLanguages` and user is not yet authenticated: back shows "Complete account" alert and keeps user on account.
  - if `hasPassedLanguages` and user is authenticated: back resets to `CoreIdentitiesIntro`.
- Removed fallback behavior that could reset to `Intro` after languages.

### Verification
- `npm run typecheck` passes.
- `npm run audit:screens` passes.

## Checkpoint 2026-02-14 (asset path normalization)

### Media require path cleanup
- Replaced `require('@/../assets/...')` with direct relative `require('../../../assets/...')` in:
  - `src/screens/onboarding/AddThirdPersonPromptScreen.tsx`
  - `src/screens/home/PartnerReadingsScreen.tsx`
  - `src/screens/home/SynastryPreviewScreen.tsx`

### Verification
- `npm run typecheck` passes.
- `npm run audit:screens` passes.
- No remaining `require('@/../assets/...')` patterns in `src`.

## Checkpoint 2026-02-14 (terminology cleanup)

### Prompt language alignment
- Removed remaining "Nuclear" wording from Hellenistic prompt markdown.
- Replaced with "Bundle/final-verdict synthesis" wording to match V2 runtime naming.

### Verification
- Backend prompt-engine typecheck passes.
- No remaining `Nuclear`/`nuclear` tokens under `backend/prompt-layers`.

## Checkpoint 2026-02-14 (Vedic prompt curation)

### New Vedic files integrated with overlap control
- Updated:
  - `backend/prompt-layers/systems/vedic-individual.md`
  - `backend/prompt-layers/systems/vedic-synastry.md`
- Integration policy used:
  - preserve Jyotish analytical depth from new drafts
  - remove duplicated global writing-style directives already covered by `style/writing-style-guide.md`

### Current size / token-safety
- `vedic-individual.md`: ~4.1k chars
- `vedic-synastry.md`: ~4.2k chars
- Both are safely below system layer budget cap.

### Verification
- Backend `npm run typecheck` passes.
- Frontend `npm run typecheck` passes.
- `npm run audit:screens` passes.

## Checkpoint 2026-02-14 (HD + Gene Keys curation)

### Human Design / Gene Keys layered cleanup
- Reworked these files to keep them analysis-focused and remove global style overlap:
  - `backend/prompt-layers/systems/human-design-individual.md`
  - `backend/prompt-layers/systems/human-design-synastry.md`
  - `backend/prompt-layers/systems/gene-keys-individual.md`
  - `backend/prompt-layers/systems/gene-keys-synastry.md`
- Each now has explicit:
  - system boundary
  - required components
  - required analysis blocks
  - analytical rules
  - "does not cover" section pointing to `writing-style-guide.md`

### Token-safety
- All four files are compact (~1.6k–1.8k chars each), well below layer budget caps.

### Verification
- Backend `npm run typecheck` passes.
- Frontend `npm run typecheck` passes.
- `npm run audit:screens` passes.

## Checkpoint 2026-02-14 (Hellenistic + Kabbalah style-overlap removal)

### Re-curated system prompts (analysis-only)
- Reworked:
  - `backend/prompt-layers/systems/hellenistic-individual.md`
  - `backend/prompt-layers/systems/hellenistic-synastry.md`
  - `backend/prompt-layers/systems/kabbalah-individual.md`
  - `backend/prompt-layers/systems/kabbalah-synastry.md`
- Goal: remove embedded style-prompt logic and keep only system-analysis requirements.

### Contract check
- No legacy `style-guide.md` references.
- No `Nuclear` wording.
- Only shared-style pointer remains in each file: `writing-style-guide.md`.

### Verification
- Backend `npm run typecheck` passes.
- Frontend `npm run typecheck` passes.
- `npm run audit:screens` passes.

## Checkpoint 2026-02-14 (image prompt layer extraction)

### Image prompt source-of-truth in V2
- Added editable markdown file for image generation prompt blocks:
  - `backend/prompt-layers/images/image-transformation-prompts.md`
    - `single_portrait`
    - `synastry_portrait`
- Added loader utility:
  - `backend/src/promptEngine/imagePromptLayers.ts`
  - exports:
    - `loadImagePromptLayer(kind)`
    - `loadAllImagePromptLayers()`
- Re-exported via:
  - `backend/src/promptEngine/index.ts`

### Backend docs updated
- `backend/README.md` now includes the image prompt layer file and loader usage.

### Runtime note
- V2 frontend currently calls image endpoints at `CORE_API_URL` (`/api/profile/portrait`).
- In the currently deployed old backend, portrait and couple prompts are still hardcoded in:
  - `src/services/aiPortraitService.ts`
  - `src/services/coupleImageService.ts`
- This checkpoint prepares V2 prompt-layered source; endpoint migration/wiring is the next step to make these markdown prompts live.

## Checkpoint 2026-02-14 (synastry image flow completion in V2 frontend)

### Couple image service migrated
- Added:
  - `src/services/coupleImageService.ts`
- Behavior:
  - Calls `POST ${CORE_API_URL}/api/couples/image`
  - Uses auth user id via `X-User-Id`
  - Supports optional `forceRegenerate`

### Overlay-start trigger restored
- Updated:
  - `src/screens/home/VoiceSelectionScreen.tsx`
- Behavior:
  - For overlay jobs, after job start succeeds, non-blocking couple image generation is triggered when both person portraits are present.
  - Failures are logged but never block navigation to `TreeOfLifeVideo`.

### Synastry preview UX enhancement
- Updated:
  - `src/screens/home/SynastryPreviewScreen.tsx`
- Behavior:
  - Loads couple image when both person IDs + portrait URLs exist.
  - Shows thumbnail in the score page.
  - Tap thumbnail -> fullscreen modal preview.

### Verification
- Frontend `npm run typecheck` passes.
- Backend `npm run typecheck` passes.

## Checkpoint 2026-02-14 (V2 backend image module scaffold)

### New backend module
- Added `backend/src/images`:
  - `contracts.ts` (request + instruction types)
  - `service.ts` (payload normalization + prompt-layer lookup)
  - `httpHandlers.ts` (status/body response wrappers)
  - `index.ts`
- Exported via `backend/src/index.ts` as `images`.

### Scope
- This is prompt-aware runtime scaffolding only (validator + instruction builder).
- It is ready to be wired into actual HTTP routes/worker execution when backend runtime integration is done.

### Verification
- Backend `npm run typecheck` passes.

## Checkpoint 2026-02-14 (orphan cleanup + export sanity)

### Orphan module cleanup (V2 only)
- Removed unused subscription/upsell scaffold:
  - `src/store/subscriptionStore.ts`
  - `src/config/subscriptions.ts`
  - `src/components/UpsellModal.tsx`
- Removed unused Vedic frontend wrapper:
  - `src/services/vedicMatchmaking.ts`
- Updated `SettingsScreen` to remove dead subscription-reset dependency:
  - `src/screens/settings/SettingsScreen.tsx`

### Prompt registry cleanup
- Removed legacy `western-*` alias layer IDs from:
  - `backend/src/promptEngine/layerRegistry.ts`
- Registry now uses Hellenistic canonical IDs only.

### Job buffer policy update
- `src/services/jobBuffer.ts` now applies retention window only (no hard item-count cap).

### Build and runtime sanity checks
- Frontend typecheck: `npm run typecheck` (pass)
- Backend typecheck: `npm run typecheck` in `backend` (pass)
- Screen wiring audit: `npm run audit:screens` (pass; 0 unresolved routes)
- Dependency audit: `npm run audit:depscreens` (pass)
- Parity audit: `npm run audit:parity` (pass)
- Expo runtime bundle check:
  - `npx expo export --platform ios --platform android --output-dir /tmp/oiab-v2-export --clear` (pass)

### Source safety
- Source reference folder is OS immutable-locked (`uchg`):
  - `/Users/michaelperinwogenburg/Desktop/big-challenge/ONEINABILLIONAPP`
