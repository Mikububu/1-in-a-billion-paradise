-- Fix Fabrice Renaudin's name - works even with the normalization trigger
-- The trigger will automatically extract "Fabrice" from "Fabrice Renaudin"
-- Run this in your Supabase SQL Editor

-- Step 1: Check what we have
SELECT 
  user_id,
  client_person_id,
  name,
  is_user,
  created_at
FROM library_people
WHERE name ILIKE '%fabrice%' OR name ILIKE '%renaudin%';

-- Step 2: Update Fabrice Renaudin to just Fabrice
-- The trigger will automatically normalize it, but we can also explicitly set it
UPDATE library_people
SET 
  name = 'Fabrice',
  updated_at = NOW()
WHERE name = 'Fabrice Renaudin'
   OR name ILIKE 'fabrice%renaudin%';

-- Step 3: If the above doesn't work (trigger might be interfering), 
-- temporarily disable the trigger, update, then re-enable:
-- 
-- ALTER TABLE library_people DISABLE TRIGGER trg_normalize_library_people_name;
-- 
-- UPDATE library_people
-- SET 
--   name = 'Fabrice',
--   updated_at = NOW()
-- WHERE name = 'Fabrice Renaudin'
--    OR name ILIKE 'fabrice%renaudin%';
-- 
-- ALTER TABLE library_people ENABLE TRIGGER trg_normalize_library_people_name;

-- Step 4: Verify the update
SELECT 
  user_id,
  client_person_id,
  name,
  updated_at
FROM library_people
WHERE name ILIKE '%fabrice%';
