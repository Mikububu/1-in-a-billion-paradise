# Migration Decisions (Human-Language)

Last updated: 2026-02-14

## Confirmed Product Decisions

0. Registration moved to post-Languages (pre-payment capture).
- Decision: account creation now happens immediately after `Languages`, before hook sequence.
- Reason: collect email/name for all users who pass language step, even if they never subscribe.
- Access rule:
  - unpaid users remain in onboarding/hook flow
  - unpaid users can never enter dashboard/chat
  - once user passes `Languages`, they may not re-enter birth/language screens

1. Remove old onboarding celebration screen.
- Old behavior: after the 3 hook readings, show a "Your chart is ready" celebration page with "Create Account".
- Decision: remove; not needed in V2 flow.

2. Remove old split onboarding steps.
- Old behavior: separate "Name" and separate "Current City" screens.
- Decision: remove; keep current consolidated V2 onboarding flow.

3. Remove old free-reading selection branch.
- Old behavior: separate free-reading selection screen in old onboarding.
- Decision: remove; not part of V2 architecture.

4. Social/matching UI is consolidated to one gallery surface.
- Old/prototype screens: matches list/detail, chat list/chat, match reveal, ready/welcome statement screens.
- Decision: keep one unified "Soul Gallery" screen with:
  - top strip = "My Matches"
  - below = random mystery souls gallery (no names/details shown)
- Chat list + chat remain available for real conversations.
- Match reveal and old statement screens stay deferred.

5. Payment entry point remains only in post-hook offers.
- Decision: no standalone paywall screen in V2.
- Required path: post-hook offers -> RevenueCat purchase -> account creation -> dashboard.

6. Expired subscription should not lock the full app.
- Decision: keep dashboard access even when subscription is inactive/expired.
- UI requirement: show short warning in dashboard/gallery and block chat entry until renewal.
- Warning copy: "Matching plan expired. Reactivate to chat."
- Match counter behavior: keep showing real historical count.
- Match area tap behavior: dashboard match-number tap opens the unified Soul Gallery.
- Chat entry behavior: chat opens from My Matches cards or ChatList and is gated behind renewal when subscription is inactive.
- Gallery requirement: show the same short warning at top.
- Social rule: users can still see matches/gallery after expiry, but any chat entry shows renewal modal with:
  - Message: "Matching plan expired. Reactivate to chat."
  - Primary: "Renew now"
  - Secondary: "Not now"

7. "How matching works" should be an overlay, not a standalone screen route.
- Decision: keep a small button near the dashboard match number that opens an in-place overlay modal.
- UX: overlay closes via `X` or tap outside.
- Navigation: do not add separate `HowMatchingWorks` screen route in V2.

8. Do not migrate orphan route-only legacy screens.
- Source audit result: `ChartCalculation`, `Matches`, `MatchDetail`, and `MatchReveal` have no active `navigate(...)` callers in source flow.
- Decision: keep them out of V2.
- Rationale: they increase code surface without affecting reachable user paths.

9. Aggressive simplification rule for migration.
- Product rule: if a screen/code path is not clearly needed in active flow, do not migrate it.
- Applied now:
  - Keep out: legacy single-system overview screen, `WhyDifferent`, standalone `Purchase`, `FreeReadingSelection`, `OnboardingComplete`, legacy deep-reading output screens.
  - Keep in active flow only: post-hook payment path, account creation, dashboard, Soul Gallery, chat gating.

10. Remove unused `PeopleList` selection mode in V2.
- Source had a secondary `PeopleList` branch for select/returnTo.
- V2 usage audit showed no active callers for that mode.
- Decision: keep `PeopleList` as a simple list -> `PersonProfile` flow only.

11. Keep `ChatList` as a dedicated screen.
- Decision: `ChatList` stays as its own route/screen in V2 (not merged away).
- Access points:
  - `Gallery` header action (`Messages`)
  - Any future dedicated chat entry points can continue to target `ChatList`.

12. Vedic matchmaking spec is a hard migration authority.
- Canonical source docs (source app):
  - `/Users/michaelperinwogenburg/Desktop/big-challenge/ONEINABILLIONAPP/docs/VEDIC_MATCHMAKING_SPEC.md`
  - `/Users/michaelperinwogenburg/Desktop/big-challenge/ONEINABILLIONAPP/docs/VEDIC_MATCHMAKING_LLM_SPEC.md`
- Decision: any V2 Vedic matchmaking logic/prompting must follow these specs exactly.
- Constraint: no invented scoring rules, thresholds, or dosha logic outside those specs.

13. Spice preference is a soft Vedic ranking lens (not a hard gate).
- Decision: preference scale (`1..10`) must influence candidate ordering in matchmaking.
- Rule: apply Vedic hard eligibility first (Ashtakoota + Dosha rules), then apply spice distance as ranking weight.
- Constraint: spice may not override hard Vedic exclusions and may not change canonical Ashtakoota totals.

14. Leather texture is global (single source), not per-screen duplicated.
- Decision: keep leather texture at app shell level via `TexturedBackground`.
- Tint control: use the shared theme variable `VINTAGE_TINT` (via `colors.background`) as the single global tint authority.
- Migration rule: if a source screen had a local `white-leather-texture.jpg` layer, do not duplicate it in V2 when the global background already provides it.
- Result: screens like `PersonPhotoUploadScreen` can stay transparent with no local texture `require(...)`.

## What this means for migration scope

- Required now: active onboarding/payment/dashboard/library/people/core reading flows.
- Not required now: dormant prototype social/chat routes and legacy split onboarding screens.

15. Reading-job tap flow always enters JobDetail status screen first.
- Decision: from library/person-readings lists, tapping a job always opens `JobDetail`.
- Reason: keep one reliable in-between status screen for all jobs; `JobDetail` auto-jumps to `ReadingContent` when artifacts are ready.
- UX result: no direct bypass from list cards to final media page.

16. Western prompt layer naming migrated to Hellenistic.
- Decision: canonical layer IDs/files use `hellenistic-*` naming.
- Compatibility: legacy `western-*` IDs are still accepted in backend registry as aliases.
- Reason: keep prompt architecture language aligned with product/astrology terminology.

17. Partner reading route is explicit from SynastryOptions.
- Decision: "Partner's Reading" now passes partner birth data in canonical params and a `person1Override` payload.
- Reason: avoid silent fallback to self-profile in downstream `SystemSelection` resolution.

18. Remove legacy `style: production` from job payloads.
- Decision: `VoiceSelection` no longer sends `style: 'production'` in `/api/jobs/v2/start`.
- Reason: writing style is now controlled by layered prompt directives, not a legacy style flag.

19. Remove orphan `relationshipMode` from partner hook payloads.
- Decision: `PartnerCoreIdentities` and `PartnerReadings` no longer read/send `relationshipMode`.
- Reason: `relationshipMode` does not exist in V2 onboarding store and was a stale source-era field.

20. Entitlement must refresh on app foreground.
- Decision: re-check entitlement whenever app returns to foreground (`RootNavigator` AppState listener).
- Product behavior unchanged: dashboard remains accessible when inactive; chat/matching gates still key off active/inactive state.
- Failure behavior: on transient foreground-check failures, keep last known `active/inactive` state (do not flip to unknown).

21. Remove startup job-buffer cap enforcement from app shell.
- Decision: `RootNavigator` no longer runs `enforceJobBufferCap()` on startup.
- Reason: V2 media flow is stream-first with per-item download controls; startup buffer trimming adds complexity without user value.
- Note: receipt persistence still has internal guardrails in `jobBuffer` storage logic.

22. Prompt markdown source-of-truth is author-provided files synced into V2.
- Decision: V2 system prompt layers for Kabbalah and Hellenistic are synced from latest authored markdown files (Downloads source provided during migration).
- Scope: both `individual` and `synastry` variants.
- Constraint: keep registry IDs stable; only replace markdown content.

23. Birth-data continue tap hardened against keyboard double-tap loss.
- Decision: `BirthInfoScreen` submit path now dismisses keyboard/suggestions before validation and uses `keyboardShouldPersistTaps="always"`.
- Reason: avoid first tap being consumed by keyboard focus state on iOS.

24. Post-Languages back-navigation lock in account capture flow.
- Decision: in `AccountScreen` (`captureOnly` path), back no longer resets to `Intro` after `hasPassedLanguages=true`.
- Behavior:
  - unauthenticated capture flow: show "Complete account" alert and stay on account screen.
  - authenticated capture flow: reset to `CoreIdentitiesIntro`.
- Reason: enforce product rule that users cannot re-enter Birth/Languages after passing Languages.

25. Normalize asset requires to deterministic relative paths.
- Decision: replaced nonstandard `require('@/../assets/...')` usage with direct relative paths in active screens.
- Updated files:
  - `AddThirdPersonPromptScreen`
  - `PartnerReadingsScreen`
  - `SynastryPreviewScreen`
- Reason: reduce Metro path-resolution ambiguity and keep media loading deterministic across builds.

26. Remove legacy "Nuclear" wording from prompt docs.
- Decision: renamed remaining "Nuclear/combined readings" references in Hellenistic prompt markdown to "Bundle/final-verdict synthesis".
- Reason: align language with V2 architecture (`bundle_16_readings` purchase -> `bundle_verdict` job type), avoid old conceptual confusion.

27. Vedic prompt merge policy: keep Jyotish depth, remove global style overlap.
- Decision: replaced V2 `vedic-individual.md` and `vedic-synastry.md` using the new authored Vedic drafts as source material, but trimmed duplicated global writing-style instructions.
- Kept: system boundary, required calculations, Jyotish interpretation lens, structural reading requirements, explicit verdict/scoring logic.
- Removed/avoided: duplicated global prose-style instructions already governed by `style/writing-style-guide.md`.
- Result: Vedic prompt layers remain analysis-knowledge focused and editable without competing style contracts.

28. Human Design + Gene Keys prompt layers aligned to analysis-only contract.
- Decision: rewrote `human-design-*` and `gene-keys-*` markdown files into the same curated pattern used for Vedic.
- Kept: system boundary, required components, required analysis blocks, explicit compatibility/verdict requirements.
- Removed/avoided: duplicated global writing-style instructions that belong to `style/writing-style-guide.md`.
- Result: all five systems now follow the same layered architecture principle (system knowledge local, writing style global).

29. Hellenistic + Kabbalah prompts re-curated to remove embedded style instructions.
- Decision: rewrote `hellenistic-*` and `kabbalah-*` markdown files into pure analysis-layer format.
- Kept: system boundary, required calculations/derivations, required interpretation structure, scoring/verdict requirements.
- Removed/avoided: voice/tone/literary directives that overlap with global `writing-style-guide.md`.
- Result: all five systems now uniformly separate system knowledge from shared writing style.

30. Image-generation prompts moved to editable markdown blocks in V2.
- Decision: add one markdown source-of-truth file for both image prompt types:
  - `single_portrait` (photo -> stylized portrait)
  - `synastry_portrait` (two portraits -> couple composition)
- Files:
  - `backend/prompt-layers/images/image-transformation-prompts.md`
  - `backend/src/promptEngine/imagePromptLayers.ts` (marker-based loader)
- Rationale: user can modulate image prompts without editing TypeScript constants.

31. Restore synastry couple-image generation trigger in V2 overlay start flow.
- Decision: when starting an overlay job in `VoiceSelection`, V2 now triggers non-blocking couple-image generation if both people have portrait URLs.
- Files:
  - `src/services/coupleImageService.ts`
  - `src/screens/home/VoiceSelectionScreen.tsx`
- Rationale: preserve source behavior that prepares synastry image assets in background without delaying job start.

32. Synastry preview now shows tappable couple image (when available).
- Decision: `SynastryPreviewScreen` now loads couple image via `/api/couples/image` path (through frontend service), shows thumbnail on score page, and opens fullscreen modal on tap.
- Files:
  - `src/screens/home/SynastryPreviewScreen.tsx`
- Rationale: complete user-visible synastry image transformation pipeline in V2 and support enlarged preview UX.

33. V2 backend image module scaffold added (prompt-aware, validator-first).
- Decision: added `backend/src/images/*` module that normalizes payloads and emits provider instructions using MD prompt layers.
- Files:
  - `backend/src/images/contracts.ts`
  - `backend/src/images/service.ts`
  - `backend/src/images/httpHandlers.ts`
  - `backend/src/images/index.ts`
  - `backend/src/index.ts` export
- Rationale: endpoint/runtime integration can be done without reintroducing hardcoded prompt strings.

34. V2 backend PDF runtime migrated as config-driven, in-memory generator.
- Decision: add a dedicated `backend/src/pdf/*` module that enforces strict content routing, uses Garamond-first typography with fallback, embeds portrait/couple images, and returns PDF buffers without temp files.
- Files:
  - `backend/src/pdf/config.ts`
  - `backend/src/pdf/contracts.ts`
  - `backend/src/pdf/service.ts`
  - `backend/src/pdf/index.ts`
  - `backend/src/index.ts` export
  - `backend/package.json` (`pdfkit`, `sharp`, `@types/pdfkit`)
- Rationale: keep PDF creation clean and deterministic, avoid temp-file cleanup drift, and preserve style/image parity as a reusable backend module for V2 integration.

35. Remove orphan subscription/upsell scaffolding from V2.
- Decision: deleted unused local tier/upsell subsystem that was no longer wired into active screens/routes.
- Files removed:
  - `src/store/subscriptionStore.ts`
  - `src/config/subscriptions.ts`
  - `src/components/UpsellModal.tsx`
- Wiring update:
  - `src/screens/settings/SettingsScreen.tsx` no longer references subscription reset.
- Rationale: reduce dead code and avoid drift with RevenueCat-first purchase logic.

36. Remove unused frontend Vedic matchmaking client shim.
- Decision: deleted `src/services/vedicMatchmaking.ts` because no active V2 route/screen imports it.
- Rationale: keep only live dependencies in migration target; avoid carrying unused API wrappers.

37. Job receipt buffer policy simplified to retention-only.
- Decision: removed hard count cap from `src/services/jobBuffer.ts`; keep 90-day retention window only.
- Rationale: align with stream-first media flow and avoid artificial local truncation.

38. Prompt layer registry now uses Hellenistic IDs only.
- Decision: removed `western-*` alias layer IDs from `backend/src/promptEngine/layerRegistry.ts`.
- Rationale: enforce clean V2 naming contract and remove legacy prompt-ID compatibility surface.
