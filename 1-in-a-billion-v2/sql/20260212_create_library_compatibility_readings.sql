-- Create cloud table for locally-cached compatibility previews.
-- Run this in Supabase SQL Editor for the V2 project.

CREATE TABLE IF NOT EXISTS public.library_compatibility_readings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  client_reading_id text NOT NULL,
  person1_id text NOT NULL,
  person2_id text NOT NULL,
  system text NOT NULL CHECK (system IN ('western', 'vedic', 'human_design', 'gene_keys', 'kabbalah')),
  content text NOT NULL DEFAULT '',
  spicy_score numeric(4,1) NOT NULL,
  safe_stable_score numeric(4,1) NOT NULL,
  conclusion text NOT NULL DEFAULT '',
  source text NOT NULL DEFAULT 'gpt',
  generated_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, client_reading_id)
);

CREATE INDEX IF NOT EXISTS idx_library_compatibility_readings_user_id
  ON public.library_compatibility_readings(user_id);

CREATE INDEX IF NOT EXISTS idx_library_compatibility_readings_pair
  ON public.library_compatibility_readings(user_id, person1_id, person2_id);

ALTER TABLE public.library_compatibility_readings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own compatibility readings" ON public.library_compatibility_readings;
CREATE POLICY "Users can view own compatibility readings"
  ON public.library_compatibility_readings
  FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own compatibility readings" ON public.library_compatibility_readings;
CREATE POLICY "Users can insert own compatibility readings"
  ON public.library_compatibility_readings
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own compatibility readings" ON public.library_compatibility_readings;
CREATE POLICY "Users can update own compatibility readings"
  ON public.library_compatibility_readings
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own compatibility readings" ON public.library_compatibility_readings;
CREATE POLICY "Users can delete own compatibility readings"
  ON public.library_compatibility_readings
  FOR DELETE
  USING (auth.uid() = user_id);
