-- ═══════════════════════════════════════════════════════════════════════════
-- MIGRATION 005: PDF-FIRST WORKFLOW
-- ═══════════════════════════════════════════════════════════════════════════
-- 
-- Changes workflow from: TEXT → AUDIO
-- To: TEXT → PDF → AUDIO (batch)
--
-- Why: Users need PDFs first (downloadable), then audio (longest process)
-- 
-- Flow:
-- 1. ALL text tasks complete (16 tasks)
-- 2. Enqueue ALL PDF tasks (16 tasks) 
-- 3. ALL PDF tasks complete
-- 4. Enqueue ALL audio tasks (16 tasks)
--
-- Requires: migrations/001_supabase_job_queue.sql
-- ═══════════════════════════════════════════════════════════════════════════

BEGIN;

-- ───────────────────────────────────────────────────────────────────────────
-- STEP 1: Remove old audio trigger (002_enqueue_audio_on_text_complete.sql)
-- ───────────────────────────────────────────────────────────────────────────

DROP TRIGGER IF EXISTS trg_enqueue_audio_on_text_complete ON job_tasks;
DROP FUNCTION IF EXISTS enqueue_audio_on_text_complete();

-- ───────────────────────────────────────────────────────────────────────────
-- STEP 2: Enqueue ALL PDF tasks when ALL text tasks complete (batch)
-- ───────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION enqueue_all_pdfs_when_all_text_complete()
RETURNS TRIGGER AS $$
DECLARE
  v_job_id UUID;
  v_text_tasks_complete INTEGER;
  v_text_tasks_total INTEGER;
  v_pdf_already_enqueued INTEGER;
  v_text_task RECORD;
BEGIN
  -- Only react when a text task completes
  IF (TG_OP <> 'UPDATE') THEN
    RETURN NEW;
  END IF;

  IF (NEW.task_type <> 'text_generation'::task_type) THEN
    RETURN NEW;
  END IF;

  IF (NEW.status <> 'complete'::task_status) THEN
    RETURN NEW;
  END IF;

  v_job_id := NEW.job_id;

  -- Count text tasks: complete vs total
  SELECT 
    COUNT(*) FILTER (WHERE status = 'complete') AS complete,
    COUNT(*) AS total
  INTO v_text_tasks_complete, v_text_tasks_total
  FROM job_tasks
  WHERE job_id = v_job_id
    AND task_type = 'text_generation'::task_type;

  -- Only proceed if ALL text tasks are complete
  IF v_text_tasks_complete < v_text_tasks_total THEN
    RETURN NEW;
  END IF;

  -- Check if PDF tasks already enqueued (idempotency)
  SELECT COUNT(*)
  INTO v_pdf_already_enqueued
  FROM job_tasks
  WHERE job_id = v_job_id
    AND task_type = 'pdf_generation'::task_type;

  IF v_pdf_already_enqueued > 0 THEN
    -- PDFs already enqueued, skip
    RETURN NEW;
  END IF;

  -- Get all text tasks (to create matching PDF tasks)
  FOR v_text_task IN
    SELECT id, sequence, output
    FROM job_tasks
    WHERE job_id = v_job_id
      AND task_type = 'text_generation'::task_type
      AND status = 'complete'::task_status
    ORDER BY sequence
  LOOP
    -- Enqueue PDF task for this text task
    INSERT INTO job_tasks (
      job_id,
      task_type,
      status,
      sequence,
      input,
      attempts,
      max_attempts,
      heartbeat_timeout_seconds
    ) VALUES (
      v_job_id,
      'pdf_generation'::task_type,
      'pending'::task_status,
      v_text_task.sequence + 100,  -- PDFs after text (sequence 100-115)
      jsonb_build_object(
        'textArtifactPath', COALESCE(v_text_task.output->>'textArtifactPath', NULL),
        'title', COALESCE(v_text_task.output->>'title', ''),
        'sourceTaskId', v_text_task.id::text,
        'docNum', COALESCE((v_text_task.output->>'docNum')::int, NULL),
        'docType', COALESCE(v_text_task.output->>'docType', NULL),
        'system', COALESCE(v_text_task.output->>'system', NULL)
      ),
      0,
      3,
      300  -- PDF generation is faster than audio
    );
  END LOOP;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_enqueue_all_pdfs_when_all_text_complete
AFTER UPDATE OF status ON job_tasks
FOR EACH ROW
EXECUTE FUNCTION enqueue_all_pdfs_when_all_text_complete();

-- ───────────────────────────────────────────────────────────────────────────
-- STEP 3: Enqueue ALL audio tasks when ALL PDFs complete (batch)
-- ───────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION enqueue_all_audio_when_all_pdfs_complete()
RETURNS TRIGGER AS $$
DECLARE
  v_job_id UUID;
  v_text_tasks_complete INTEGER;
  v_pdf_tasks_complete INTEGER;
  v_pdf_tasks_total INTEGER;
  v_already_enqueued INTEGER;
  v_text_task RECORD;
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

  -- Check if audio tasks already enqueued (idempotency)
  SELECT COUNT(*)
  INTO v_already_enqueued
  FROM job_tasks
  WHERE job_id = v_job_id
    AND task_type = 'audio_generation'::task_type;

  IF v_already_enqueued > 0 THEN
    -- Audio already enqueued, skip
    RETURN NEW;
  END IF;

  -- Get all text tasks (to create matching audio tasks)
  -- We'll create audio tasks for each completed text task
  FOR v_text_task IN
    SELECT id, sequence, output
    FROM job_tasks
    WHERE job_id = v_job_id
      AND task_type = 'text_generation'::task_type
      AND status = 'complete'::task_status
    ORDER BY sequence
  LOOP
    -- Enqueue audio task for this text task
    INSERT INTO job_tasks (
      job_id,
      task_type,
      status,
      sequence,
      input,
      attempts,
      max_attempts,
      heartbeat_timeout_seconds
    ) VALUES (
      v_job_id,
      'audio_generation'::task_type,
      'pending'::task_status,
      v_text_task.sequence + 200,  -- Audio after PDFs (sequence 200-215)
      jsonb_build_object(
        'textArtifactPath', COALESCE(v_text_task.output->>'textArtifactPath', NULL),
        'title', COALESCE(v_text_task.output->>'title', ''),
        'sourceTaskId', v_text_task.id::text,
        'docNum', COALESCE((v_text_task.output->>'docNum')::int, NULL)
      ),
      0,
      3,
      900  -- Audio generation is slow
    );
  END LOOP;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_enqueue_all_audio_when_all_pdfs_complete
AFTER UPDATE OF status ON job_tasks
FOR EACH ROW
EXECUTE FUNCTION enqueue_all_audio_when_all_pdfs_complete();

COMMIT;

