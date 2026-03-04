-- supabase/migrations/20260304122700_add_language_to_people.sql
-- Add language tracking fields to library_people

ALTER TABLE public.library_people
ADD COLUMN IF NOT EXISTS primary_language VARCHAR(10),
ADD COLUMN IF NOT EXISTS hook_language_recorded VARCHAR(10);

-- Update the RLS policies to allow the user to manage these fields (if needed, but usually existing update policies cover newly added columns).
