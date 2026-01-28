-- COMPLETE Fix for Fabrice Renaudin -> Fabrice
-- This updates the name EVERYWHERE it might be stored
-- Run this in Supabase SQL Editor, then clear app cache

-- Step 1: Update in library_people table
UPDATE library_people
SET 
  name = 'Fabrice',
  updated_at = NOW()
WHERE name = 'Fabrice Renaudin' 
   OR name ILIKE 'fabrice%renaudin%'
   OR (name ILIKE 'fabrice%' AND name LIKE '% %');

-- Step 2: Update in jobs table (person1) - if name is stored there
UPDATE jobs
SET 
  params = jsonb_set(
    params,
    '{person1,name}',
    '"Fabrice"'
  ),
  updated_at = NOW()
WHERE params->'person1'->>'name' = 'Fabrice Renaudin'
   OR (params->'person1'->>'name' ILIKE 'fabrice%' 
       AND params->'person1'->>'name' LIKE '% %');

-- Step 3: Update in jobs table (person2) - if name is stored there
UPDATE jobs
SET 
  params = jsonb_set(
    params,
    '{person2,name}',
    '"Fabrice"'
  ),
  updated_at = NOW()
WHERE params->'person2'->>'name' = 'Fabrice Renaudin'
   OR (params->'person2'->>'name' ILIKE 'fabrice%' 
       AND params->'person2'->>'name' LIKE '% %');

-- Step 4: Verify all updates
SELECT 'library_people' as source, name, user_id, client_person_id, updated_at
FROM library_people
WHERE name ILIKE '%fabrice%'
UNION ALL
SELECT 'jobs (person1)' as source, 
       params->'person1'->>'name' as name, 
       user_id, 
       NULL as client_person_id,
       updated_at
FROM jobs
WHERE params->'person1'->>'name' ILIKE '%fabrice%'
UNION ALL
SELECT 'jobs (person2)' as source, 
       params->'person2'->>'name' as name, 
       user_id, 
       NULL as client_person_id,
       updated_at
FROM jobs
WHERE params->'person2'->>'name' ILIKE '%fabrice%';

-- After running this:
-- 1. The database will be updated
-- 2. You need to CLEAR THE APP CACHE (AsyncStorage) for the change to show
-- 3. Options to clear cache:
--    a. Uninstall and reinstall the app
--    b. Clear app data in device settings
--    c. Use React Native Debugger to run: AsyncStorage.removeItem('profile-storage')
--    d. Add a dev menu option to clear cache
