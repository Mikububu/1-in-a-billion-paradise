-- MIGRATION: Prevent duplicate is_user=true entries in library_people
-- 
-- RULE: Only ONE person per user_id can have is_user=true
-- 
-- This creates a unique partial index that enforces:
-- - Each user_id can have ONLY ONE row where is_user=true
-- - Multiple rows with is_user=false are allowed (for partners)
--
-- Run this AFTER cleaning up duplicates with cleanupDuplicateUserProfiles.ts

-- Step 1: Add unique partial index
-- This prevents INSERT or UPDATE that would create duplicate is_user=true for same user_id
CREATE UNIQUE INDEX IF NOT EXISTS library_people_unique_user_profile 
ON library_people (user_id) 
WHERE is_user = true;

-- Step 2: Add comment for documentation
COMMENT ON INDEX library_people_unique_user_profile IS 
'Ensures only one is_user=true entry per user_id. Prevents duplicate self-profiles.';

-- Verification query (run this after migration):
-- SELECT user_id, COUNT(*) as count 
-- FROM library_people 
-- WHERE is_user = true 
-- GROUP BY user_id 
-- HAVING COUNT(*) > 1;
-- 
-- Should return 0 rows after cleanup + migration

