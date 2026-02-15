-- Mirror of migrations/023_people_scaling_job_and_match_profile.sql
-- Kept under supabase/migrations so `supabase db push` can apply it (when used).

BEGIN;

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

ALTER TABLE library_people
  ADD COLUMN IF NOT EXISTS match_profile jsonb,
  ADD COLUMN IF NOT EXISTS match_profile_updated_at timestamptz;

COMMIT;

