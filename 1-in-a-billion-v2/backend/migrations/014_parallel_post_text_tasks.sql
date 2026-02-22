-- ═══════════════════════════════════════════════════════════════════════════
-- MIGRATION 014: PARALLEL POST-TEXT TASKS
-- ═══════════════════════════════════════════════════════════════════════════
-- 
-- FIXES: Sequential pipeline (TEXT → PDF → AUDIO) is wrong.
-- CORRECT: PDF, AUDIO, and SONG all only need TEXT, so they should run in PARALLEL.
--
-- OLD FLOW (WRONG):
-- TEXT (20 min) → PDF (10 min) → AUDIO (60 min) → SONG (never created)
-- Total: ~90+ minutes
--
-- NEW FLOW (CORRECT):
-- TEXT (20 min) → [PDF (10 min) + AUDIO (60 min) + SONG (10 min)] in parallel
-- Total: ~60 minutes (all three run simultaneously)
--
-- ═══════════════════════════════════════════════════════════════════════════

BEGIN;

-- ───────────────────────────────────────────────────────────────────────────
-- STEP 1: Remove old sequential triggers
-- ───────────────────────────────────────────────────────────────────────────

DROP TRIGGER IF EXISTS trg_enqueue_all_pdfs_when_all_text_complete ON job_tasks;
DROP TRIGGER IF EXISTS trg_enqueue_all_audio_when_all_pdfs_complete ON job_tasks;
DROP FUNCTION IF EXISTS enqueue_all_pdfs_when_all_text_complete();
DROP FUNCTION IF EXISTS enqueue_all_audio_when_all_pdfs_complete();

-- ───────────────────────────────────────────────────────────────────────────
-- STEP 2: Create unified trigger for parallel task enqueueing
-- ───────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION enqueue_all_post_text_tasks()
RETURNS TRIGGER AS $$
DECLARE
  v_job_id UUID;
  v_text_tasks_complete INTEGER;
  v_text_tasks_total INTEGER;
  v_pdf_already_enqueued INTEGER;
  v_audio_already_enqueued INTEGER;
  v_song_already_enqueued INTEGER;
  v_text_task RECORD;
  v_pdf_count INTEGER := 0;
  v_audio_count INTEGER := 0;
  v_song_count INTEGER := 0;
BEGIN
  -- Only react when a text task completes
  IF TG_OP <> 'UPDATE' THEN
    RETURN NEW;
  END IF;

  IF NEW.task_type <> 'text_generation' THEN
    RETURN NEW;
  END IF;

  IF NEW.status <> 'complete' THEN
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
    AND task_type = 'text_generation';

  -- Only proceed if ALL text tasks are complete
  IF v_text_tasks_complete < v_text_tasks_total THEN
    RETURN NEW;
  END IF;

  RAISE NOTICE 'All text tasks complete for job %. Enqueueing PDF, Audio, and Song tasks...', v_job_id;

  -- Check what's already enqueued (idempotency)
  SELECT 
    COUNT(*) FILTER (WHERE task_type = 'pdf_generation'),
    COUNT(*) FILTER (WHERE task_type = 'audio_generation'),
    COUNT(*) FILTER (WHERE task_type = 'song_generation')
  INTO v_pdf_already_enqueued, v_audio_already_enqueued, v_song_already_enqueued
  FROM job_tasks
  WHERE job_id = v_job_id;

  -- Enqueue PDF, Audio, and Song tasks for each completed text task
  FOR v_text_task IN
    SELECT id, sequence, output, input
    FROM job_tasks
    WHERE job_id = v_job_id
      AND task_type = 'text_generation'
      AND status = 'complete'
    ORDER BY sequence
  LOOP
    -- 1. PDF GENERATION (if not already enqueued)
    IF v_pdf_already_enqueued = 0 THEN
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
        'pdf_generation',
        'pending',
        v_text_task.sequence + 100,  -- PDFs: sequence 100-115
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
        300  -- 5 minutes timeout
      );
      v_pdf_count := v_pdf_count + 1;
    END IF;

    -- 2. AUDIO GENERATION (if not already enqueued)
    IF v_audio_already_enqueued = 0 THEN
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
        'audio_generation',
        'pending',
        v_text_task.sequence + 200,  -- Audio: sequence 200-215
        jsonb_build_object(
          'textArtifactPath', COALESCE(v_text_task.output->>'textArtifactPath', NULL),
          'title', COALESCE(v_text_task.output->>'title', ''),
          'sourceTaskId', v_text_task.id::text,
          'docNum', COALESCE((v_text_task.output->>'docNum')::int, NULL)
        ),
        0,
        3,
        900  -- 15 minutes timeout (TTS can be slow)
      );
      v_audio_count := v_audio_count + 1;
    END IF;

    -- 3. SONG GENERATION (if not already enqueued)
    IF v_song_already_enqueued = 0 THEN
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
        'song_generation',
        'pending',
        v_text_task.sequence + 300,  -- Songs: sequence 300-315
        jsonb_build_object(
          'docNum', COALESCE((v_text_task.input->>'docNum')::int, NULL),
          'docType', COALESCE(v_text_task.input->>'docType', NULL),
          'system', COALESCE(v_text_task.input->>'system', NULL),
          'sourceTaskId', v_text_task.id::text,
          'personName', COALESCE(v_text_task.input->>'personName', 'User')
        ),
        0,
        3,
        1800  -- 30 minutes timeout (song generation + lyrics)
      );
      v_song_count := v_song_count + 1;
    END IF;
  END LOOP;

  RAISE NOTICE 'Enqueued for job %: PDF=%, AUDIO=%, SONG=%', 
    v_job_id, v_pdf_count, v_audio_count, v_song_count;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ───────────────────────────────────────────────────────────────────────────
-- STEP 3: Create trigger
-- ───────────────────────────────────────────────────────────────────────────

CREATE TRIGGER trg_enqueue_post_text_tasks
AFTER UPDATE OF status ON job_tasks
FOR EACH ROW
EXECUTE FUNCTION enqueue_all_post_text_tasks();

-- ───────────────────────────────────────────────────────────────────────────
-- GRANT PERMISSIONS
-- ───────────────────────────────────────────────────────────────────────────

ALTER FUNCTION enqueue_all_post_text_tasks() SET search_path = public;

COMMIT;

-- ═══════════════════════════════════════════════════════════════════════════
-- VERIFICATION
-- ═══════════════════════════════════════════════════════════════════════════
-- 
-- After running this migration:
-- 1. New jobs will have PDF, Audio, and Song tasks enqueued in parallel
-- 2. Check with: SELECT task_type, status, COUNT(*) FROM job_tasks 
--                WHERE job_id = '<job_id>' GROUP BY task_type, status;
-- 3. Expected: 16 pdf_generation, 16 audio_generation, 16 song_generation
--              all with status='pending' immediately after text completes
-- 
-- ═══════════════════════════════════════════════════════════════════════════
