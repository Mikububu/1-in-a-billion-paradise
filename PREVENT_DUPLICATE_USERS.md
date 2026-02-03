# Prevent Duplicate User Profiles System

## The Problem

Users should have **exactly ONE** profile with `isUser=true` in the local store and `is_user=true` in Supabase. Multiple entries cause:

- Duplicate names in "My Karmic Zoo" / "My Souls Library" screen
- Confusion about which is the "real" user profile
- Data inconsistency and sync issues
- App crashes if user deletes their own profile

**Example of the bug:**

```
👥 People in Profile Store (2)
1. Michael (YOU) ✅
2. Michael (YOU) ❌ DUPLICATE - different ID from cloud sync
```

---

## The Solution (5-Layer Protection)

### Layer 1: `upsertPersonById` Guard (PREVENTS CREATION)

**File:** `src/store/profileStore.ts`

When syncing from Supabase cloud, if incoming profile has `isUser: true` AND there's already a local user profile (any ID), **MERGE** instead of adding duplicate.

```typescript
upsertPersonById: (incoming) => {
  // ...
  if (idx < 0) {
    // CRITICAL FIX: If incoming is a user profile, check if ANY user already exists
    if (Boolean(incoming.isUser)) {
      const existingUser = state.people.find((p) => p.isUser);
      if (existingUser) {
        console.log(`👤 Merging cloud user into existing local user (preventing duplicate)`);
        const merged = mergePeople(existingUser, incoming);
        return { people: state.people.map((p) => (p.id === existingUser.id ? merged : p)) };
      }
    }
    // ... add new person only if no conflict
  }
}
```

**This fixes the root cause:** Cloud sync with different `client_person_id` no longer creates duplicates.

---

### Layer 2: `deletePerson` Protection (PREVENTS SELF-DELETION)

**File:** `src/store/profileStore.ts`

User **CANNOT** delete their own profile. This prevents app crashes.

```typescript
deletePerson: (id) => {
  const personToDelete = get().people.find((p) => p.id === id);
  if (personToDelete?.isUser) {
    console.error('❌ BLOCKED: Cannot delete user profile.');
    return; // Silently refuse
  }
  // ... proceed with delete for partners
}
```

---

### Layer 3: `dedupePeopleState` Fix (MERGES ALL USERS)

**File:** `src/store/profileStore.ts`

Previously grouped by `name + isUser`, which missed users with different names (e.g., "Michael" vs "You").

**Now:** ALL `isUser: true` profiles are merged into ONE, regardless of name.

```typescript
const dedupePeopleState = (state) => {
  // CRITICAL FIX: Merge ALL isUser:true profiles into ONE
  const userProfiles = people.filter((p) => p?.isUser === true);
  
  if (userProfiles.length > 1) {
    // Sort by completeness, merge all into best one
    let mergedUser = userProfiles[0];
    for (let i = 1; i < userProfiles.length; i++) {
      mergedUser = mergePeople(mergedUser, userProfiles[i]);
    }
    survivors.push(mergedUser);
  }
  // ... then process partner profiles separately
}
```

---

### Layer 4: Auto-Cleanup on Hydration (SAFETY NET)

**File:** `src/store/profileStore.ts` - `onRehydrateStorage`

Every time the app starts and loads from AsyncStorage, it checks for duplicate user profiles and cleans them up automatically.

```typescript
onRehydrateStorage: () => {
  return (state, error) => {
    if (state) {
      state.hasHydrated = true;
      
      // Auto-cleanup duplicate user profiles on every app start
      const userCount = state.people?.filter((p) => p?.isUser === true)?.length || 0;
      if (userCount > 1) {
        console.warn(`⚠️ Found ${userCount} user profiles - running cleanup...`);
        setTimeout(() => {
          useProfileStore.getState().cleanupDuplicateUsers();
        }, 100);
      }
    }
  };
}
```

---

### Layer 5: Screen-Level Self-Delete Protection

**Files:**
- `ComparePeopleScreen.tsx`
- `PeopleListScreen.tsx`
- `PersonProfileScreen.tsx`
- `MyLibraryScreen.tsx`

All delete handlers check `person.isUser` before showing delete confirmation:

```typescript
const handleDeletePerson = (person) => {
  if (person.isUser) {
    Alert.alert('Cannot Delete', 'You cannot delete your own profile.');
    return;
  }
  // ... show delete confirmation
};
```

---

### Layer 6: Database Constraint (STRONGEST - Supabase)

**File:** `migrations/add_unique_user_profile_constraint.sql`

```sql
CREATE UNIQUE INDEX library_people_unique_user_profile 
ON library_people (user_id) 
WHERE is_user = true;
```

This prevents duplicates at the database level. Even if frontend bugs exist, Supabase will reject duplicate inserts.

---

## How Duplicates Were Created (Root Cause)

**Scenario:**
1. User completes onboarding → Local profile `id = "abc123"`, `isUser: true`
2. Syncs to Supabase with `client_person_id = "abc123"`
3. User clears storage / reinstalls / logs in on new device
4. New local profile created with `id = "xyz789"`, `isUser: true`
5. Supabase sync fetches old profile (`id = "abc123"`)
6. **OLD BUG:** `upsertPersonById` saw ID doesn't match → added as new person
7. **Result:** TWO user profiles with `isUser: true`

**NOW FIXED:** `upsertPersonById` checks for ANY existing user profile before adding, and merges instead.

---

## Deployment Checklist

### Already Applied (Committed):
- [x] `upsertPersonById` guard against duplicate users
- [x] `deletePerson` blocks self-deletion
- [x] `dedupePeopleState` merges ALL user profiles regardless of name
- [x] Auto-cleanup on store hydration
- [x] Screen-level self-delete protection (4 screens)

### Optional: Database Constraint

```bash
# If not already applied: use your Postgres connection string in `DATABASE_URL` (see docs/ENVIRONMENT_VARIABLES.md)
psql "$DATABASE_URL" -f migrations/add_unique_user_profile_constraint.sql
```

---

## Verification

### Check Local Store (Dev Mode)
Use Storage Inspector in app to see all people and verify only ONE has `isUser: true`.

### Check Supabase
```sql
-- Should return 0 rows (no duplicates)
SELECT user_id, COUNT(*) as count 
FROM library_people 
WHERE is_user = true 
GROUP BY user_id 
HAVING COUNT(*) > 1;
```

### Check Logs
On app start, look for:
```
📦 Profile store: Hydration complete
✅ No duplicate user profiles found
```

Or if cleanup runs:
```
⚠️ Found 2 user profiles on hydration - running cleanup...
✅ Hydration cleanup: merged 1 duplicate user profiles
```

---

## Related Files

| File | Purpose |
|------|---------|
| `profileStore.ts` | Core store with all duplicate prevention logic |
| `ComparePeopleScreen.tsx` | Self-delete protection |
| `PeopleListScreen.tsx` | Self-delete protection |
| `PersonProfileScreen.tsx` | Self-delete protection |
| `MyLibraryScreen.tsx` | Self-delete protection |
| `cleanupDuplicateUserProfiles.ts` | Backend cleanup script |
| `add_unique_user_profile_constraint.sql` | Database constraint |

---

## Troubleshooting

### User still sees duplicates after update
1. Force close and reopen app (triggers hydration cleanup)
2. Check console logs for cleanup messages
3. If persists, clear AsyncStorage and re-login

### "Cannot delete" alert when trying to delete self
**This is correct behavior!** Users cannot delete their own profile.

### Cloud sync seems to create duplicates
Check if `upsertPersonById` fix is deployed. The fix merges into existing user instead of adding.

---

## Last Updated
**January 11, 2026** - Added 5-layer protection system
