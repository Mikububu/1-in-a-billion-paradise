-- Add has_paid_reading flag to library_people table
-- This distinguishes between "added to zoo" people and people who have paid readings

ALTER TABLE library_people 
ADD COLUMN IF NOT EXISTS has_paid_reading BOOLEAN DEFAULT false;

-- Add index for faster queries filtering by paid reading status
CREATE INDEX IF NOT EXISTS idx_library_people_has_paid_reading 
ON library_people(has_paid_reading);

-- Add column comment for documentation
COMMENT ON COLUMN library_people.has_paid_reading IS 
'True if this person has been involved in at least one paid reading job. Used to filter My Souls Library (Screen 14) to only show people with paid readings.';

-- Backfill: Mark people as having paid readings if they appear in any job params
-- This updates existing records based on jobs table
UPDATE library_people lp
SET has_paid_reading = true
WHERE EXISTS (
  SELECT 1 FROM jobs j 
  WHERE j.user_id = lp.user_id 
  AND (
    j.params->>'person1'->>'name' = lp.name 
    OR j.params->>'person2'->>'name' = lp.name
    OR j.input->>'person1'->>'name' = lp.name
    OR j.input->>'person2'->>'name' = lp.name
  )
);
