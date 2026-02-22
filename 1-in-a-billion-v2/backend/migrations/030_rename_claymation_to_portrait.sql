-- Migration: Rename claymation to portrait throughout database
-- This updates all references from "claymation" to "portrait" for clarity
-- Run this in Supabase SQL Editor

-- 1. Rename columns in library_people table
ALTER TABLE library_people 
  RENAME COLUMN claymation_url TO portrait_url;

-- 2. Rename couple_claymations table to couple_portraits
ALTER TABLE couple_claymations RENAME TO couple_portraits;

-- 3. Update indexes (they should auto-rename, but let's be explicit)
DROP INDEX IF EXISTS idx_couple_claymations_user_id;
DROP INDEX IF EXISTS idx_couple_claymations_persons;
CREATE INDEX IF NOT EXISTS idx_couple_portraits_user_id ON couple_portraits(user_id);
CREATE INDEX IF NOT EXISTS idx_couple_portraits_persons ON couple_portraits(person1_id, person2_id);

-- 4. Verify the changes
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'library_people' 
  AND column_name IN ('original_photo_url', 'portrait_url');

SELECT table_name 
FROM information_schema.tables 
WHERE table_name = 'couple_portraits';

-- 5. Show sample data to confirm
SELECT id, user_id, person1_id, person2_id, couple_image_url 
FROM couple_portraits 
LIMIT 5;
