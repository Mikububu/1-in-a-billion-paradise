-- ═══════════════════════════════════════════════════════════════════════════
-- MIGRATION 007: REPLACE AUDIO TASKS WITH AUDIOBOOK QUEUE
-- ═══════════════════════════════════════════════════════════════════════════
-- 
-- Replaces the old serverless audio_generation task system with the new
-- persistent queue-based audiobook_jobs/audiobook_chapters system.
--
-- When all PDFs complete for a job, instead of creating audio_generation tasks
-- in job_tasks, we now create an audiobook_job with audiobook_chapters.
--
-- This allows the persistent GPU workers to process chapters from the queue
-- instead of relying on serverless /runsync which fails at scale.
--
-- Date: December 27, 2025
-- Requires: Migration 006 (audiobook_queue_system)
-- ═══════════════════════════════════════════════════════════════════════════

BEGIN;

-- ───────────────────────────────────────────────────────────────────────────
-- STEP 1: Remove old audio task trigger (drop if exists, no error if missing)
-- ───────────────────────────────────────────────────────────────────────────

DROP TRIGGER IF EXISTS trg_enqueue_all_audio_when_all_pdfs_complete ON job_tasks;
DROP TRIGGER IF EXISTS trg_create_audiobook_job_when_all_pdfs_complete ON job_tasks;
DROP FUNCTION IF EXISTS enqueue_all_audio_when_all_pdfs_complete();
DROP FUNCTION IF EXISTS create_audiobook_job_when_all_pdfs_complete();

-- ───────────────────────────────────────────────────────────────────────────
-- STEP 2: Create function to create audiobook job when all PDFs complete
-- ───────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION create_audiobook_job_when_all_pdfs_complete()
RETURNS TRIGGER AS $$
DECLARE
  v_job_id UUID;
  v_user_id UUID;
  v_pdf_tasks_complete INTEGER;
  v_pdf_tasks_total INTEGER;
  v_text_tasks_total INTEGER;
  v_job_type TEXT;
  v_audiobook_job_id UUID;
  v_text_task RECORD;
  v_chapter_index INTEGER;
  v_total_text_length INTEGER;
  v_chapter_count INTEGER;
BEGIN
  -- Only react when a PDF task completes
  IF (TG_OP <> 'UPDATE') THEN
    RETURN NEW;
  END IF;

  IF (NEW.task_type <> 'pdf_generation'::task_type) THEN
    RETURN NEW;
  END IF;

  IF (NEW.status <> 'complete'::task_status) THEN
    RETURN NEW;
  END IF;

  v_job_id := NEW.job_id;

  -- Get job info
  SELECT user_id, type INTO v_user_id, v_job_type
  FROM jobs
  WHERE id = v_job_id;

  IF v_user_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- Count PDF tasks: complete vs total
  SELECT 
    COUNT(*) FILTER (WHERE status = 'complete') AS complete,
    COUNT(*) AS total
  INTO v_pdf_tasks_complete, v_pdf_tasks_total
  FROM job_tasks
  WHERE job_id = v_job_id
    AND task_type = 'pdf_generation'::task_type;

  -- Only proceed if ALL PDFs are complete
  IF v_pdf_tasks_complete < v_pdf_tasks_total THEN
    RETURN NEW;
  END IF;

  -- Check if audiobook job already exists (idempotency)
  SELECT COUNT(*) INTO v_chapter_count
  FROM audiobook_jobs
  WHERE id = v_job_id; -- Use same ID as parent job for simplicity

  IF v_chapter_count > 0 THEN
    -- Audiobook job already created, skip
    RETURN NEW;
  END IF;

  -- Count text tasks (we'll create one chapter per text task)
  SELECT COUNT(*) INTO v_text_tasks_total
  FROM job_tasks
  WHERE job_id = v_job_id
    AND task_type = 'text_generation'::task_type
    AND status = 'complete'::task_status;

  IF v_text_tasks_total = 0 THEN
    -- No text tasks, skip
    RETURN NEW;
  END IF;

  -- Calculate total text length estimate (for job metadata)
  -- Try to get from text artifacts file size as approximation
  SELECT COALESCE(SUM(file_size_bytes), 0) INTO v_total_text_length
  FROM job_artifacts
  WHERE job_id = v_job_id
    AND artifact_type = 'text';

  -- Create audiobook job (use same ID as parent job for easy lookup)
  INSERT INTO audiobook_jobs (
    id,
    user_id,
    status,
    priority,
    total_chapters,
    completed_chapters,
    text_length,
    created_at
  ) VALUES (
    v_job_id, -- Use same ID as parent job
    v_user_id,
    'QUEUED',
    0, -- Default priority
    v_text_tasks_total,
    0,
    v_total_text_length,
    NOW()
  )
  ON CONFLICT (id) DO NOTHING
  RETURNING id INTO v_audiobook_job_id;

  -- If job creation was skipped (already exists), exit
  IF v_audiobook_job_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- Create chapters from text tasks
  v_chapter_index := 0;
  FOR v_text_task IN
    SELECT 
      id,
      sequence,
      output,
      (output->>'title')::TEXT AS title,
      (output->>'textArtifactPath')::TEXT AS text_artifact_path
    FROM job_tasks
    WHERE job_id = v_job_id
      AND task_type = 'text_generation'::task_type
      AND status = 'complete'::task_status
    ORDER BY sequence
  LOOP
    -- Insert chapter with artifact path (worker will download text from storage)
    -- Text is typically not in output JSONB, so we always use artifact path
    IF v_text_task.text_artifact_path IS NOT NULL THEN
      INSERT INTO audiobook_chapters (
        job_id,
        chapter_index,
        title,
        text,
        status
      ) VALUES (
        v_audiobook_job_id,
        v_chapter_index,
        v_text_task.title,
        -- Store artifact path marker - worker will download from storage
        'ARTIFACT_PATH:' || v_text_task.text_artifact_path,
        'QUEUED'
      );
      
      v_chapter_index := v_chapter_index + 1;
    END IF;
  END LOOP;

  -- Update total_chapters in case some were skipped
  UPDATE audiobook_jobs
  SET total_chapters = v_chapter_index
  WHERE id = v_audiobook_job_id;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ───────────────────────────────────────────────────────────────────────────
-- STEP 3: Create trigger
-- ───────────────────────────────────────────────────────────────────────────

CREATE TRIGGER trg_create_audiobook_job_when_all_pdfs_complete
AFTER UPDATE OF status ON job_tasks
FOR EACH ROW
EXECUTE FUNCTION create_audiobook_job_when_all_pdfs_complete();

COMMIT;

