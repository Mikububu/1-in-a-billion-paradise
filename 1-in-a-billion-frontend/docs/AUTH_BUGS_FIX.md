# Critical Authentication Bugs - January 21, 2026

## Bug 1: Users Signed In Before Completing Onboarding

**Problem:**
- Users sign up (create Supabase account) at AccountScreen
- Then continue through CoreIdentities → HookSequence → PostHookOffer WHILE SIGNED IN
- If app crashes or user closes app during this time, they have a Supabase account with incomplete profile data
- Creates "zombie accounts" in Supabase

**Current Flow (BUGGY):**
```
Paid: PostHookOffer (pay) → NameInput → Account (SIGN IN) → CoreIdentities → HookSequence → complete
Free: Never signs up (stays anonymous)
```

**Fixed Flow:**
```
Paid: PostHookOffer (pay) → Account (SIGN IN + complete immediately) → MyLibrary
Free: PostHookOffer → Account (optional sign up) OR stays anonymous
```

**Implementation:**
- AccountScreen now calls `onboarding.completeOnboarding()` immediately after signup
- This marks onboarding complete and switches to MainNavigator (dashboard)
- No more onboarding screens after signup

---

## Bug 2: Name Asked Twice

**Problem:**
- NameInputScreen asks "The name you wish to be known by"
- Stores in `authStore.displayName`
- Then AccountScreen email form asks "Name (how should we call you?)"
- The displayName from NameInputScreen is NEVER USED in email signup!
- AccountScreen uses its own name field (line 296)
- This is confusing and creates duplicate entry points

**Solution:**
- For Email signup: Use name from AccountScreen form (keep as-is)
- For OAuth (Google/Apple): Use displayName from NameInputScreen OR from OAuth provider
- Remove redundant name input

**Note:** NameInputScreen is ONLY used after payment in current flow (PostHookOffer → NameInput → Account)

---

## "Bug 3": IntroScreen as Homescreen (NOT A BUG)

**Initial Misunderstanding:**
- Thought logged-in users should skip IntroScreen entirely

**Actual Correct Behavior:**
- Logged-in user opens app → IntroScreen (homescreen)
- IntroScreen shows: "Sign Out" button + "My Secret Life" button
- User clicks "My Secret Life" → Dashboard

**This is WORKING AS INTENDED!**
- IntroScreen serves as a homescreen for logged-in users
- Gives them the choice to access dashboard or sign out
- NO changes needed

---

## Implementation Checklist

- [x] AccountScreen email signup: Call `completeOnboarding()` after successful signup
- [x] AccountScreen OAuth signup: Call `completeOnboarding()` after successful OAuth
- [ ] Remove NameInputScreen OR repurpose it for OAuth flow only
- [ ] Update PostHookOfferScreen payment flow to handle name properly
- [ ] Test: Email signup → should go straight to dashboard
- [ ] Test: OAuth signup → should go straight to dashboard
- [ ] Test: Signed-in user opens app → should see dashboard immediately

---

## Files Modified

1. `src/screens/onboarding/AccountScreen.tsx`
   - Email signup: Added `completeOnboarding()` and `setShowDashboard(true)` after successful signup
   - OAuth signup: Added `completeOnboarding()` and `setShowDashboard(true)` after successful OAuth

---

## Next Steps

1. Test the flow in app to verify fix works
2. Consider adding "Skip for now" option on PostHookOffer for free users
3. Consider removing NameInputScreen entirely if not needed

---

**Status:** Partially implemented - need testing
**Date:** January 21, 2026
