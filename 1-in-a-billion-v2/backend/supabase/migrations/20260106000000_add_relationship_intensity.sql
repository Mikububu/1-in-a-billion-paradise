-- Migration: Add relationship_intensity column to library_people table
-- Purpose: Persist user relationship preference signal (Safe ↔ Spicy slider)
-- Date: 2026-01-06

-- Add relationship_intensity column with constraints
ALTER TABLE library_people 
ADD COLUMN relationship_intensity INTEGER 
CHECK (relationship_intensity >= 0 AND relationship_intensity <= 10)
DEFAULT 5;

-- Add index for faster queries when retrieving user preferences
CREATE INDEX idx_library_people_relationship_intensity 
ON library_people(relationship_intensity);

-- Add column comment for documentation
COMMENT ON COLUMN library_people.relationship_intensity IS 
'User relationship preference signal (0=safe/gentle, 10=spicy/direct). Controls interpretation tone and depth in readings, not astrological calculations. Default: 5 (balanced).';

-- Backfill existing rows with default value (5)
UPDATE library_people 
SET relationship_intensity = 5 
WHERE relationship_intensity IS NULL;
