-- People scaling / matching index support
-- - Adds job_type: people_scaling
-- - Adds task_type: people_scaling
-- - Adds library_people.match_profile + timestamp for index refresh

BEGIN;

-- 1) Extend enums (safe if already applied)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_enum e
    JOIN pg_type t ON t.oid = e.enumtypid
    WHERE t.typname = 'job_type' AND e.enumlabel = 'people_scaling'
  ) THEN
    ALTER TYPE job_type ADD VALUE 'people_scaling';
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_enum e
    JOIN pg_type t ON t.oid = e.enumtypid
    WHERE t.typname = 'task_type' AND e.enumlabel = 'people_scaling'
  ) THEN
    ALTER TYPE task_type ADD VALUE 'people_scaling';
  END IF;
END $$;

-- 2) Storage columns on library_people
ALTER TABLE library_people
  ADD COLUMN IF NOT EXISTS match_profile jsonb,
  ADD COLUMN IF NOT EXISTS match_profile_updated_at timestamptz;

COMMIT;

