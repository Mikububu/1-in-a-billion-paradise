-- Migration: Add photo and claymation fields to library_people
-- Run this in Supabase SQL Editor

-- Add photo fields to library_people table
ALTER TABLE library_people 
ADD COLUMN IF NOT EXISTS original_photo_url text,
ADD COLUMN IF NOT EXISTS claymation_url text;

-- Create couple_claymations table
CREATE TABLE IF NOT EXISTS couple_claymations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  person1_id text NOT NULL,  -- client_person_id from library_people
  person2_id text NOT NULL,  -- client_person_id from library_people
  couple_image_url text NOT NULL,
  person1_solo_url text,     -- Reference for regeneration trigger
  person2_solo_url text,     -- Reference for regeneration trigger
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL,
  UNIQUE(user_id, person1_id, person2_id)
);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_couple_claymations_user_id ON couple_claymations(user_id);
CREATE INDEX IF NOT EXISTS idx_couple_claymations_persons ON couple_claymations(person1_id, person2_id);

-- Add RLS policies for couple_claymations
ALTER TABLE couple_claymations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own couple images"
  ON couple_claymations FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own couple images"
  ON couple_claymations FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own couple images"
  ON couple_claymations FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own couple images"
  ON couple_claymations FOR DELETE
  USING (auth.uid() = user_id);

-- Verify the changes
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'library_people' 
  AND column_name IN ('original_photo_url', 'claymation_url');

SELECT * FROM information_schema.tables WHERE table_name = 'couple_claymations';
