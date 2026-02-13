# Migration Decisions (Human-Language)

Last updated: 2026-02-13

## Confirmed Product Decisions

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

## What this means for migration scope

- Required now: active onboarding/payment/dashboard/library/people/core reading flows.
- Not required now: dormant prototype social/chat routes and legacy split onboarding screens.
