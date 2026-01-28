-- Update Fabrice Renaudin to just Fabrice EVERYWHERE
-- Run this in Supabase SQL Editor, then reload your app

-- Step 1: Update in library_people table
UPDATE library_people
SET 
  name = 'Fabrice',
  updated_at = NOW()
WHERE name = 'Fabrice Renaudin' 
   OR name ILIKE 'fabrice%renaudin%'
   OR (name ILIKE 'fabrice%' AND name LIKE '% %');

-- Step 2: Update in jobs table (person1)
UPDATE jobs
SET 
  params = jsonb_set(
    params,
    '{person1,name}',
    '"Fabrice"'
  ),
  updated_at = NOW()
WHERE params->'person1'->>'name' = 'Fabrice Renaudin'
   OR (params->'person1'->>'name' ILIKE 'fabrice%' AND params->'person1'->>'name' LIKE '% %');

-- Step 3: Update in jobs table (person2)
UPDATE jobs
SET 
  params = jsonb_set(
    params,
    '{person2,name}',
    '"Fabrice"'
  ),
  updated_at = NOW()
WHERE params->'person2'->>'name' = 'Fabrice Renaudin'
   OR (params->'person2'->>'name' ILIKE 'fabrice%' AND params->'person2'->>'name' LIKE '% %');

-- Step 4: Verify the updates
SELECT 'library_people' as source, name, user_id, client_person_id
FROM library_people
WHERE name ILIKE '%fabrice%'
UNION ALL
SELECT 'jobs (person1)' as source, params->'person1'->>'name' as name, user_id, NULL
FROM jobs
WHERE params->'person1'->>'name' ILIKE '%fabrice%'
UNION ALL
SELECT 'jobs (person2)' as source, params->'person2'->>'name' as name, user_id, NULL
FROM jobs
WHERE params->'person2'->>'name' ILIKE '%fabrice%';
