-- ═══════════════════════════════════════════════════════════════════════════
-- CLAYMATION PORTRAIT URL
-- ═══════════════════════════════════════════════════════════════════════════
-- Add claymation_url column to library_people table
-- This stores the URL of the AI-generated claymation portrait for each person
-- Used for privacy-preserving profile images in the matching system

BEGIN;

-- Add claymation_url to library_people
ALTER TABLE library_people ADD COLUMN IF NOT EXISTS claymation_url TEXT;

-- Create storage bucket for profile images (if not exists)
-- Note: This needs to be done via Supabase dashboard or separate script

COMMENT ON COLUMN library_people.claymation_url IS 'URL to the AI-generated claymation portrait image (OpenAI DALL-E 3)';

COMMIT;
