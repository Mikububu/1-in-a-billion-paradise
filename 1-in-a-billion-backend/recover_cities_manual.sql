-- MANUAL CITY RECOVERY based on coordinates
-- Run this in Supabase SQL Editor

-- Aaron: 37.76,-122.51 → San Francisco Bay Area
UPDATE library_people 
SET birth_data = jsonb_set(birth_data, '{birthCity}', '"San Francisco, California, United States"'),
    updated_at = now()
WHERE name = 'Aaron' 
  AND is_user = false
  AND (birth_data->>'birthCity' = 'Unknown' OR birth_data->>'birthCity' IS NULL OR birth_data->>'birthCity' = '');

-- Akasha: 48.26,11.43 → Munich, Germany  
UPDATE library_people 
SET birth_data = jsonb_set(birth_data, '{birthCity}', '"Munich, Bavaria, Germany"'),
    updated_at = now()
WHERE name = 'Akasha' 
  AND is_user = false
  AND (birth_data->>'birthCity' = 'Unknown' OR birth_data->>'birthCity' IS NULL OR birth_data->>'birthCity' = '');

-- Anand: 30.31,78.03 → Dehradun/Uttarakhand, India
UPDATE library_people 
SET birth_data = jsonb_set(birth_data, '{birthCity}', '"Dehradun, Uttarakhand, India"'),
    updated_at = now()
WHERE name = 'Anand' 
  AND is_user = false
  AND (birth_data->>'birthCity' = 'Unknown' OR birth_data->>'birthCity' IS NULL OR birth_data->>'birthCity' = '');

-- Ann: 15.63,101.11 → Khon Kaen, Thailand
UPDATE library_people 
SET birth_data = jsonb_set(birth_data, '{birthCity}', '"Khon Kaen, Thailand"'),
    updated_at = now()
WHERE name = 'Ann' 
  AND is_user = false
  AND (birth_data->>'birthCity' = 'Unknown' OR birth_data->>'birthCity' IS NULL OR birth_data->>'birthCity' = '');

-- Charmaine: 22.31,114.16 → Hong Kong
UPDATE library_people 
SET birth_data = jsonb_set(birth_data, '{birthCity}', '"Hong Kong"'),
    updated_at = now()
WHERE name = 'Charmaine' 
  AND is_user = false
  AND (birth_data->>'birthCity' = 'Unknown' OR birth_data->>'birthCity' IS NULL OR birth_data->>'birthCity' = '');

-- Edgar: 56.96,24.10 → Riga, Latvia
UPDATE library_people 
SET birth_data = jsonb_set(birth_data, '{birthCity}', '"Riga, Latvia"'),
    updated_at = now()
WHERE name = 'Edgar' 
  AND is_user = false
  AND (birth_data->>'birthCity' = 'Unknown' OR birth_data->>'birthCity' IS NULL OR birth_data->>'birthCity' = '');

-- Layla: 46.22,6.07 → Geneva, Switzerland
UPDATE library_people 
SET birth_data = jsonb_set(birth_data, '{birthCity}', '"Geneva, Switzerland"'),
    updated_at = now()
WHERE name = 'Layla' 
  AND is_user = false
  AND (birth_data->>'birthCity' = 'Unknown' OR birth_data->>'birthCity' IS NULL OR birth_data->>'birthCity' = '');

-- Rachel: 40.71,-74.00 → New York City, USA
UPDATE library_people 
SET birth_data = jsonb_set(birth_data, '{birthCity}', '"New York City, New York, United States"'),
    updated_at = now()
WHERE name = 'Rachel' 
  AND is_user = false
  AND (birth_data->>'birthCity' = 'Unknown' OR birth_data->>'birthCity' IS NULL OR birth_data->>'birthCity' = '');

-- Roman: -20.87,55.44 → Saint-Denis, Réunion, France
UPDATE library_people 
SET birth_data = jsonb_set(birth_data, '{birthCity}', '"Saint-Denis, Réunion, France"'),
    updated_at = now()
WHERE name = 'Roman' 
  AND is_user = false
  AND (birth_data->>'birthCity' = 'Unknown' OR birth_data->>'birthCity' IS NULL OR birth_data->>'birthCity' = '');

-- Verify the updates
SELECT name, 
       birth_data->>'birthCity' as recovered_city,
       birth_data->>'latitude' as lat,
       birth_data->>'longitude' as lon
FROM library_people 
WHERE is_user = false
ORDER BY name;
