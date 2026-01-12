-- Migration 020: Add personal_context field to library_people table
-- Purpose: Store user's personal context/life events for Kabbalah and other readings
-- This is the text they enter in PersonalContextScreen (up to 600 chars for Kabbalah)

-- Add personal_context column as TEXT
ALTER TABLE library_people 
ADD COLUMN IF NOT EXISTS personal_context TEXT;

-- Add index for faster queries when filtering by personal context
CREATE INDEX IF NOT EXISTS idx_library_people_personal_context 
ON library_people(personal_context) 
WHERE personal_context IS NOT NULL;

-- Add column comment for documentation
COMMENT ON COLUMN library_people.personal_context IS 
'User-provided personal context including surname, life events, dates, and locations. 
Used primarily for Kabbalah readings (up to 600 characters) but can be used for any reading system.
Stored as individual field for future matching algorithms and analysis.';
