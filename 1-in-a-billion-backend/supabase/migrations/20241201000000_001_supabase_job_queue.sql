-- ═══════════════════════════════════════════════════════════════════════════
-- SUPABASE JOB QUEUE - PRODUCTION-READY DISTRIBUTED SYSTEM
-- ═══════════════════════════════════════════════════════════════════════════
-- 
-- This migration creates a horizontally scalable job queue system that can
-- handle 1 → 1,000,000 clients with stateless RunPod workers.
--
-- Features:
-- - Distributed task claiming with FOR UPDATE SKIP LOCKED
-- - Storage bucket references (no base64 in DB)
-- - RLS policies for user access control
-- - Worker concurrency control
-- - Automatic cleanup of stale tasks
--
-- Run this in Supabase SQL Editor or via migrations
-- ═══════════════════════════════════════════════════════════════════════════

BEGIN;

-- ───────────────────────────────────────────────────────────────────────────
-- ENUMS
-- ───────────────────────────────────────────────────────────────────────────

CREATE TYPE job_status AS ENUM ('queued', 'processing', 'complete', 'error', 'cancelled');
CREATE TYPE job_type AS ENUM ('extended', 'synastry', 'nuclear', 'nuclear_v2');
CREATE TYPE job_phase AS ENUM ('queued', 'calculating', 'text', 'pdf', 'audio', 'finalizing', 'complete', 'error');

CREATE TYPE task_status AS ENUM ('pending', 'claimed', 'processing', 'complete', 'failed');
CREATE TYPE task_type AS ENUM ('text_generation', 'pdf_generation', 'audio_generation', 'synastry_calc');

CREATE TYPE artifact_type AS ENUM ('audio_mp3', 'audio_m4a', 'pdf', 'json', 'text');

-- ───────────────────────────────────────────────────────────────────────────
-- CORE TABLES
-- ───────────────────────────────────────────────────────────────────────────

-- Jobs table: One row per user request (Nuclear Package, Synastry, etc.)
CREATE TABLE jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- Job metadata
  type job_type NOT NULL,
  status job_status NOT NULL DEFAULT 'queued',
  
  -- Progress tracking
  progress JSONB NOT NULL DEFAULT jsonb_build_object(
    'percent', 0,
    'phase', 'queued',
    'systemsCompleted', 0,
    'totalSystems', 0,
    'message', 'Job queued...'
  ),
  
  -- Input parameters (birth data, systems, etc.)
  params JSONB NOT NULL,
  
  -- Retry tracking
  attempts INTEGER NOT NULL DEFAULT 0,
  max_attempts INTEGER NOT NULL DEFAULT 3,
  
  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ,
  
  -- Error tracking
  error TEXT,
  
  -- Indexes for fast queries
  CONSTRAINT jobs_attempts_check CHECK (attempts >= 0 AND attempts <= max_attempts)
);

-- Tasks table: Granular work units that workers claim and process
CREATE TABLE job_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  
  -- Task metadata
  task_type task_type NOT NULL,
  status task_status NOT NULL DEFAULT 'pending',
  
  -- Execution order (0, 1, 2, ...)
  sequence INTEGER NOT NULL,
  
  -- Task input (chapter text, document ID, etc.)
  input JSONB NOT NULL,
  
  -- Task output (text, artifact IDs, metadata)
  output JSONB,
  
  -- Worker tracking
  worker_id TEXT,
  claimed_at TIMESTAMPTZ,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  
  -- Retry tracking
  attempts INTEGER NOT NULL DEFAULT 0,
  max_attempts INTEGER NOT NULL DEFAULT 3,
  
  -- Heartbeat for stale task detection
  last_heartbeat TIMESTAMPTZ,
  heartbeat_timeout_seconds INTEGER NOT NULL DEFAULT 600, -- 10 minutes
  
  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  
  -- Error tracking
  error TEXT,
  
  -- Constraints
  CONSTRAINT job_tasks_attempts_check CHECK (attempts >= 0 AND attempts <= max_attempts),
  CONSTRAINT job_tasks_sequence_check CHECK (sequence >= 0)
);

-- Artifacts table: References to Storage bucket files (MP3, PDF, JSON)
CREATE TABLE job_artifacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  task_id UUID REFERENCES job_tasks(id) ON DELETE SET NULL,
  
  -- Artifact metadata
  artifact_type artifact_type NOT NULL,
  
  -- Storage bucket path (e.g., 'jobs/{job_id}/audio/{doc_id}.mp3')
  storage_path TEXT NOT NULL,
  bucket_name TEXT NOT NULL DEFAULT 'job-artifacts',
  
  -- Public URL (signed or public depending on bucket policy)
  public_url TEXT,
  
  -- Metadata
  content_type TEXT,
  file_size_bytes BIGINT,
  duration_seconds NUMERIC(10, 2), -- For audio/video
  
  -- Optional: Inline metadata for quick access (e.g., word count, page count)
  metadata JSONB,
  
  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  
  -- Constraints
  CONSTRAINT job_artifacts_file_size_check CHECK (file_size_bytes >= 0)
);

-- ───────────────────────────────────────────────────────────────────────────
-- INDEXES (Critical for Performance at Scale)
-- ───────────────────────────────────────────────────────────────────────────

-- Jobs indexes
CREATE INDEX idx_jobs_user_id ON jobs(user_id);
CREATE INDEX idx_jobs_status ON jobs(status);
CREATE INDEX idx_jobs_created_at ON jobs(created_at DESC);
CREATE INDEX idx_jobs_user_status ON jobs(user_id, status, created_at DESC); -- Composite for user's active jobs

-- Tasks indexes
CREATE INDEX idx_job_tasks_job_id ON job_tasks(job_id);
CREATE INDEX idx_job_tasks_status ON job_tasks(status);
CREATE INDEX idx_job_tasks_worker_id ON job_tasks(worker_id) WHERE worker_id IS NOT NULL;
CREATE INDEX idx_job_tasks_claim_queue ON job_tasks(status, sequence) WHERE status = 'pending'; -- Hot path for claim_tasks

-- Stale task detection (for watchdog cleanup)
CREATE INDEX idx_job_tasks_stale ON job_tasks(status, last_heartbeat) 
  WHERE status IN ('claimed', 'processing');

-- Artifacts indexes
CREATE INDEX idx_job_artifacts_job_id ON job_artifacts(job_id);
CREATE INDEX idx_job_artifacts_task_id ON job_artifacts(task_id) WHERE task_id IS NOT NULL;
CREATE INDEX idx_job_artifacts_storage_path ON job_artifacts(storage_path); -- For deduplication

-- Idempotency: prevent duplicate artifacts for the same task/type (critical for retries)
CREATE UNIQUE INDEX uq_job_artifacts_job_task_type
  ON job_artifacts(job_id, task_id, artifact_type)
  WHERE task_id IS NOT NULL;

-- ───────────────────────────────────────────────────────────────────────────
-- FUNCTIONS - RPC for Safe Concurrency
-- ───────────────────────────────────────────────────────────────────────────

-- Claim tasks for processing (called by workers)
CREATE OR REPLACE FUNCTION claim_tasks(
  p_worker_id TEXT,
  p_max_tasks INTEGER DEFAULT 1,
  p_task_types task_type[] DEFAULT NULL
)
RETURNS SETOF job_tasks
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  UPDATE job_tasks
  SET 
    status = 'claimed',
    worker_id = p_worker_id,
    claimed_at = now(),
    last_heartbeat = now(),
    updated_at = now()
  WHERE id IN (
    SELECT id
    FROM job_tasks
    WHERE status = 'pending'
      AND attempts < max_attempts
      AND (p_task_types IS NULL OR task_type = ANY(p_task_types))
    ORDER BY sequence ASC
    LIMIT p_max_tasks
    FOR UPDATE SKIP LOCKED -- Critical: prevents lock contention
  )
  RETURNING *;
END;
$$;

-- Heartbeat to keep task alive (prevents stale detection)
CREATE OR REPLACE FUNCTION heartbeat_task(
  p_task_id UUID,
  p_worker_id TEXT
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_updated BOOLEAN;
BEGIN
  UPDATE job_tasks
  SET 
    last_heartbeat = now(),
    updated_at = now()
  WHERE id = p_task_id
    AND worker_id = p_worker_id
    AND status IN ('claimed', 'processing');
  
  GET DIAGNOSTICS v_updated = ROW_COUNT;
  RETURN v_updated > 0;
END;
$$;

-- Mark task as complete
CREATE OR REPLACE FUNCTION complete_task(
  p_task_id UUID,
  p_worker_id TEXT,
  p_output JSONB DEFAULT NULL
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_updated BOOLEAN;
BEGIN
  UPDATE job_tasks
  SET 
    status = 'complete',
    output = COALESCE(p_output, output),
    completed_at = now(),
    updated_at = now()
  WHERE id = p_task_id
    AND worker_id = p_worker_id
    AND status IN ('claimed', 'processing');
  
  GET DIAGNOSTICS v_updated = ROW_COUNT;
  RETURN v_updated > 0;
END;
$$;

-- Mark task as failed (retry if attempts < max)
CREATE OR REPLACE FUNCTION fail_task(
  p_task_id UUID,
  p_worker_id TEXT,
  p_error TEXT
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_task job_tasks;
  v_updated BOOLEAN;
BEGIN
  -- Get current task state
  SELECT * INTO v_task
  FROM job_tasks
  WHERE id = p_task_id
    AND worker_id = p_worker_id
  FOR UPDATE;
  
  IF v_task IS NULL THEN
    RETURN FALSE;
  END IF;
  
  -- Increment attempts
  UPDATE job_tasks
  SET 
    attempts = attempts + 1,
    error = p_error,
    status = CASE 
      WHEN attempts + 1 >= max_attempts THEN 'failed'::task_status
      ELSE 'pending'::task_status -- Retry
    END,
    worker_id = NULL, -- Release worker
    claimed_at = NULL,
    updated_at = now()
  WHERE id = p_task_id;
  
  GET DIAGNOSTICS v_updated = ROW_COUNT;
  RETURN v_updated > 0;
END;
$$;

-- Reclaim stale tasks (called by watchdog/cron)
CREATE OR REPLACE FUNCTION reclaim_stale_tasks()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_reclaimed INTEGER := 0;
BEGIN
  -- Reset stale tasks to pending
  UPDATE job_tasks
  SET 
    status = 'pending',
    worker_id = NULL,
    claimed_at = NULL,
    last_heartbeat = NULL,
    attempts = attempts + 1,
    updated_at = now(),
    error = 'Task stalled - reclaimed by watchdog'
  WHERE status IN ('claimed', 'processing')
    AND last_heartbeat < (now() - (heartbeat_timeout_seconds || ' seconds')::INTERVAL)
    AND attempts < max_attempts;
  
  GET DIAGNOSTICS v_reclaimed = ROW_COUNT;
  
  -- Mark as failed if max attempts reached
  UPDATE job_tasks
  SET 
    status = 'failed',
    updated_at = now(),
    error = 'Task stalled - max attempts exceeded'
  WHERE status IN ('claimed', 'processing')
    AND last_heartbeat < (now() - (heartbeat_timeout_seconds || ' seconds')::INTERVAL)
    AND attempts >= max_attempts;
  
  RETURN v_reclaimed;
END;
$$;

-- Update job progress (called by workers)
CREATE OR REPLACE FUNCTION update_job_progress(
  p_job_id UUID,
  p_progress JSONB
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_updated BOOLEAN;
BEGIN
  UPDATE jobs
  SET 
    progress = progress || p_progress, -- Merge with existing
    updated_at = now()
  WHERE id = p_job_id;
  
  GET DIAGNOSTICS v_updated = ROW_COUNT;
  RETURN v_updated > 0;
END;
$$;

-- ───────────────────────────────────────────────────────────────────────────
-- TRIGGERS - Automatic Updates
-- ───────────────────────────────────────────────────────────────────────────

-- Auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_jobs_updated_at 
  BEFORE UPDATE ON jobs
  FOR EACH ROW 
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_job_tasks_updated_at 
  BEFORE UPDATE ON job_tasks
  FOR EACH ROW 
  EXECUTE FUNCTION update_updated_at_column();

-- Auto-compute job status based on tasks
CREATE OR REPLACE FUNCTION auto_update_job_status()
RETURNS TRIGGER AS $$
DECLARE
  v_pending INTEGER;
  v_complete INTEGER;
  v_failed INTEGER;
  v_total INTEGER;
BEGIN
  -- Count task statuses for this job
  SELECT 
    COUNT(*) FILTER (WHERE status = 'pending') AS pending,
    COUNT(*) FILTER (WHERE status = 'complete') AS complete,
    COUNT(*) FILTER (WHERE status = 'failed') AS failed,
    COUNT(*) AS total
  INTO v_pending, v_complete, v_failed, v_total
  FROM job_tasks
  WHERE job_id = COALESCE(NEW.job_id, OLD.job_id);
  
  -- Update job status
  IF v_failed > 0 AND v_complete + v_failed = v_total THEN
    -- All tasks done, at least one failed
    UPDATE jobs
    SET 
      status = 'error',
      progress = progress || jsonb_build_object(
        'phase', 'error',
        'message', 'Some tasks failed'
      ),
      completed_at = now()
    WHERE id = COALESCE(NEW.job_id, OLD.job_id);
    
  ELSIF v_complete = v_total THEN
    -- All tasks complete
    UPDATE jobs
    SET 
      status = 'complete',
      progress = progress || jsonb_build_object(
        'percent', 100,
        'phase', 'complete',
        'message', 'Generation complete!'
      ),
      completed_at = now()
    WHERE id = COALESCE(NEW.job_id, OLD.job_id);
    
  ELSIF v_complete > 0 OR v_pending < v_total THEN
    -- At least one task in progress
    UPDATE jobs
    SET 
      status = 'processing',
      progress = progress || jsonb_build_object(
        'percent', ROUND((v_complete::NUMERIC / NULLIF(v_total, 0)) * 100, 2)
      )
    WHERE id = COALESCE(NEW.job_id, OLD.job_id)
      AND status != 'processing';
  END IF;
  
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER auto_update_job_status_on_task_change
  AFTER INSERT OR UPDATE OR DELETE ON job_tasks
  FOR EACH ROW
  EXECUTE FUNCTION auto_update_job_status();

-- ───────────────────────────────────────────────────────────────────────────
-- ROW LEVEL SECURITY (RLS)
-- ───────────────────────────────────────────────────────────────────────────

ALTER TABLE jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE job_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE job_artifacts ENABLE ROW LEVEL SECURITY;

-- Jobs: Users can only see their own jobs
CREATE POLICY "Users can view their own jobs"
  ON jobs FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own jobs"
  ON jobs FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Service role can do everything on jobs"
  ON jobs FOR ALL
  USING (auth.jwt()->>'role' = 'service_role');

-- Tasks: Users can see tasks for their jobs, workers (service role) can claim/update
CREATE POLICY "Users can view tasks for their jobs"
  ON job_tasks FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM jobs 
      WHERE jobs.id = job_tasks.job_id 
        AND jobs.user_id = auth.uid()
    )
  );

CREATE POLICY "Service role can do everything on tasks"
  ON job_tasks FOR ALL
  USING (auth.jwt()->>'role' = 'service_role');

-- Artifacts: Users can see artifacts for their jobs
CREATE POLICY "Users can view artifacts for their jobs"
  ON job_artifacts FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM jobs 
      WHERE jobs.id = job_artifacts.job_id 
        AND jobs.user_id = auth.uid()
    )
  );

CREATE POLICY "Service role can do everything on artifacts"
  ON job_artifacts FOR ALL
  USING (auth.jwt()->>'role' = 'service_role');

-- ───────────────────────────────────────────────────────────────────────────
-- STORAGE BUCKET (Run in Supabase Dashboard → Storage)
-- ───────────────────────────────────────────────────────────────────────────

-- This must be run separately in the Supabase Dashboard or via Storage API
-- CREATE BUCKET job-artifacts WITH public = false;

-- Storage RLS Policy (for authenticated users to read their own artifacts)
-- CREATE POLICY "Users can read their own job artifacts"
--   ON storage.objects FOR SELECT
--   USING (
--     bucket_id = 'job-artifacts'
--     AND (storage.foldername(name))[1] = auth.uid()::text
--   );

-- CREATE POLICY "Service role can manage all artifacts"
--   ON storage.objects FOR ALL
--   USING (
--     bucket_id = 'job-artifacts'
--     AND auth.jwt()->>'role' = 'service_role'
--   );


-- ───────────────────────────────────────────────────────────────────────────
-- SECURITY HARDENING (CRITICAL)
-- ───────────────────────────────────────────────────────────────────────────
-- SECURITY DEFINER functions must NOT be executable by anon/authenticated.
-- Lock these RPCs to service_role only and set a safe search_path.

-- Safe search_path for SECURITY DEFINER functions
ALTER FUNCTION claim_tasks(TEXT, INTEGER, task_type[]) SET search_path = public;
ALTER FUNCTION heartbeat_task(UUID, TEXT) SET search_path = public;
ALTER FUNCTION complete_task(UUID, TEXT, JSONB) SET search_path = public;
ALTER FUNCTION fail_task(UUID, TEXT, TEXT) SET search_path = public;
ALTER FUNCTION reclaim_stale_tasks() SET search_path = public;
ALTER FUNCTION update_job_progress(UUID, JSONB) SET search_path = public;

-- Revoke from PUBLIC (includes anon/authenticated) and grant to service_role
REVOKE ALL ON FUNCTION claim_tasks(TEXT, INTEGER, task_type[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION claim_tasks(TEXT, INTEGER, task_type[]) TO service_role;

REVOKE ALL ON FUNCTION heartbeat_task(UUID, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION heartbeat_task(UUID, TEXT) TO service_role;

REVOKE ALL ON FUNCTION complete_task(UUID, TEXT, JSONB) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION complete_task(UUID, TEXT, JSONB) TO service_role;

REVOKE ALL ON FUNCTION fail_task(UUID, TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION fail_task(UUID, TEXT, TEXT) TO service_role;

REVOKE ALL ON FUNCTION reclaim_stale_tasks() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION reclaim_stale_tasks() TO service_role;

REVOKE ALL ON FUNCTION update_job_progress(UUID, JSONB) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION update_job_progress(UUID, JSONB) TO service_role;

COMMIT;

-- ═══════════════════════════════════════════════════════════════════════════
-- USAGE EXAMPLES
-- ═══════════════════════════════════════════════════════════════════════════

-- 1. Create a job (from API)
-- INSERT INTO jobs (user_id, type, params)
-- VALUES (auth.uid(), 'nuclear_v2', '{"person1": {...}, "systems": [...]}')
-- RETURNING id;

-- 2. Enqueue tasks for the job
-- INSERT INTO job_tasks (job_id, task_type, sequence, input)
-- VALUES 
--   (job_id, 'text_generation', 0, '{"chapter": "Portraits", "system": "vedic"}'),
--   (job_id, 'pdf_generation', 1, '{"text_task_id": ...}'),
--   (job_id, 'audio_generation', 2, '{"pdf_task_id": ...}');

-- 3. Worker claims tasks
-- SELECT * FROM claim_tasks('worker-abc-123', 5, ARRAY['text_generation', 'audio_generation']);

-- 4. Worker updates heartbeat
-- SELECT heartbeat_task('task-uuid', 'worker-abc-123');

-- 5. Worker completes task
-- SELECT complete_task('task-uuid', 'worker-abc-123', '{"text": "...", "wordCount": 6000}');

-- 6. Worker creates artifact
-- INSERT INTO job_artifacts (job_id, task_id, artifact_type, storage_path, public_url)
-- VALUES (job_id, task_id, 'audio_mp3', 'jobs/{job_id}/audio/chapter1.mp3', 'https://...');

-- 7. Watchdog reclaims stale tasks (cron job)
-- SELECT reclaim_stale_tasks();

-- ═══════════════════════════════════════════════════════════════════════════
-- END OF MIGRATION
-- ═══════════════════════════════════════════════════════════════════════════


