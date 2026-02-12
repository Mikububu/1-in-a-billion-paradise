# Migration Decisions (Human-Language)

Last updated: 2026-02-12

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

## What this means for migration scope

- Required now: active onboarding/payment/dashboard/library/people/core reading flows.
- Not required now: dormant prototype social/chat routes and legacy split onboarding screens.
