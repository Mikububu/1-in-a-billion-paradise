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
- 3 core identity waiting/read screens
- 3 hook readings
- 3 compatibility screens
- 3 post-hook offer screens
- RevenueCat purchase
- Account creation
- Dashboard (Secret Lives)

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
