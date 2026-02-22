-- Migration: Protect portrait URLs from being overwritten with NULL
-- 
-- ROOT CAUSE: Frontend sync (peopleCloud.ts) was sending portrait_url: null
-- when local state didn't have the URL, which overwrote valid server values.
--
-- FIX: This trigger prevents portrait_url and original_photo_url from being
-- set to NULL if they already have a value. This is a server-side protection
-- that works regardless of which client tries to modify the data.
--
-- RUN THIS IN SUPABASE DASHBOARD → SQL Editor

-- Create the protection function
CREATE OR REPLACE FUNCTION protect_portrait_urls()
RETURNS TRIGGER AS $$
BEGIN
  -- If portrait_url is being set to NULL but old value exists, keep the old value
  IF NEW.portrait_url IS NULL AND OLD.portrait_url IS NOT NULL THEN
    NEW.portrait_url := OLD.portrait_url;
  END IF;
  
  -- Same for original_photo_url
  IF NEW.original_photo_url IS NULL AND OLD.original_photo_url IS NOT NULL THEN
    NEW.original_photo_url := OLD.original_photo_url;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create the trigger (drop first if exists)
DROP TRIGGER IF EXISTS protect_portrait_urls_trigger ON library_people;
CREATE TRIGGER protect_portrait_urls_trigger
BEFORE UPDATE ON library_people
FOR EACH ROW
EXECUTE FUNCTION protect_portrait_urls();

-- Verify trigger exists
SELECT tgname, tgrelid::regclass, tgfoid::regproc
FROM pg_trigger
WHERE tgname = 'protect_portrait_urls_trigger';
