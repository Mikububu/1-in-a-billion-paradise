-- ==================================================
-- VEDIC MATCHMAKING DATABASE SCHEMA
-- Vectorized Engine + Batch Matching
-- ==================================================

-- ==================================================
-- SECTION 1. CORE PEOPLE TABLE (VECTORIZED)
-- ==================================================

CREATE TABLE IF NOT EXISTS vedic_people (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  person_id TEXT NOT NULL,               -- client-side stable ID
  is_user BOOLEAN NOT NULL DEFAULT false,

  -- ===== VECTORIZED CORE =====
  moon_rashi SMALLINT NOT NULL CHECK (moon_rashi BETWEEN 0 AND 11),
  moon_nakshatra SMALLINT NOT NULL CHECK (moon_nakshatra BETWEEN 0 AND 26),

  varna SMALLINT NOT NULL CHECK (varna BETWEEN 0 AND 3),
  vashya SMALLINT NOT NULL CHECK (vashya BETWEEN 0 AND 4),
  tara SMALLINT NOT NULL CHECK (tara BETWEEN 0 AND 8),
  yoni SMALLINT NOT NULL CHECK (yoni BETWEEN 0 AND 13),
  graha_maitri SMALLINT NOT NULL CHECK (graha_maitri BETWEEN 0 AND 4),
  gana SMALLINT NOT NULL CHECK (gana BETWEEN 0 AND 2),
  bhakoot SMALLINT NOT NULL CHECK (bhakoot BETWEEN 0 AND 11),
  nadi SMALLINT NOT NULL CHECK (nadi BETWEEN 0 AND 2),

  -- ===== DOSHA / OVERLAY =====
  mars_house SMALLINT NOT NULL CHECK (mars_house BETWEEN 1 AND 12),
  seventh_house_strength SMALLINT NOT NULL CHECK (seventh_house_strength BETWEEN 0 AND 3),

  dasha_lord SMALLINT NOT NULL CHECK (dasha_lord BETWEEN 0 AND 8),
  dasha_balance_months INTEGER NOT NULL CHECK (dasha_balance_months >= 0),

  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- ==================================================
-- SECTION 2. HARD UNIQUENESS GUARANTEES
-- ==================================================

-- Only ONE self profile per user
CREATE UNIQUE INDEX IF NOT EXISTS uniq_user_self_profile
ON vedic_people(user_id)
WHERE is_user = true;

-- Partner uniqueness per user
CREATE UNIQUE INDEX IF NOT EXISTS uniq_user_partner
ON vedic_people(user_id, person_id)
WHERE is_user = false;

-- ==================================================
-- SECTION 3. MATCH RESULTS (OPTIONAL CACHE)
-- ==================================================

CREATE TABLE IF NOT EXISTS vedic_matches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  person_a TEXT NOT NULL,
  person_b TEXT NOT NULL,

  guna_total SMALLINT NOT NULL CHECK (guna_total BETWEEN 0 AND 36),
  classification TEXT NOT NULL,

  nadi_dosha BOOLEAN NOT NULL,
  bhakoot_dosha BOOLEAN NOT NULL,
  manglik_dosha BOOLEAN NOT NULL,

  dasha_sync SMALLINT NOT NULL CHECK (dasha_sync BETWEEN 0 AND 3),

  breakdown JSONB NOT NULL,

  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_matches_user ON vedic_matches(user_id);
CREATE INDEX IF NOT EXISTS idx_matches_score ON vedic_matches(guna_total DESC);

-- ==================================================
-- SECTION 4. BATCH MATCH JOBS
-- ==================================================

CREATE TABLE IF NOT EXISTS vedic_match_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  job_type TEXT NOT NULL CHECK (
    job_type IN ('one_to_many','many_to_many','search')
  ),

  status TEXT NOT NULL DEFAULT 'queued' CHECK (
    status IN ('queued','processing','complete','failed','cancelled')
  ),

  filters JSONB,
  progress INTEGER DEFAULT 0 CHECK (progress BETWEEN 0 AND 100),
  error TEXT,

  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  completed_at TIMESTAMPTZ
);

-- Auto-update updated_at for jobs
CREATE OR REPLACE FUNCTION update_vedic_jobs_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_update_vedic_jobs_timestamp
  BEFORE UPDATE ON vedic_match_jobs
  FOR EACH ROW
  EXECUTE FUNCTION update_vedic_jobs_timestamp();


-- ==================================================
-- SECTION 5. JOB ARTIFACTS
-- ==================================================

CREATE TABLE IF NOT EXISTS vedic_job_artifacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID NOT NULL REFERENCES vedic_match_jobs(id) ON DELETE CASCADE,

  artifact_type TEXT NOT NULL CHECK (
    artifact_type IN ('json','pdf','audio')
  ),

  storage_path TEXT NOT NULL,
  metadata JSONB,

  created_at TIMESTAMPTZ DEFAULT now()
);

-- ==================================================
-- SECTION 6. WIPE USER COMPLETELY (GDPR)
-- ==================================================

-- ONE CALL wipes EVERYTHING
CREATE OR REPLACE FUNCTION purge_user_everywhere(target_user UUID)
RETURNS VOID
LANGUAGE plpgsql
AS $$
BEGIN
  DELETE FROM vedic_job_artifacts WHERE job_id IN (
    SELECT id FROM vedic_match_jobs WHERE user_id = target_user
  );

  DELETE FROM vedic_match_jobs WHERE user_id = target_user;
  DELETE FROM vedic_matches WHERE user_id = target_user;
  DELETE FROM vedic_people WHERE user_id = target_user;

  DELETE FROM auth.users WHERE id = target_user;
END;
$$;

-- ==================================================
-- SECTION 7. SECURITY (RLS)
-- ==================================================

ALTER TABLE vedic_people ENABLE ROW LEVEL SECURITY;
ALTER TABLE vedic_matches ENABLE ROW LEVEL SECURITY;
ALTER TABLE vedic_match_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE vedic_job_artifacts ENABLE ROW LEVEL SECURITY;

DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'user_isolation_people') THEN
    CREATE POLICY user_isolation_people ON vedic_people USING (auth.uid() = user_id);
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'user_isolation_matches') THEN
    CREATE POLICY user_isolation_matches ON vedic_matches USING (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'user_isolation_jobs') THEN
    CREATE POLICY user_isolation_jobs ON vedic_match_jobs USING (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'user_isolation_artifacts') THEN
    CREATE POLICY user_isolation_artifacts ON vedic_job_artifacts USING (
      job_id IN (
        SELECT id FROM vedic_match_jobs WHERE user_id = auth.uid()
      )
    );
  END IF;
END $$;
