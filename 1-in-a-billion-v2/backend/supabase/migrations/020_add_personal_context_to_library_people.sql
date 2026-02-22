-- Migration 020: Add personal_context field to library_people table
-- Purpose: Store user's personal context/life events for ANY reading system
-- This is a universal field used by all systems (Western, Vedic, Human Design, Gene Keys, Kabbalah, etc.)
-- Kabbalah uses it more extensively, but it's the same single variable for all readings

-- Add personal_context column as TEXT
ALTER TABLE library_people 
ADD COLUMN IF NOT EXISTS personal_context TEXT;

-- Add index for faster queries when filtering by personal context
CREATE INDEX IF NOT EXISTS idx_library_people_personal_context 
ON library_people(personal_context) 
WHERE personal_context IS NOT NULL;

-- Add column comment for documentation
COMMENT ON COLUMN library_people.personal_context IS 
'User-provided personal context including life events, dates, locations, and personal questions.
Universal field used by all reading systems (Western, Vedic, Human Design, Gene Keys, Kabbalah, etc.).
Kabbalah uses this field more extensively, but it is the same single variable for all readings.
Stored as individual field for future matching algorithms and analysis.';
