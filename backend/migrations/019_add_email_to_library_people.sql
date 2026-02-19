-- Add email column to library_people for easier admin queries
-- This syncs the email from Supabase Auth to the profile table

ALTER TABLE library_people 
ADD COLUMN IF NOT EXISTS email TEXT;

-- Create index for email lookups
CREATE INDEX IF NOT EXISTS idx_library_people_email ON library_people(email);

-- Backfill existing users with their emails from auth.users
UPDATE library_people lp
SET email = au.email
FROM auth.users au
WHERE lp.user_id = au.id
  AND lp.is_user = true
  AND lp.email IS NULL;

COMMENT ON COLUMN library_people.email IS 'User email synced from Supabase Auth for admin convenience';
