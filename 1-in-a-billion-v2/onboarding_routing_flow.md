# Onboarding Routing Flow

Here is the exact step-by-step screen logic you outlined, translated into the actual screen file names used in the codebase:

### Scenario A: Logged In Account Taps "Get Started" (Secondary CTA)

1. **`IntroScreen.tsx`**
   - User taps the secondary "Get Started" button at the bottom.
2. **`HookSequenceScreen.tsx` (or `PartnerReadingsScreen.tsx`)**
   - **Condition:** If the user is on the Free tier, they bypass the onboarding data entry forms and immediately go to their 1st hook reading to continue where they left off.
   - **Condition:** If the user is on a Paid tier, they should not see onboarding at all and instead jump directly to `HomeScreen.tsx` (Dashboard).

---

### Scenario B: Fresh Sign Up (New User Prepay Onboarding)

1. **`IntroScreen.tsx`**
   - User inputs their email/password and signs up.
2. **`RelationshipScreen.tsx`**
   - User inputs relationship preferences.
3. **`BirthInfoScreen.tsx`**
   - User inputs their own birth details (Date, Time, City).
4. **`LanguagesScreen.tsx`**
   - User selects their reading language preferences.
5. **`CoreIdentitiesScreen.tsx`**
   - "Waiting Screens": Generating and previewing the 3 user essences across 3 swipeable screens.
6. **`HookSequenceScreen.tsx`**
   - Users view their own 3 hook audio readings (Sun, Moon, Rising).
7. **`AddThirdPersonPromptScreen.tsx`**
   - User is asked if they want to do another reading for a third person.
   - **Branch: User Selects "NO"**
     - User navigates directly to **`PricingScreen.tsx`** (Payment).
     - *Navigation Note:* If the user does not want to pay right now, they can use the top-left back arrow to return to their entire `HookSequenceScreen` to listen to their readings again.
   - **Branch: User Selects "YES"**
     - **`Onboarding_PartnerInfoScreen.tsx`**: User inputs the third person's Name and Birth Details.
     - **`Onboarding_PartnerCoreIdentitiesScreen.tsx`**: Generates the third person's essences.
     - **`Onboarding_PartnerReadingsScreen.tsx`**: Generates and plays the third person's 3 hook audio readings.
     - **`Onboarding_SynastryPreviewScreen.tsx`**: Reviews the compatibility overview between the user and the third person.
     - *Navigation Note:* From this Synastry screen, the user can either tap "Unlock Full Reading" to go to **`PricingScreen.tsx`**, OR they can swipe backwards through `Onboarding_PartnerReadingsScreen` all the way back to their own `HookSequenceScreen`.
     - ***CRITICAL CONDITION:*** Once `Onboarding_PartnerInfoScreen` (the birth details form) is completed, it becomes invisible in the back-stack. A user swiping back from the Partner Readings goes straight back to the `AddThirdPersonPromptScreen` (or their own `HookSequenceScreen`), but they cannot reopen the birth details form.

### Final Payment Step (All Scenarios)

- **`PricingScreen.tsx`**
  - The user selects a 3-tier payment plan and executes the purchase via RevenueCat.
- **`AccountScreen.tsx`**
  - Confirms the backend transaction.
- **`HomeScreen.tsx` (Dashboard)**
  - The final destination.
  - ***CRITICAL CONDITION:*** Once the user reaches the Dashboard, they can **never** use the back button to return to the hook sequence. They are permanently locked out of the onboarding sequence.
