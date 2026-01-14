-- Fix Fabrice Renaudin's name - remove the surname "Renaudin"
-- This will update "Fabrice Renaudin" to just "Fabrice"
-- Run this in your Supabase SQL Editor

-- First, let's see what we're working with
SELECT 
  user_id,
  client_person_id,
  name,
  is_user,
  created_at
FROM library_people
WHERE name ILIKE '%fabrice%' OR name ILIKE '%renaudin%';

-- If the above shows "Fabrice Renaudin", run this update:
-- UPDATE library_people
-- SET 
--   name = 'Fabrice',
--   updated_at = NOW()
-- WHERE name = 'Fabrice Renaudin';

-- Or if you want to be more flexible and remove everything after the first space:
-- UPDATE library_people
-- SET 
--   name = SPLIT_PART(name, ' ', 1),
--   updated_at = NOW()
-- WHERE name ILIKE '%fabrice%' AND name LIKE '% %';
