-- ═══════════════════════════════════════════════════════════════════════════
-- MIGRATION 006: AUDIOBOOK QUEUE SYSTEM
-- ═══════════════════════════════════════════════════════════════════════════
-- 
-- Creates persistent queue-based architecture for audiobook generation
-- Replaces serverless /runsync approach which fails at scale
--
-- Architecture:
-- 1. Users create audiobook_jobs (metadata only, no GPU work)
-- 2. Jobs are split into audiobook_chapters (atomic processing units)
-- 3. Chapters wait in queue until GPU workers pull them
-- 4. Workers process 1 chapter at a time, update status
-- 5. Job completes when all chapters done
--
-- This decouples user concurrency from GPU concurrency, allowing thousands
-- of users to queue jobs while only N GPUs process them in parallel.
--
-- Date: December 27, 2025
-- ═══════════════════════════════════════════════════════════════════════════

BEGIN;

-- ───────────────────────────────────────────────────────────────────────────
-- STEP 1: Create audiobook_jobs table (main job record)
-- ───────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS audiobook_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- Job metadata
  status TEXT NOT NULL DEFAULT 'QUEUED' CHECK (status IN ('QUEUED', 'PROCESSING', 'COMPLETED', 'FAILED', 'CANCELLED')),
  priority INTEGER NOT NULL DEFAULT 0, -- Higher = processed first
  
  -- Progress tracking
  total_chapters INTEGER NOT NULL DEFAULT 0,
  completed_chapters INTEGER NOT NULL DEFAULT 0,
  
  -- Job info
  text_length INTEGER, -- Total characters across all chapters
  estimated_duration_seconds INTEGER, -- Estimated audio duration
  
  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  started_at TIMESTAMPTZ, -- When first chapter started processing
  completed_at TIMESTAMPTZ, -- When all chapters completed
  
  -- Error handling
  error TEXT, -- Error message if job failed
  
  -- Output
  output_manifest JSONB, -- Metadata: {audio_urls: [...], total_duration: ..., format: 'mp3'|'m4a'}
  
  -- Indexes for performance
  CONSTRAINT valid_chapter_count CHECK (completed_chapters <= total_chapters)
);

CREATE INDEX idx_audiobook_jobs_user_id ON audiobook_jobs(user_id);
CREATE INDEX idx_audiobook_jobs_status ON audiobook_jobs(status);
CREATE INDEX idx_audiobook_jobs_priority ON audiobook_jobs(priority DESC, created_at ASC);
CREATE INDEX idx_audiobook_jobs_created_at ON audiobook_jobs(created_at DESC);

-- ───────────────────────────────────────────────────────────────────────────
-- STEP 2: Create audiobook_chapters table (individual processing units)
-- ───────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS audiobook_chapters (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID NOT NULL REFERENCES audiobook_jobs(id) ON DELETE CASCADE,
  
  -- Chapter metadata
  chapter_index INTEGER NOT NULL, -- 0-based index (0, 1, 2, ...)
  title TEXT, -- Chapter title for display
  
  -- Status
  status TEXT NOT NULL DEFAULT 'QUEUED' CHECK (status IN ('QUEUED', 'PROCESSING', 'COMPLETED', 'FAILED')),
  
  -- Input data
  text TEXT NOT NULL, -- Full text to generate audio for
  
  -- Output
  audio_url TEXT, -- URL to generated audio file in storage
  audio_format TEXT CHECK (audio_format IN ('mp3', 'm4a')),
  duration_seconds INTEGER, -- Actual audio duration
  
  -- Timestamps
  started_at TIMESTAMPTZ, -- When worker started processing
  completed_at TIMESTAMPTZ, -- When audio generation finished
  
  -- Error handling
  error TEXT, -- Error message if chapter failed
  retry_count INTEGER NOT NULL DEFAULT 0, -- Number of retry attempts
  
  -- Worker tracking (for debugging/monitoring)
  worker_id TEXT, -- ID of worker processing this chapter
  
  -- Ensure unique chapter index per job
  UNIQUE(job_id, chapter_index)
);

CREATE INDEX idx_audiobook_chapters_job_id ON audiobook_chapters(job_id);
CREATE INDEX idx_audiobook_chapters_status ON audiobook_chapters(status);
-- Index for efficient queue queries (joined with jobs for priority ordering)
CREATE INDEX idx_audiobook_chapters_queue ON audiobook_chapters(status, chapter_index) WHERE status = 'QUEUED';

-- ───────────────────────────────────────────────────────────────────────────
-- STEP 3: Function to update job status when chapters complete
-- ───────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION update_audiobook_job_progress()
RETURNS TRIGGER AS $$
DECLARE
  v_job_id UUID;
  v_total_chapters INTEGER;
  v_completed_chapters INTEGER;
  v_failed_chapters INTEGER;
BEGIN
  v_job_id := NEW.job_id;
  
  -- Get chapter counts
  SELECT 
    COUNT(*) FILTER (WHERE status = 'COMPLETED'),
    COUNT(*) FILTER (WHERE status = 'FAILED')
  INTO v_completed_chapters, v_failed_chapters
  FROM audiobook_chapters
  WHERE job_id = v_job_id;
  
  -- Get total chapters
  SELECT total_chapters INTO v_total_chapters
  FROM audiobook_jobs
  WHERE id = v_job_id;
  
  -- Update job
  UPDATE audiobook_jobs
  SET 
    completed_chapters = v_completed_chapters,
    status = CASE
      WHEN v_failed_chapters > 0 AND v_completed_chapters + v_failed_chapters = v_total_chapters THEN 'FAILED'
      WHEN v_completed_chapters = v_total_chapters THEN 'COMPLETED'
      WHEN v_completed_chapters > 0 OR NEW.status = 'PROCESSING' THEN 'PROCESSING'
      ELSE status
    END,
    started_at = CASE 
      WHEN started_at IS NULL AND NEW.status = 'PROCESSING' THEN NOW()
      ELSE started_at
    END,
    completed_at = CASE
      WHEN v_completed_chapters = v_total_chapters THEN NOW()
      ELSE completed_at
    END
  WHERE id = v_job_id;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_update_audiobook_job_progress
AFTER UPDATE OF status ON audiobook_chapters
FOR EACH ROW
WHEN (NEW.status <> OLD.status)
EXECUTE FUNCTION update_audiobook_job_progress();

-- ───────────────────────────────────────────────────────────────────────────
-- STEP 4: Function for workers to claim next chapter from queue
-- ───────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION claim_audiobook_chapter(
  p_worker_id TEXT,
  p_max_chapters INTEGER DEFAULT 1
)
RETURNS TABLE (
  chapter_id UUID,
  job_id UUID,
  chapter_index INTEGER,
  text TEXT,
  title TEXT
) AS $$
DECLARE
  v_chapter RECORD;
BEGIN
  -- Use FOR UPDATE SKIP LOCKED to prevent race conditions
  -- This allows multiple workers to claim different chapters concurrently
  FOR v_chapter IN
    SELECT ac.id, ac.job_id, ac.chapter_index, ac.text, ac.title
    FROM audiobook_chapters ac
    INNER JOIN audiobook_jobs aj ON ac.job_id = aj.id
    WHERE ac.status = 'QUEUED'
      AND aj.status IN ('QUEUED', 'PROCESSING')
    ORDER BY aj.priority DESC, aj.created_at ASC, ac.chapter_index ASC
    LIMIT p_max_chapters
    FOR UPDATE SKIP LOCKED
  LOOP
    -- Mark as processing
    UPDATE audiobook_chapters
    SET 
      status = 'PROCESSING',
      started_at = NOW(),
      worker_id = p_worker_id
    WHERE id = v_chapter.id;
    
    -- Return claimed chapter
    chapter_id := v_chapter.id;
    job_id := v_chapter.job_id;
    chapter_index := v_chapter.chapter_index;
    text := v_chapter.text;
    title := v_chapter.title;
    RETURN NEXT;
  END LOOP;
  
  RETURN;
END;
$$ LANGUAGE plpgsql;

-- ───────────────────────────────────────────────────────────────────────────
-- STEP 5: Function to complete a chapter
-- ───────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION complete_audiobook_chapter(
  p_chapter_id UUID,
  p_audio_url TEXT,
  p_audio_format TEXT DEFAULT 'mp3',
  p_duration_seconds INTEGER DEFAULT NULL,
  p_error TEXT DEFAULT NULL
)
RETURNS BOOLEAN AS $$
DECLARE
  v_job_id UUID;
BEGIN
  IF p_error IS NOT NULL THEN
    -- Mark chapter as failed
    UPDATE audiobook_chapters
    SET 
      status = 'FAILED',
      error = p_error,
      completed_at = NOW()
    WHERE id = p_chapter_id
    RETURNING job_id INTO v_job_id;
  ELSE
    -- Mark chapter as completed
    UPDATE audiobook_chapters
    SET 
      status = 'COMPLETED',
      audio_url = p_audio_url,
      audio_format = p_audio_format,
      duration_seconds = p_duration_seconds,
      completed_at = NOW()
    WHERE id = p_chapter_id
    RETURNING job_id INTO v_job_id;
  END IF;
  
  RETURN v_job_id IS NOT NULL;
END;
$$ LANGUAGE plpgsql;

-- ───────────────────────────────────────────────────────────────────────────
-- STEP 6: Row Level Security (RLS) Policies
-- ───────────────────────────────────────────────────────────────────────────

-- Enable RLS
ALTER TABLE audiobook_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE audiobook_chapters ENABLE ROW LEVEL SECURITY;

-- Users can only see their own jobs
CREATE POLICY "Users can view their own audiobook jobs"
  ON audiobook_jobs FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own audiobook jobs"
  ON audiobook_jobs FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Users can view chapters for their own jobs
CREATE POLICY "Users can view chapters for their own jobs"
  ON audiobook_chapters FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM audiobook_jobs
      WHERE audiobook_jobs.id = audiobook_chapters.job_id
      AND audiobook_jobs.user_id = auth.uid()
    )
  );

-- Service role (backend) can do everything
-- Note: Service role bypasses RLS, so no policies needed for backend operations

COMMIT;

