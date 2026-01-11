# Prevent Duplicate User Profiles System

## The Problem

Users should have **exactly ONE** profile with `is_user=true` in the `library_people` table. Multiple entries cause:

- Duplicate names in "My Souls Library" screen
- Confusion about which is the "real" user profile
- Data inconsistency and sync issues

**Example of the bug:**

```
👥 People in Profile Store (2)
1. Michael (YOU) ✅
2. fantasyisland007 (YOU) ❌ GHOST
```

## The Solution (3-Layer Protection)

### Layer 1: Database Constraint (STRONGEST)

**File:** `migrations/add_unique_user_profile_constraint.sql`

Creates a unique partial index that **prevents** duplicate `is_user=true` entries at the database level.

```sql
CREATE UNIQUE INDEX library_people_unique_user_profile 
ON library_people (user_id) 
WHERE is_user = true;
```

**Run this migration:**

```bash
# Connect to your Supabase database and run:
psql $DATABASE_URL -f migrations/add_unique_user_profile_constraint.sql

# Or via Supabase Dashboard:
# SQL Editor → New Query → Paste SQL → Run
```

### Layer 2: Cleanup Script (REACTIVE)

**File:** `src/scripts/cleanupDuplicateUserProfiles.ts`

Finds and removes existing duplicates, keeping the **newest** profile.

**Usage:**

```bash
cd "1 in a Billion/1-in-a-billion-backend"

# Preview what would be deleted (safe, no changes):
DRY_RUN=true npx ts-node src/scripts/cleanupDuplicateUserProfiles.ts

# Actually clean up duplicates:
npx ts-node src/scripts/cleanupDuplicateUserProfiles.ts
```

**Example output:**

```
⚠️  Found 1 user(s) with duplicate profiles:

👤 User ID: cf26a09f-a8b9-4bb5-91f2-54f92e29470e
   ✅ KEEP: "Michael" (id: 1767776964396-3icmfllzc, created: 2026-01-07T09:09:24.396Z)
   ❌ DELETE: "fantasyisland007" (id: self-82fbde84-..., created: 2026-01-07T09:08:56.788Z)

✅ CLEANUP COMPLETE:
   Deleted: 1 duplicate profiles
```

### Layer 3: Frontend Migration (PROACTIVE)

**File:** `src/store/profileStore.ts` (v6 migration)

Automatically cleans up duplicates when the app loads from AsyncStorage.

**Logic:**

- Detects multiple `is_user=true` entries in memory
- Keeps the **newest** one (by `createdAt`)
- Removes older ghosts
- Logs what was cleaned

**Runs automatically** when app version bumps to v6.

## Deployment Checklist

### Step 1: Clean Up Existing Duplicates

```bash
# Preview first
DRY_RUN=true npx ts-node src/scripts/cleanupDuplicateUserProfiles.ts

# If looks good, run for real
npx ts-node src/scripts/cleanupDuplicateUserProfiles.ts
```

### Step 2: Add Database Constraint

```bash
# Via psql
psql $SUPABASE_DATABASE_URL -f migrations/add_unique_user_profile_constraint.sql

# OR via Supabase Dashboard:
# 1. Go to SQL Editor
# 2. Paste contents of add_unique_user_profile_constraint.sql
# 3. Run
```

### Step 3: Deploy Frontend with v6 Migration

```bash
# Commit changes
git add .
git commit -m "Add duplicate user profile prevention system"

# Deploy
# (migration v6 will run automatically on app load)
```

### Step 4: Verify

```bash
# Check for any remaining duplicates:
psql $SUPABASE_DATABASE_URL -c "
  SELECT user_id, COUNT(*) as count 
  FROM library_people 
  WHERE is_user = true 
  GROUP BY user_id 
  HAVING COUNT(*) > 1;
"

# Should return 0 rows
```

## How It Prevents Future Duplicates

1. **Database Layer**: Any INSERT/UPDATE that tries to create a second `is_user=true` for the same `user_id` will **fail** with a unique constraint violation.

2. **Frontend Layer**: The `addPerson` function already checks for existing `isUser=true` entries and **updates** instead of creating new ones.

3. **Migration Layer**: On app load, if duplicates somehow exist in local storage, they're automatically cleaned up.

## Monitoring

### Check for Duplicates

```bash
# Via script
npx ts-node src/scripts/cleanupDuplicateUserProfiles.ts

# Via SQL
SELECT user_id, name, is_user, created_at 
FROM library_people 
WHERE is_user = true 
ORDER BY user_id, created_at DESC;
```

### Storage Inspector (Dev Tool)

In the app (DEV mode), tap the 🔍 button on "My Souls Library" to see:

- All people in memory
- Which are marked as "YOU"
- Birth data and placements

## Troubleshooting

### "ERROR: duplicate key value violates unique constraint"

**Good!** This means the database constraint is working. It prevented a duplicate from being created.

**Fix:** The frontend should already handle this. If you see this error, check:

1. Is `addPerson` checking for existing `isUser=true`?
2. Is the Supabase sync creating duplicates?

### User sees duplicate names in library

**Option 1:** Run cleanup script

```bash
npx ts-node src/scripts/cleanupDuplicateUserProfiles.ts
```

**Option 2:** They can delete and re-create account (account deletion now properly cleans up)

**Option 3:** Force app reload (migration v6 will clean up on next load)

## Related Files

- `profileStore.ts` - Frontend store with duplicate prevention
- `cleanupDuplicateUserProfiles.ts` - Cleanup script
- `add_unique_user_profile_constraint.sql` - Database migration
- `StorageInspector.tsx` - Debug tool to see what's in memory
- `account.ts` - Account deletion endpoint (should clean up properly)

## Questions?

If a user still has duplicates after all this:

1. Run the cleanup script
2. Check if the database constraint exists
3. Use the Storage Inspector to see where the duplicate is coming from
4. Check Supabase `library_people` table directly
