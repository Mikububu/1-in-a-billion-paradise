-- Migration: Rename claymation to portrait throughout database
-- This updates all references from "claymation" to "portrait" for clarity
-- Run this in Supabase SQL Editor

-- 1. Drop old RLS policies first (they prevent table rename)
DROP POLICY IF EXISTS "Users can view their own couple images" ON couple_claymations;
DROP POLICY IF EXISTS "Users can insert their own couple images" ON couple_claymations;
DROP POLICY IF EXISTS "Users can update their own couple images" ON couple_claymations;
DROP POLICY IF EXISTS "Users can delete their own couple images" ON couple_claymations;

-- 2. Rename columns in library_people table
ALTER TABLE library_people 
  RENAME COLUMN claymation_url TO portrait_url;

-- 3. Rename couple_claymations table to couple_portraits
ALTER TABLE couple_claymations RENAME TO couple_portraits;

-- 4. Update indexes
DROP INDEX IF EXISTS idx_couple_claymations_user_id;
DROP INDEX IF EXISTS idx_couple_claymations_persons;
CREATE INDEX IF NOT EXISTS idx_couple_portraits_user_id ON couple_portraits(user_id);
CREATE INDEX IF NOT EXISTS idx_couple_portraits_persons ON couple_portraits(person1_id, person2_id);

-- 5. Recreate RLS policies with new table name
CREATE POLICY "Users can view their own couple images"
  ON couple_portraits FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own couple images"
  ON couple_portraits FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own couple images"
  ON couple_portraits FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own couple images"
  ON couple_portraits FOR DELETE
  USING (auth.uid() = user_id);

-- 6. Verify the changes
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'library_people' 
  AND column_name IN ('original_photo_url', 'portrait_url');

SELECT table_name 
FROM information_schema.tables 
WHERE table_name = 'couple_portraits';

-- 7. Show sample data to confirm
SELECT id, user_id, person1_id, person2_id, couple_image_url 
FROM couple_portraits 
LIMIT 5;
